import { useState, useCallback } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import {
  analyzeDemographics,
  detectPairedQuestions,
  analyzePairedDemographics,
  getPairedColumnIndices,
} from '../../utils/demographicAnalyzer';
import { analyzeLikertGroups } from '../../utils/likertAnalyzer';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export default function LikertReview() {
  const { state, dispatch } = useSurvey();
  const { likertScale, surveyData } = state;

  const [labels, setLabels] = useState<string[]>(
    likertScale?.labels || []
  );

  const [itemDirections, setItemDirections] = useState<Record<number, 'positive' | 'negative'>>(() => {
    const initial: Record<number, 'positive' | 'negative'> = {};
    if (state.likertGroups) {
      state.likertGroups.forEach(group => {
        if (group.itemDirections) {
          Object.assign(initial, group.itemDirections);
        } else {
          for (let i = group.startIndex; i <= group.endIndex; i++) {
            initial[i] = 'positive';
          }
        }
      });
    }
    return initial;
  });

  const handleLabelChange = useCallback((index: number, value: string) => {
    setLabels(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleAddLabel = useCallback(() => {
    setLabels(prev => [...prev, '']);
  }, []);

  const handleRemoveLabel = useCallback((index: number) => {
    setLabels(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveLabel = useCallback((index: number, direction: 'up' | 'down') => {
    setLabels(prev => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return updated;
    });
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const destIndex = result.destination.index;
    const sourceIndex = result.source.index;
    
    setLabels(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(sourceIndex, 1);
      updated.splice(destIndex, 0, removed);
      return updated;
    });
  };

  const handleProceed = useCallback(() => {
    if (!surveyData || !state.demographicRange) return;
    
    const updatedScale = { labels };
    dispatch({ type: 'SET_LIKERT_SCALE', payload: updatedScale });
    dispatch({ type: 'SET_ANALYZING', payload: true });

    // Run analysis
    try {
      // كشف وتحليل الأسئلة المقارنة
      const { startIndex, endIndex, ignoredQuestions } = state.demographicRange;
      const pairedGroups = detectPairedQuestions(surveyData.headers, startIndex, endIndex, ignoredQuestions);
      const pairedResults = analyzePairedDemographics(surveyData, pairedGroups);
      const pairedIndices = getPairedColumnIndices(pairedGroups);
      dispatch({ type: 'SET_PAIRED_DEMOGRAPHIC_RESULTS', payload: pairedResults });

      // التحليل الديموغرافي العادي (مع استبعاد المقارنة وعمود المجموعة)
      const allDemoResults = analyzeDemographics(surveyData, state.demographicRange);
      const demoResults = allDemoResults.filter(r => 
        !pairedIndices.has(r.questionIndex) && 
        !(state.isGroupSurvey && state.groupUserIdColumnIndex === r.questionIndex)
      );
      dispatch({ type: 'SET_DEMOGRAPHIC_RESULTS', payload: demoResults });

      const updatedLikertGroups = state.likertGroups.map(g => {
        const groupDirections: Record<number, 'positive' | 'negative'> = {};
        for (let i = g.startIndex; i <= g.endIndex; i++) {
          groupDirections[i] = itemDirections[i] || 'positive';
        }
        return { ...g, itemDirections: groupDirections };
      });
      dispatch({ type: 'SET_LIKERT_GROUPS', payload: updatedLikertGroups });

      const likertResults = analyzeLikertGroups(surveyData, updatedLikertGroups, updatedScale);
      dispatch({ type: 'SET_LIKERT_RESULTS', payload: likertResults });

      dispatch({ type: 'SET_ANALYZING', payload: false });
      dispatch({ type: 'SET_STEP', payload: 'analysis' });
    } catch (error) {
      console.error('Analysis error:', error);
      dispatch({ type: 'SET_ANALYZING', payload: false });
    }
  }, [labels, dispatch, surveyData, state.demographicRange, state.likertGroups, itemDirections]);

  if (!likertScale) return null;

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h2 className="card-title">🔍 مراجعة إجابات مقياس ليكرت</h2>
        <p className="card-subtitle">
          تم اكتشاف إجابات مقياس ليكرت تلقائيًا. يمكنك تعديلها أو إعادة ترتيبها أو الموافقة عليها كما هي (يمكنك استخدام السحب والإفلات).
        </p>
      </div>

      <div className="config-section">
        <h3 className="config-section-title">
          📝 إجابات المقياس ({labels.length} إجابات)
        </h3>

        <div className="alert alert-info">
          <span className="alert-icon">💡</span>
          <span>
            يجب أن يكون ترتيب الإجابات من الأعلى موافقة إلى الأدنى (مثلاً: أوافق بشدة ← لا أوافق بشدة).
            يمكنك تعديل النص، حذف إجابات غير مرغوبة، أو إعادة الترتيب.
          </span>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="likert-labels">
            {(provided) => (
              <div 
                className="scale-labels-list" 
                style={{ marginTop: '1rem' }}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {labels.map((label, idx) => (
                  <Draggable key={`label-${idx}`} draggableId={`label-${idx}`} index={idx}>
                    {(provided, snapshot) => (
                      <div 
                        className={`scale-label-item ${snapshot.isDragging ? 'dragging' : ''}`}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <div className="drag-handle" {...provided.dragHandleProps}>⋮⋮</div>
                        <div className="scale-label-number">{idx + 1}</div>
                        <input
                          type="text"
                          className="scale-label-input"
                          value={label}
                          onChange={(e) => handleLabelChange(idx, e.target.value)}
                          placeholder={`الإجابة ${idx + 1}`}
                        />
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleMoveLabel(idx, 'up')}
                            disabled={idx === 0}
                            title="نقل لأعلى"
                          >
                            ▲
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleMoveLabel(idx, 'down')}
                            disabled={idx === labels.length - 1}
                            title="نقل لأسفل"
                          >
                            ▼
                          </button>
                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleRemoveLabel(idx)}
                            disabled={labels.length <= 2}
                            title="حذف"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleAddLabel}>
            ➕ إضافة إجابة
          </button>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title">
          ⚖️ اتجاه العبارات (إيجابي / سلبي)
        </h3>
        <div className="alert alert-info">
          <span className="alert-icon">💡</span>
          <span>
            حدد اتجاه كل عبارة لضمان حساب المتوسطات بدقة (يتم عكس درجات العبارات السلبية).
          </span>
        </div>

        {state.likertGroups.map((group, gIdx) => (
          <div key={group.id} style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--primary-300)' }}>
              المجموعة {gIdx + 1}: {group.name}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Array.from({ length: group.endIndex - group.startIndex + 1 }).map((_, i) => {
                const qIdx = group.startIndex + i;
                const text = surveyData?.headers[qIdx] || '';
                return (
                  <div key={qIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ flex: 1, fontSize: '0.9rem', paddingLeft: '1rem' }}>
                      <span style={{ fontWeight: 600, marginLeft: '0.5rem', color: 'var(--text-muted)' }}>{qIdx + 1}.</span>
                      {text}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      <button
                        className={`btn btn-sm ${itemDirections[qIdx] === 'positive' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setItemDirections(prev => ({ ...prev, [qIdx]: 'positive' }))}
                      >
                        [+] إيجابي
                      </button>
                      <button
                        className={`btn btn-sm ${itemDirections[qIdx] === 'negative' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => setItemDirections(prev => ({ ...prev, [qIdx]: 'negative' }))}
                      >
                        [-] سلبي
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="config-section">
        <h3 className="config-section-title">📊 ملخص الإعدادات</h3>
        
        <div className="file-info">
          <div className="file-info-item">
            <div className="file-info-icon">📋</div>
            <div className="file-info-value">
              {state.demographicRange 
                ? state.demographicRange.endIndex - state.demographicRange.startIndex + 1 
                : 0}
            </div>
            <div className="file-info-label">أسئلة ديموغرافية</div>
          </div>
          <div className="file-info-item">
            <div className="file-info-icon">📊</div>
            <div className="file-info-value">{state.likertGroups.length}</div>
            <div className="file-info-label">مجموعات ليكرت</div>
          </div>
          <div className="file-info-item">
            <div className="file-info-icon">📝</div>
            <div className="file-info-value">{labels.length}</div>
            <div className="file-info-label">إجابات المقياس</div>
          </div>
        </div>
      </div>

      <div className="actions-bar">
        <button
          className="btn btn-secondary"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'review-demographics' })}
        >
          ⬅️ السابق
        </button>
        <button
          className="btn btn-success btn-lg"
          onClick={handleProceed}
          disabled={labels.length < 2 || labels.some(l => l.trim() === '')}
        >
          ✅ تأكيد وبدء التحليل
        </button>
      </div>
    </div>
  );
}
