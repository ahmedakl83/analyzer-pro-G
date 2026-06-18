import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import type { LikertGroup } from '../../types/survey';
import { classifySurveyHeaders, classificationConfidence } from '../../utils/surveyClassifier';

/**
 * يفحص عبارات المجموعة ويستخلص اسمها إن كانت بالنمط:
 *   "اسم المجموعة [نص العبارة]"  أو  "اسم المجموعة (نص العبارة)"
 * يشترط أن تشترك جميع العبارات بنفس النص خارج القوس.
 */
function inferGroupName(headers: string[]): string | null {
  if (headers.length === 0) return null;
  const pattern = /^(.+?)\s*[\[(].+[\])]$/;
  const names = headers.map(h => {
    const m = h.match(pattern);
    return m ? m[1].trim() : null;
  });
  if (names.some(n => n === null)) return null;
  const first = names[0]!;
  return names.every(n => n === first) ? first : null;
}

export default function QuestionConfig() {
  const { state, dispatch } = useSurvey();
  const { surveyData } = state;

  // Demographic range
  const [demoStart, setDemoStart] = useState<number>(
    state.demographicRange?.startIndex ?? 0
  );
  const [demoEnd, setDemoEnd] = useState<number>(
    state.demographicRange?.endIndex ?? 0
  );
  const [multiChoiceQuestions, setMultiChoiceQuestions] = useState<number[]>(
    state.demographicRange?.multiChoiceQuestions ?? []
  );

  const toggleMultiChoice = (idx: number) => {
    setMultiChoiceQuestions(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const [customAnswerOrders] = useState<Record<number, string[]>>(
    state.demographicRange?.customAnswerOrders ?? {}
  );

  // Likert groups
  const [likertGroups, setLikertGroups] = useState<LikertGroup[]>(
    state.likertGroups.length > 0 ? state.likertGroups : []
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEnd, setNewGroupEnd] = useState<number | ''>('');
  const [nameAutoFilled, setNameAutoFilled] = useState(false);

  const maxIndex = (surveyData?.totalQuestions ?? 1) - 1;

  // ─── التصنيف التلقائي ──────────────────────────────────────────────────────
  const [autoClassified, setAutoClassified] = useState(false);
  const [autoConfidence, setAutoConfidence] = useState<number | null>(null);

  const handleAutoClassify = useCallback(() => {
    if (!surveyData) return;
    const result = classifySurveyHeaders(surveyData.headers);
    const confidence = classificationConfidence(surveyData.headers, result);

    // تطبيق النطاق الديموغرافي
    if (result.demographicRange) {
      setDemoStart(result.demographicRange.startIndex);
      setDemoEnd(result.demographicRange.endIndex);
    } else {
      // لا توجد أسئلة ديموغرافية → اجعل النطاق فارغاً (نقطة واحدة خارج الحدود)
      setDemoStart(0);
      setDemoEnd(-1);
    }

    // تطبيق مجموعات ليكرت
    setLikertGroups(result.likertGroups);
    setAutoClassified(true);
    setAutoConfidence(confidence);
  }, [surveyData]);

  // Calculate the start index for the next Likert group
  const nextLikertStart = useMemo(() => {
    if (likertGroups.length === 0) return demoEnd + 1;
    return likertGroups[likertGroups.length - 1].endIndex + 1;
  }, [likertGroups, demoEnd]);

  // Check if all questions are covered by demographic alone
  const isDemoOnly = useMemo(() => demoEnd >= maxIndex, [demoEnd, maxIndex]);

  const isAllQuestionsAssigned = useMemo(() => {
    if (isDemoOnly) return true;
    if (likertGroups.length === 0) return false;
    return likertGroups[likertGroups.length - 1].endIndex >= maxIndex;
  }, [likertGroups, maxIndex, isDemoOnly]);

  // استخلاص اسم المجموعة تلقائياً عند تغيير نطاق الأسئلة
  useEffect(() => {
    if (!surveyData) return;
    if (typeof newGroupEnd !== 'number' || newGroupEnd < nextLikertStart) return;
    const headers = surveyData.headers.slice(nextLikertStart, newGroupEnd + 1);
    const inferred = inferGroupName(headers);
    if (inferred) {
      setNewGroupName(inferred);
      setNameAutoFilled(true);
    } else if (nameAutoFilled) {
      setNewGroupName('');
      setNameAutoFilled(false);
    }
  }, [newGroupEnd, nextLikertStart, surveyData]);

  if (!surveyData) return null;

  const handleAddGroup = useCallback(() => {
    if (newGroupEnd === '' || typeof newGroupEnd !== 'number') return;
    if (newGroupEnd < nextLikertStart || newGroupEnd > maxIndex) return;

    const group: LikertGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim() || `المجموعة ${likertGroups.length + 1}`,
      startIndex: nextLikertStart,
      endIndex: newGroupEnd,
    };

    const updated = [...likertGroups, group];
    setLikertGroups(updated);
    setNewGroupName('');
    setNewGroupEnd('');
    setNameAutoFilled(false);
  }, [newGroupEnd, nextLikertStart, maxIndex, newGroupName, likertGroups]);

  const handleRemoveLastGroup = useCallback(() => {
    if (likertGroups.length > 0) {
      setLikertGroups(prev => prev.slice(0, -1));
    }
  }, [likertGroups]);

  const handleProceed = useCallback(() => {
    const range = { 
      ...state.demographicRange,
      startIndex: demoStart, 
      endIndex: demoEnd, 
      multiChoiceQuestions, 
      customAnswerOrders 
    };
    dispatch({
      type: 'SET_DEMOGRAPHIC_RANGE',
      payload: range,
    });
    dispatch({ type: 'SET_LIKERT_GROUPS', payload: likertGroups });

    dispatch({ type: 'SET_STEP', payload: 'review-demographics' });
  }, [dispatch, demoStart, demoEnd, likertGroups, multiChoiceQuestions, customAnswerOrders]);

  const hasDemoSelection = demoEnd >= demoStart;
  const hasAnySelection = hasDemoSelection || likertGroups.length > 0;
  const canProceed = hasAnySelection;

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h2 className="card-title">⚙️ إعداد مجموعات الأسئلة</h2>
        <p className="card-subtitle">حدد نطاق الأسئلة الديموغرافية ومجموعات ليكرت</p>
      </div>

      {/* Auto-classify Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-900, #1e1b4b) 0%, var(--bg-elevated) 100%)',
        border: '1px solid var(--primary-700, #4338ca)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            🤖 التصنيف التلقائي
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            يحلل رؤوس الأعمدة ويكتشف الأسئلة الديموغرافية ومجموعات ليكرت تلقائياً
          </div>
        </div>

        {autoConfidence !== null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: autoConfidence >= 80 ? 'var(--accent-400, #34d399)' : autoConfidence >= 50 ? '#fbbf24' : '#f87171',
            }}>
              {autoConfidence}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>دقة التصنيف</div>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleAutoClassify}
          style={{ whiteSpace: 'nowrap' }}
        >
          {autoClassified ? '🔄 إعادة التصنيف' : '✨ صنّف تلقائياً'}
        </button>
      </div>

      {autoClassified && autoConfidence !== null && (
        <div className={`alert ${autoConfidence >= 70 ? 'alert-success' : 'alert-info'}`} style={{ marginBottom: 'var(--space-4)' }}>
          <span className="alert-icon">{autoConfidence >= 70 ? '✅' : 'ℹ️'}</span>
          <span>
            تم التصنيف التلقائي بنجاح — تم تصنيف{' '}
            <strong>{autoConfidence}%</strong> من الأسئلة.
            {autoConfidence < 100 && ' يمكنك تعديل النتائج يدوياً أدناه.'}
          </span>
        </div>
      )}

      {/* Demographic Questions Section */}
      <div className="config-section">
        <h3 className="config-section-title">
          📋 الأسئلة الديموغرافية
        </h3>

        <div className="config-row">
          <label>من السؤال:</label>
          <select
            className="form-select"
            value={demoStart}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDemoStart(val);
              if (val > demoEnd) setDemoEnd(val);
            }}
            style={{ minWidth: 300 }}
          >
            {surveyData.headers.map((header, idx) => {
              if (state.isGroupSurvey && state.groupUserIdColumnIndex === idx) return null;
              return (
                <option key={idx} value={idx}>
                  {idx + 1}. {header.length > 50 ? header.substring(0, 50) + '...' : header}
                </option>
              );
            })}
          </select>

          <label>إلى السؤال:</label>
          <select
            className="form-select"
            value={demoEnd}
            onChange={(e) => setDemoEnd(Number(e.target.value))}
            style={{ minWidth: 300 }}
          >
            {surveyData.headers.map((header, idx) => {
              if (state.isGroupSurvey && state.groupUserIdColumnIndex === idx) return null;
              return (
                <option key={idx} value={idx} disabled={idx < demoStart}>
                  {idx + 1}. {header.length > 50 ? header.substring(0, 50) + '...' : header}
                </option>
              );
            })}
          </select>
        </div>

        {/* Preview selected demographic questions */}
        <div className="question-preview">
          <div style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
            الأسئلة الديموغرافية المحددة:
          </div>
          {surveyData.headers.slice(demoStart, demoEnd + 1).map((header, idx) => {
            const absoluteIdx = demoStart + idx;
            if (state.isGroupSurvey && state.groupUserIdColumnIndex === absoluteIdx) return null;
            return (
              <div key={absoluteIdx} className="question-preview-item highlighted" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="question-preview-number">{absoluteIdx + 1}</span>
                  <span className="question-preview-text" style={{ flex: 1 }}>{header}</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', paddingRight: '2.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={multiChoiceQuestions.includes(absoluteIdx)}
                    onChange={() => toggleMultiChoice(absoluteIdx)}
                    className="form-checkbox"
                  />
                  يسمح باختيار أكثر من إجابة (يتم تفريغ الإجابات المتعددة المفصولة بفاصلة)
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Likert Groups Section */}
      <div className="config-section">
        <h3 className="config-section-title">
          📊 مجموعات أسئلة ليكرت
        </h3>

        {/* Existing Groups */}
        {likertGroups.length > 0 && (
          <div className="likert-groups-list" style={{ marginBottom: '1.5rem' }}>
            {likertGroups.map((group, idx) => (
              <div key={group.id} className="likert-group-item">
                <div className="likert-group-info">
                  <div className="likert-group-badge">{idx + 1}</div>
                  <div>
                    <div className="likert-group-name">{group.name}</div>
                    <div className="likert-group-range">
                      الأسئلة من {group.startIndex + 1} إلى {group.endIndex + 1}
                      <span className="badge badge-primary" style={{ marginRight: '0.5rem' }}>
                        {group.endIndex - group.startIndex + 1} سؤال
                      </span>
                    </div>
                  </div>
                </div>
                {idx === likertGroups.length - 1 && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleRemoveLastGroup}
                  >
                    ✕ حذف
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add New Group */}
        {!isAllQuestionsAssigned && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', border: '1px solid var(--border-default)' }}>
            <div style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
              ➕ إضافة مجموعة جديدة
            </div>

            <div className="config-row">
              <label>اسم المجموعة:</label>
              <input
                type="text"
                className="form-input"
                value={newGroupName}
                onChange={(e) => { setNewGroupName(e.target.value); setNameAutoFilled(false); }}
                placeholder={`المجموعة ${likertGroups.length + 1}`}
                style={{ minWidth: 200, flex: 1 }}
              />
              {nameAutoFilled && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-400)', whiteSpace: 'nowrap' }}>
                  ✨ مستخلص تلقائياً
                </span>
              )}
            </div>

            <div className="config-row">
              <label>من السؤال:</label>
              <div style={{ 
                padding: '0.5rem 1rem', 
                background: 'var(--bg-elevated)', 
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                color: 'var(--primary-300)',
                border: '1px solid var(--border-subtle)'
              }}>
                {nextLikertStart + 1}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                  (تلقائي)
                </span>
              </div>

              <label>إلى السؤال:</label>
              <select
                className="form-select"
                value={newGroupEnd}
                onChange={(e) => setNewGroupEnd(Number(e.target.value))}
                style={{ minWidth: 300 }}
              >
                <option value="">اختر...</option>
                {surveyData.headers.map((header, idx) => (
                  idx >= nextLikertStart ? (
                    <option key={idx} value={idx}>
                      {idx + 1}. {header.length > 50 ? header.substring(0, 50) + '...' : header}
                    </option>
                  ) : null
                ))}
              </select>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddGroup}
                disabled={newGroupEnd === '' || (typeof newGroupEnd === 'number' && newGroupEnd < nextLikertStart)}
              >
                ✓ إضافة
              </button>
            </div>

            {/* Preview the questions that will be in this group */}
            {typeof newGroupEnd === 'number' && newGroupEnd >= nextLikertStart && (
              <div className="question-preview" style={{ marginTop: '1rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
                  معاينة أسئلة المجموعة ({newGroupEnd - nextLikertStart + 1} سؤال):
                </div>
                {surveyData.headers.slice(nextLikertStart, newGroupEnd + 1).map((header, idx) => (
                  <div key={idx} className="question-preview-item highlighted">
                    <span className="question-preview-number">{nextLikertStart + idx + 1}</span>
                    <span className="question-preview-text">{header}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isAllQuestionsAssigned && (
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>
            <span>تم تخصيص كافة الأسئلة بنجاح! يمكنك المتابعة.</span>
          </div>
        )}

        {!isAllQuestionsAssigned && likertGroups.length > 0 && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <span className="alert-icon">ℹ️</span>
            <span>
              المتبقي: الأسئلة من {nextLikertStart + 1} إلى {maxIndex + 1} 
              ({maxIndex - nextLikertStart + 1} سؤال)
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="actions-bar">
        <button
          className="btn btn-secondary"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'upload' })}
        >
          ⬅️ السابق
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleProceed}
          disabled={!canProceed}
        >
          {likertGroups.length === 0 ? '✅ بدء التحليل الديموغرافي' : 'التالي: مراجعة إجابات ليكرت ➡️'}
        </button>
      </div>
    </div>
  );
}
