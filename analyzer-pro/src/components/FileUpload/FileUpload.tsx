import { useCallback, useRef, useState } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import { parseFile } from '../../utils/fileParser';

export default function FileUpload() {
  const { state, dispatch } = useSurvey();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setError('صيغة الملف غير مدعومة. الصيغ المدعومة: CSV, XLSX, XLS');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const surveyData = await parseFile(file);
      dispatch({ type: 'SET_SURVEY_DATA', payload: surveyData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء قراءة الملف');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [dispatch]);

  if (isLoading) {
    return (
      <div className="card fade-in">
        <div className="loading-overlay" style={{ position: 'relative', minHeight: 300, background: 'transparent' }}>
          <div className="loading-spinner"></div>
          <div className="loading-text">جاري تحليل الملف...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h2 className="card-title">📁 رفع ملف الاستبيان</h2>
        <p className="card-subtitle">قم برفع ملف نتائج الاستبيان من Google Forms (CSV أو Excel)</p>
      </div>

      {!state.surveyData ? (
        <>
          <div
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <span className="upload-icon">📊</span>
            <h3 className="upload-title">اسحب الملف هنا أو انقر للاختيار</h3>
            <p className="upload-desc">يدعم ملفات Google Forms المُصدّرة</p>
            <div className="upload-formats">
              <span className="format-badge">CSV</span>
              <span className="format-badge">XLSX</span>
              <span className="format-badge">XLS</span>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </>
      ) : (
        <>
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>
            <span>تم تحميل الملف بنجاح: <strong>{state.surveyData.fileName}</strong></span>
          </div>

          <div className="toggle-container" style={{ margin: '1rem 0' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={state.isGroupSurvey}
                onChange={(e) => dispatch({ type: 'SET_GROUP_SURVEY', payload: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
            <div className="toggle-label">
              <div className="toggle-title">استبيان مجمع (Group Survey)</div>
              <div className="toggle-desc">تفعيل هذا الخيار لتحليل ملف يحتوي على عدة مستخدمين</div>
            </div>
          </div>

          <div className="toggle-container" style={{ margin: '1rem 0' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={state.includeLevelTables}
                onChange={(e) => dispatch({ type: 'SET_INCLUDE_LEVEL_TABLES', payload: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
            <div className="toggle-label">
              <div className="toggle-title">تضمين جداول المستويات</div>
              <div className="toggle-desc">إظهار جداول المتوسطات الحسابية وتصنيف المستويات في التقرير</div>
            </div>
          </div>

          <div className="file-info">
            <div className="file-info-item">
              <div className="file-info-icon">📋</div>
              <div className="file-info-value">{state.surveyData.totalQuestions}</div>
              <div className="file-info-label">عدد الأسئلة (الأعمدة)</div>
            </div>
            <div className="file-info-item">
              <div className="file-info-icon">👥</div>
              <div className="file-info-value">{state.surveyData.totalResponses}</div>
              <div className="file-info-label">عدد الإجابات (الصفوف)</div>
            </div>
            <div className="file-info-item">
              <div className="file-info-icon">📄</div>
              <div className="file-info-value">{state.surveyData.fileName.split('.').pop()?.toUpperCase()}</div>
              <div className="file-info-label">نوع الملف</div>
            </div>
          </div>

          <div className="question-preview" style={{ marginTop: '1.5rem' }}>
            <div style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
              معاينة الأسئلة:
            </div>
            {state.surveyData.headers.map((header, index) => (
              <div key={index} className="question-preview-item">
                <span className="question-preview-number">{index + 1}</span>
                <span className="question-preview-text">{header}</span>
              </div>
            ))}
          </div>

          {state.isGroupSurvey && (
            <div className="fade-in" style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: 'var(--primary-300)', fontSize: '0.95rem' }}>
                📌 إعداد وضع الاستبيان الجماعي
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                <label style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  اختر العمود الذي يحتوي على اسم / معرف المستخدم:
                </label>
                <select
                  className="form-select"
                  value={state.groupUserIdColumnIndex ?? ''}
                  onChange={(e) => dispatch({ type: 'SET_GROUP_USER_COLUMN', payload: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ maxWidth: '500px', fontSize: '0.95rem' }}
                >
                  <option value="">-- يرجى الاختيار --</option>
                  {state.surveyData.headers.map((header, index) => (
                    <option key={index} value={index}>
                      {index + 1}. {header}
                    </option>
                  ))}
                </select>
                {state.groupUserIdColumnIndex === null && (
                  <span style={{ color: 'var(--error-500)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    * يجب اختيار عمود للمتابعة
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="actions-bar">
            <button className="btn btn-secondary" onClick={handleReset}>
              🔄 رفع ملف آخر
            </button>
            <button 
              className="btn btn-primary btn-lg"
              disabled={state.isGroupSurvey && state.groupUserIdColumnIndex === null}
              onClick={() => dispatch({ type: 'SET_STEP', payload: 'configure' })}
            >
              التالي: إعداد الأسئلة ➡️
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
