import { useState, useEffect } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import { analyzeDemographics, detectPairedQuestions, analyzePairedDemographics, getPairedColumnIndices } from '../../utils/demographicAnalyzer';
import { detectLikertScale } from '../../utils/likertAnalyzer';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export default function DemographicReview() {
  const { state, dispatch } = useSurvey();
  const { surveyData, demographicRange } = state;
  
  const [orders, setOrders] = useState<Record<number, string[]>>(demographicRange?.customAnswerOrders ?? {});
  const [newAnswers, setNewAnswers] = useState<Record<number, string>>({});
  const [ignored, setIgnored] = useState<number[]>(demographicRange?.ignoredQuestions || []);

  // Initialize orders for all questions if not already present
  useEffect(() => {
    if (!surveyData || !demographicRange) return;
    
    const newOrders = { ...orders };
    let changed = false;
    
    for (let i = demographicRange.startIndex; i <= demographicRange.endIndex; i++) {
      if (!newOrders[i]) {
        const unique = getUniqueFromData(i);
        newOrders[i] = autoSortAnswers(unique);
        changed = true;
      }
    }
    
    if (changed) {
      setOrders(newOrders);
    }
  }, [surveyData, demographicRange]);

  const getUniqueFromData = (idx: number) => {
    if (!surveyData || !demographicRange) return [];
    const set = new Set<string>();
    const isMulti = demographicRange.multiChoiceQuestions?.includes(idx);
    for (const row of surveyData.rows) {
      const val = row[idx] || '';
      if (val.trim()) {
        if (isMulti) {
          val.split(/,|،|-/).forEach(p => {
            const t = p.trim();
            if (t) set.add(t);
          });
        } else {
          set.add(val.trim());
        }
      }
    }
    return Array.from(set);
  };

  const autoSortAnswers = (answers: string[]) => {
    return [...answers].sort((a, b) => {
      const getVal = (s: string) => {
        const numbers = s.match(/\d+/g);
        if (!numbers) return 0;
        let val = parseFloat(numbers[0]);
        if (s.includes('أقل من') && numbers.length === 1) val -= 0.1;
        if (s.includes('فأكثر')) val += 0.1;
        return val;
      };
      const vA = getVal(a), vB = getVal(b);
      if (vA !== vB) return vA - vB;
      return a.localeCompare(b, 'ar');
    });
  };

  const move = (qIdx: number, aIdx: number, dir: 'up' | 'down') => {
    const list = [...(orders[qIdx] || [])];
    const target = dir === 'up' ? aIdx - 1 : aIdx + 1;
    if (target < 0 || target >= list.length) return;
    [list[aIdx], list[target]] = [list[target], list[aIdx]];
    setOrders({ ...orders, [qIdx]: list });
  };

  const onDragEnd = (result: DropResult, qIdx: number) => {
    if (!result.destination) return;
    const destIndex = result.destination.index;
    const sourceIndex = result.source.index;
    
    const list = [...(orders[qIdx] || [])];
    const [removed] = list.splice(sourceIndex, 1);
    list.splice(destIndex, 0, removed);
    setOrders({ ...orders, [qIdx]: list });
  };

  const addAnswer = (qIdx: number) => {
    const text = newAnswers[qIdx]?.trim();
    if (!text) return;
    const list = orders[qIdx] || [];
    if (list.includes(text)) return;
    setOrders({ ...orders, [qIdx]: [...list, text] });
    setNewAnswers({ ...newAnswers, [qIdx]: '' });
  };

  const removeAnswer = (qIdx: number, aIdx: number) => {
    const list = [...(orders[qIdx] || [])];
    list.splice(aIdx, 1);
    setOrders({ ...orders, [qIdx]: list });
  };

  const handleBack = () => {
    // حفظ التعديلات الحالية قبل الرجوع
    const updatedRange = { ...demographicRange!, customAnswerOrders: orders, ignoredQuestions: ignored };
    dispatch({ type: 'SET_DEMOGRAPHIC_RANGE', payload: updatedRange });
    dispatch({ type: 'SET_STEP', payload: 'configure' });
  };

  const handleNext = () => {
    const updatedRange = { ...demographicRange!, customAnswerOrders: orders, ignoredQuestions: ignored };
    dispatch({ type: 'SET_DEMOGRAPHIC_RANGE', payload: updatedRange });
    
    if (state.likertGroups.length === 0) {
      // Analysis directly
      const pairedGroups = detectPairedQuestions(surveyData!.headers, updatedRange.startIndex, updatedRange.endIndex, updatedRange.ignoredQuestions);
      const pairedResults = analyzePairedDemographics(surveyData!, pairedGroups);
      const pairedIndices = getPairedColumnIndices(pairedGroups);
      dispatch({ type: 'SET_PAIRED_DEMOGRAPHIC_RESULTS', payload: pairedResults });
      
      const allDemoResults = analyzeDemographics(surveyData!, updatedRange);
      const demoResults = allDemoResults.filter(r => 
        !pairedIndices.has(r.questionIndex) && 
        !(state.isGroupSurvey && state.groupUserIdColumnIndex === r.questionIndex)
      );
      dispatch({ type: 'SET_DEMOGRAPHIC_RESULTS', payload: demoResults });
      dispatch({ type: 'SET_LIKERT_RESULTS', payload: [] });
      dispatch({ type: 'SET_STEP', payload: 'analysis' });
    } else {
      const scale = detectLikertScale(surveyData!, state.likertGroups);
      dispatch({ type: 'SET_LIKERT_SCALE', payload: scale });
      dispatch({ type: 'SET_STEP', payload: 'review-likert' });
    }
  };

  if (!surveyData || !demographicRange) return null;

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 مراجعة وترتيب الإجابات الديموغرافية</h2>
          <p className="card-subtitle">تأكد من ترتيب الإجابات وإضافة أي خيارات مفقودة (يمكنك استخدام السحب والإفلات)</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {surveyData.headers.slice(demographicRange.startIndex, demographicRange.endIndex + 1).map((header, idx) => {
            const absoluteIdx = demographicRange.startIndex + idx;
            if (state.isGroupSurvey && state.groupUserIdColumnIndex === absoluteIdx) return null;
            if (ignored.includes(absoluteIdx)) return null;
            const currentOrder = orders[absoluteIdx] || [];
            return (
              <div key={absoluteIdx} className="config-section" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--primary-300)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-primary">{absoluteIdx + 1}</span>
                    {header}
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ color: 'var(--error-400)' }}
                    onClick={() => setIgnored([...ignored, absoluteIdx])}
                    title="حذف هذا السؤال واستبعاده من التحليل"
                  >
                    🗑️ حذف السؤال
                  </button>
                </h4>

                <DragDropContext onDragEnd={(result) => onDragEnd(result, absoluteIdx)}>
                  <Droppable droppableId={`q-${absoluteIdx}`}>
                    {(provided) => (
                      <div 
                        className="sort-list" 
                        style={{ maxWidth: '600px' }}
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {currentOrder.map((answer, aIdx) => (
                          <Draggable key={`${absoluteIdx}-${answer}`} draggableId={`${absoluteIdx}-${answer}`} index={aIdx}>
                            {(provided, snapshot) => (
                              <div 
                                className={`sort-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                <div className="drag-handle" {...provided.dragHandleProps}>⋮⋮</div>
                                <span className="sort-item-text">{answer}</span>
                                <div className="sort-item-actions">
                                  <button className="btn btn-secondary btn-sm" onClick={() => move(absoluteIdx, aIdx, 'up')} disabled={aIdx === 0}>▲</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => move(absoluteIdx, aIdx, 'down')} disabled={aIdx === currentOrder.length - 1}>▼</button>
                                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error-400)' }} onClick={() => removeAnswer(absoluteIdx, aIdx)}>✕</button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {currentOrder.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                              لم يتم العثور على إجابات في البيانات لهذا السؤال.
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', maxWidth: '600px' }}>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="إضافة إجابة جديدة (مثلاً: إجابة لم يختارها أحد)..."
                    value={newAnswers[absoluteIdx] || ''}
                    onChange={(e) => setNewAnswers({ ...newAnswers, [absoluteIdx]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addAnswer(absoluteIdx)}
                  />
                  <button className="btn btn-primary" onClick={() => addAnswer(absoluteIdx)}>إضافة</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="actions-bar" style={{ marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={handleBack}>⬅️ العودة للإعدادات</button>
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            {state.likertGroups.length > 0 ? 'متابعة لمراجعة ليكرت ➡️' : 'بدء التحليل النهائي ➡️'}
          </button>
        </div>
      </div>
    </div>
  );
}
