import { useState, useEffect, useCallback } from 'react';
import { useSurvey, SurveyProvider } from './context/SurveyContext';
import FileUpload from './components/FileUpload/FileUpload';
import QuestionConfig from './components/QuestionConfig/QuestionConfig';
import DemographicReview from './components/DemographicReview/DemographicReview';
import LikertReview from './components/LikertReview/LikertReview';
import AnalysisView from './components/Analysis/AnalysisView';
import type { AppStep, AppTab } from './types/survey';
import './index.css';

const STEPS: { key: AppStep; label: string; icon: string }[] = [
  { key: 'upload', label: 'رفع الملف', icon: '📁' },
  { key: 'configure', label: 'إعداد الأسئلة', icon: '⚙️' },
  { key: 'review-demographics', label: 'مراجعة الديموغرافية', icon: '📋' },
  { key: 'review-likert', label: 'مراجعة ليكرت', icon: '🔍' },
  { key: 'analysis', label: 'عرض النتائج', icon: '📊' },
];



function getStepIndex(step: AppStep): number {
  return STEPS.findIndex(s => s.key === step);
}

function AppContent() {
  const { state, dispatch } = useSurvey();
  const currentStepIndex = getStepIndex(state.currentStep);

  // Theme toggle
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <img src="/favicon.png" alt="Logo" className="app-logo-img" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <div className="app-logo-text">Survey Analyzer Pro</div>
            <div className="app-logo-sub">محلل الاستبيانات الإلكترونية</div>
          </div>
        </div>
        <div className="header-actions">
          {state.surveyData && (
            <span className="badge badge-success">
              📄 {state.surveyData.fileName}
            </span>
          )}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            aria-label="تبديل الوضع"
          >
            <span className={`theme-toggle-icon ${isDark ? 'dark' : 'light'}`}>
              {isDark ? '☀️' : '🌙'}
            </span>
          </button>
        </div>
      </header>



      {/* Stepper */}
      <nav className="stepper">
        {STEPS.map((step, idx) => (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              className={`stepper-item ${
                idx === currentStepIndex ? 'active' :
                idx < currentStepIndex ? 'completed' : ''
              }`}
            >
              <span className="stepper-item-number">
                {idx < currentStepIndex ? '✓' : step.icon}
              </span>
              {step.label}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`stepper-connector ${idx < currentStepIndex ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </nav>

      {/* Loading Overlay */}
      {state.isAnalyzing && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">جاري تحليل البيانات...</div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-content">
        {state.currentStep === 'upload' && <FileUpload />}
        {state.currentStep === 'configure' && <QuestionConfig />}
        {state.currentStep === 'review-demographics' && <DemographicReview />}
        {state.currentStep === 'review-likert' && <LikertReview />}
        {state.currentStep === 'analysis' && <AnalysisView />}
      </main>

      {/* Footer */}
      <footer className="app-footer-bar">
        <div className="footer-app-name">
          Survey Analyzer Pro v1.0 — محلل الاستبيانات الإلكترونية
        </div>
        <div className="footer-developer">
          <span className="footer-dev-label">تطوير:</span>
          <span className="footer-dev-name">Ahmed Akl</span>
          <span className="footer-dev-sep">|</span>
          <span className="footer-dev-company">Classic for Computer Services (CCS)</span>
          <span className="footer-dev-sep">|</span>
          <a href="mailto:ahmedakl.classic@gmail.com" className="footer-dev-link">📧 ahmedakl.classic@gmail.com</a>
          <span className="footer-dev-sep">|</span>
          <a href="https://wa.me/2001008875157" target="_blank" rel="noopener noreferrer" className="footer-dev-link">💬 01008875157</a>
          <span className="footer-dev-sep">|</span>
          <a href="https://maps.app.goo.gl/j2qG5vCzPNtPb9NM8" target="_blank" rel="noopener noreferrer" className="footer-dev-link">📍 الموقع</a>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <SurveyProvider>
      <AppContent />
    </SurveyProvider>
  );
}

export default App;
