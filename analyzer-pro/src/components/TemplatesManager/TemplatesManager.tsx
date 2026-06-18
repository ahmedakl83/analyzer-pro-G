import { useState, useEffect } from 'react';
import { getTemplates, deleteTemplate, exportTemplatesToFile, importTemplatesFromFile } from '../../utils/templateManager';
import type { AnalysisTemplate } from '../../types/survey';
import './TemplatesManager.css';

interface TemplatesManagerProps {
  onClose: () => void;
}

export default function TemplatesManager({ onClose }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القالب؟')) {
      deleteTemplate(id);
      setTemplates(getTemplates());
      setMessage({ type: 'success', text: 'تم حذف القالب بنجاح.' });
    }
  };

  const handleExport = () => {
    if (templates.length === 0) {
      setMessage({ type: 'error', text: 'لا يوجد قوالب لتصديرها.' });
      return;
    }
    exportTemplatesToFile();
    setMessage({ type: 'success', text: 'تم تصدير القوالب بنجاح.' });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const addedCount = await importTemplatesFromFile(file);
      setTemplates(getTemplates());
      setMessage({ type: 'success', text: `تم استيراد ${addedCount} قالب جديد بنجاح.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'حدث خطأ أثناء قراءة ملف القوالب. تأكد من صحة الملف.' });
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content fade-in" style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="modal-header">
          <h2>⚙️ إدارة قوالب الإعدادات</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            يمكنك هنا إدارة القوالب المحفوظة التي تحتوي على إعدادات التحليل، لتتمكن من استخدامها وتصديرها للأجهزة الأخرى.
          </p>

          {message && (
            <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
              {message.text}
            </div>
          )}

          <div className="actions-bar" style={{ justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={handleExport} disabled={templates.length === 0}>
              📤 تصدير القوالب
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
              📥 استيراد قوالب
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          </div>

          <div className="templates-list">
            {templates.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                لا توجد قوالب محفوظة حالياً.
              </div>
            ) : (
              templates.map(t => (
                <div key={t.id} className="template-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--primary-300)' }}>{t.name}</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      متوافق مع استبيان يحتوي على {t.headers.length} سؤال
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>
                    🗑️ حذف
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
