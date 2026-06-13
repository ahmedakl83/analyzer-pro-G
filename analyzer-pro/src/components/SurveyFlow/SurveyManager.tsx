import { useState } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import { importTemplateFromExcel } from '../../utils/excelPort';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

export default function SurveyManager() {
  const { state, dispatch } = useSurvey();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarnings([]);

      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });

      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      const fileData = await readFile(path);
      
      const { template, warnings: importWarnings } = await importTemplateFromExcel(fileData.buffer, path);
      
      dispatch({ type: 'SET_ACTIVE_TEMPLATE', payload: template });
      setWarnings(importWarnings);
      
      // Auto-create a session if none exists
      if (!state.activeSession || state.activeSession.templateId !== template.id) {
         dispatch({
           type: 'SET_ACTIVE_SESSION',
           payload: {
             id: crypto.randomUUID(),
             templateId: template.id,
             name: `جلسة - ${template.name}`,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
             totalForms: 1, // Start with 1
             currentFormIndex: 0,
             currentQuestionIndex: 0,
             forms: [{ formIndex: 0, answers: {}, isComplete: false, durationSeconds: 0 }]
           }
         });
      }

    } catch (err: any) {
      setError(err.message || "فشل استيراد القالب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="survey-manager">
      <div className="section-header">
        <h2>📁 إعداد الاستبيان</h2>
        <p className="subtitle">قم باستيراد قالب الاستبيان من ملف Excel للبدء في عملية التفريغ</p>
      </div>

      <div className="manager-actions">
        <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
          {loading ? 'جاري الاستيراد...' : '📥 استيراد قالب من Excel'}
        </button>
      </div>

      {error && <div className="alert alert-error mt-4">{error}</div>}
      
      {warnings.length > 0 && (
        <div className="alert alert-warning mt-4">
          <strong>تنبيهات الاستيراد:</strong>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {state.activeTemplate && (
        <div className="template-info card mt-6">
          <div className="card-header">
            <h3>قالب نشط: {state.activeTemplate.name}</h3>
            <span className="badge badge-info">{state.activeTemplate.questionCount} سؤال</span>
          </div>
          <div className="card-body">
             <div className="questions-summary">
               <p><strong>تاريخ الإنشاء:</strong> {new Date(state.activeTemplate.createdAt).toLocaleString('ar-EG')}</p>
               <div className="questions-grid mt-4">
                 {state.activeTemplate.questions.map((q) => (
                   <div key={q.id} className="question-item">
                     <span className="q-index">#{q.columnIndex + 1}</span>
                     <span className="q-text">{q.text}</span>
                     <span className={`q-type type-${q.questionType}`}>
                       {q.questionType === 0 ? 'عام' : q.questionType === 3 ? 'ليكرت' : 'ديموغرافي'}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
          </div>
          <div className="card-footer">
            <button 
              className="btn btn-success w-full"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'entry' })}
            >
              الذهاب إلى تفريغ البيانات ⮕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
