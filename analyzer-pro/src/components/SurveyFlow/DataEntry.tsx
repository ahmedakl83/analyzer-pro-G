import { useState, useMemo } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import { exportSessionToExcel } from '../../utils/excelPort';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { QuestionType } from '../../types/surveyFlow';
import { parseBuffer } from '../../utils/fileParser';

export default function DataEntry() {
  const { state, dispatch } = useSurvey();
  const { activeTemplate, activeSession } = state;

  if (!activeTemplate || !activeSession) {
    return (
      <div className="alert alert-info">
        يرجى اختيار أو استيراد قالب استبيان أولاً من تبويب "إعداد الاستبيان".
      </div>
    );
  }

  const currentForm = activeSession.forms[activeSession.currentFormIndex];
  const questions = useMemo(() => 
    [...activeTemplate.questions].sort((a, b) => a.columnIndex - b.columnIndex),
    [activeTemplate.questions]
  );

  const [saving, setSaving] = useState(false);

  const handleAnswerChange = (questionId: string, value: string) => {
    const updatedForms = [...activeSession.forms];
    updatedForms[activeSession.currentFormIndex] = {
      ...currentForm,
      answers: { ...currentForm.answers, [questionId]: value }
    };

    dispatch({
      type: 'SET_ACTIVE_SESSION',
      payload: { ...activeSession, forms: updatedForms, updatedAt: new Date().toISOString() }
    });
  };

  const handleNextForm = () => {
    if (activeSession.currentFormIndex < activeSession.totalForms - 1) {
      dispatch({
        type: 'SET_ACTIVE_SESSION',
        payload: { ...activeSession, currentFormIndex: activeSession.currentFormIndex + 1 }
      });
    } else {
      // Add new form
      const newFormIndex = activeSession.totalForms;
      dispatch({
        type: 'SET_ACTIVE_SESSION',
        payload: {
          ...activeSession,
          totalForms: newFormIndex + 1,
          currentFormIndex: newFormIndex,
          forms: [...activeSession.forms, { formIndex: newFormIndex, answers: {}, isComplete: false, durationSeconds: 0 }]
        }
      });
    }
  };

  const handlePrevForm = () => {
    if (activeSession.currentFormIndex > 0) {
      dispatch({
        type: 'SET_ACTIVE_SESSION',
        payload: { ...activeSession, currentFormIndex: activeSession.currentFormIndex - 1 }
      });
    }
  };

  const handleExport = async () => {
    try {
      setSaving(true);
      const buffer = await exportSessionToExcel(activeSession, activeTemplate);
      
      const path = await save({
        defaultPath: `${activeSession.name}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });

      if (path) {
        await writeFile(path, new Uint8Array(buffer));
        
        if (confirm("تم حفظ الملف بنجاح. هل تريد البدء في تحليل هذا الملف الآن؟")) {
          try {
            const surveyData = await parseBuffer(buffer, path.split(/[\\/]/).pop() || "survey.xlsx");
            dispatch({ type: 'SET_SURVEY_DATA', payload: surveyData });
            dispatch({ type: 'SET_STEP', payload: 'upload' });
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'analysis' });
          } catch (err: any) {
            alert("حدث خطأ أثناء معالجة الملف للتحليل: " + err.message);
          }
        }
      }
    } catch (err: any) {
      alert("فشل التصدير: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="data-entry">
      <div className="entry-header">
        <div className="session-info">
          <h2>📝 تفريغ البيانات</h2>
          <p>{activeTemplate.name} — استمارة رقم {activeSession.currentFormIndex + 1} من {activeSession.totalForms}</p>
        </div>
        <div className="entry-actions">
          <button className="btn btn-secondary" onClick={handleExport} disabled={saving}>
            {saving ? 'جاري الحفظ...' : '💾 تصدير لـ Excel'}
          </button>
        </div>
      </div>

      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${((activeSession.currentFormIndex + 1) / activeSession.totalForms) * 100}%` }}
        ></div>
      </div>

      <div className="form-container card mt-6">
        <div className="questions-list">
          {questions.map((q) => (
            <div key={q.id} className="question-field">
              <label className="field-label">
                <span className="q-num">{q.columnIndex + 1}.</span> {q.text}
              </label>
              
              {q.questionType === QuestionType.GENERAL ? (
                <textarea 
                  className="input-field"
                  value={currentForm.answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="أدخل النص هنا..."
                />
              ) : (
                <div className="options-grid">
                  {q.answers.map((ans, idx) => {
                    const isSelected = q.questionType === QuestionType.DEMOGRAPHIC_MULTIPLE
                      ? (currentForm.answers[q.id] || '').split(',').includes(ans)
                      : currentForm.answers[q.id] === ans;

                    return (
                      <button
                        key={idx}
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (q.questionType === QuestionType.DEMOGRAPHIC_MULTIPLE) {
                            const current = (currentForm.answers[q.id] || '').split(',').filter(Boolean);
                            const next = current.includes(ans) 
                              ? current.filter(a => a !== ans)
                              : [...current, ans];
                            handleAnswerChange(q.id, next.join(','));
                          } else {
                            handleAnswerChange(q.id, ans);
                          }
                        }}
                      >
                        <span className="option-num">{idx + 1}</span>
                        <span className="option-text">{ans}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="form-footer">
          <button className="btn btn-outline" onClick={handlePrevForm} disabled={activeSession.currentFormIndex === 0}>
            السابق
          </button>
          <div className="form-counter">
            استمارة {activeSession.currentFormIndex + 1}
          </div>
          <button className="btn btn-primary" onClick={handleNextForm}>
            {activeSession.currentFormIndex === activeSession.totalForms - 1 ? '+ استمارة جديدة' : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  );
}
