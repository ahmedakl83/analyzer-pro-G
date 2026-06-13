import React, { useState, useCallback } from 'react';
import { useSurvey } from '../../context/SurveyContext';
import { exportToDocx } from '../../utils/docxExporter';
import { exportGroupToZip } from '../../utils/zipExporter';
import {
  generateDemographicCommentary,
  generateAdvancedDemographicCommentary,
  generateLikertCommentary,
  generateAdvancedLikertCommentary,
  generateComparativeLikertCommentary,
  generateOverallCommentary,
} from '../../utils/commentaryUtils';
import type { DemographicResult, PairedDemographicResult } from '../../types/survey';

// ─── Paired Demographic Table ──────────────────────────────────────────────────

function PairedDemographicTable({
  result,
  questionNumber,
}: {
  result: PairedDemographicResult;
  questionNumber: number;
}) {
  // جمع كل الإجابات الممكنة من جميع البيانات
  const allAnswers = Array.from(
    new Set(result.variants.flatMap((v) => v.responses.map((r) => r.answer)))
  );
  // ترتيب الإجابات: الأعلى تكراراً أولاً (مجموع عبر جميع البيانات)
  const totalPerAnswer: Record<string, number> = {};
  for (const ans of allAnswers) {
    totalPerAnswer[ans] = result.variants.reduce((sum, v) => {
      const r = v.responses.find((r) => r.answer === ans);
      return sum + (r?.count ?? 0);
    }, 0);
  }
  allAnswers.sort((a, b) => (totalPerAnswer[b] ?? 0) - (totalPerAnswer[a] ?? 0));

  const variantColors = [
    'var(--primary-400)',
    'var(--accent-400)',
    '#f59e0b',
    '#a78bfa',
    '#34d399',
  ];

  return (
    <div className="card analysis-section">
      <div className="analysis-question-title">
        سؤال {questionNumber}: {result.baseLabel}
        <span
          className="badge badge-primary"
          style={{ marginRight: '0.75rem', fontSize: '0.75rem' }}
        >
          🔗 مقارن ({result.variants.length} بيانات)
        </span>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            {/* الصف الأول: اسم البيان مدمج لعمودين */}
            <tr>
              <th rowSpan={2} style={{ verticalAlign: 'middle', minWidth: 160 }}>
                الإجابات
              </th>
              {result.variants.map((v, vIdx) => (
                <th
                  key={vIdx}
                  colSpan={2}
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                    color: variantColors[vIdx % variantColors.length],
                  }}
                >
                  {v.label}
                </th>
              ))}
            </tr>
            {/* الصف الثاني: ت / % لكل بيان */}
            <tr>
              {result.variants.map((_, vIdx) => (
                <React.Fragment key={`sub-${vIdx}`}>
                  <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ت</th>
                  <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>%</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {allAnswers.map((answer, aIdx) => (
              <tr key={aIdx}>
                <td style={{ textAlign: 'right' }}>{answer}</td>
                {result.variants.map((v, vIdx) => {
                  const r = v.responses.find((r) => r.answer === answer);
                  return (
                    <React.Fragment key={`v-${vIdx}`}>
                      <td style={{ fontWeight: 600 }}>{r?.count ?? 0}</td>
                      <td style={{ color: variantColors[vIdx % variantColors.length] }}>
                        {r ? `${r.percentage}%` : '0%'}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {/* صف الإجمالي */}
            <tr style={{ fontWeight: 700, background: 'var(--bg-elevated)' }}>
              <td style={{ textAlign: 'right' }}>الإجمالي</td>
              {result.variants.map((v, vIdx) => {
                const total = v.responses.reduce((s, r) => s + r.count, 0);
                return (
                  <React.Fragment key={`total-${vIdx}`}>
                    <td>{total}</td>
                    <td>100%</td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Analysis View ────────────────────────────────────────────────────────

export default function AnalysisView() {
  const { state, dispatch } = useSurvey();
  const { demographicResults, pairedDemographicResults, likertResults } = state;
  const [activeTab, setActiveTab] = useState<'demographic' | 'likert'>('demographic');
  const [isExporting, setIsExporting] = useState(false);
  const [commentaryMode, setCommentaryMode] = useState<'basic' | 'advanced'>('basic');



  const handleExportDocx = useCallback(async () => {
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 300));
    try {
      if (state.isGroupSurvey && state.groupUserIdColumnIndex !== null && state.surveyData) {
        console.log('Exporting Group Survey to ZIP (DOCX)...');
        await exportGroupToZip(
          state.surveyData,
          state.groupUserIdColumnIndex,
          demographicResults,
          pairedDemographicResults,
          likertResults,
          state.likertGroups,
          state.demographicRange,
          state.likertScale,
          state.includeLevelTables
        );
      } else {
        await exportToDocx(
          demographicResults,
          pairedDemographicResults,
          likertResults,
          state.includeLevelTables,
          'survey_analysis'
        );
      }
    } catch (err) {
      console.error('DOCX export failed:', err);
      alert(`فشل تصدير Word:\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }, [state, demographicResults, pairedDemographicResults, likertResults]);

  const hasDemographic =
    demographicResults.length > 0 || pairedDemographicResults.length > 0;
  const hasLikert = likertResults.length > 0;

  // دمج الأسئلة العادية والمقارنة في قائمة مرتبة حسب فهرس السؤال
  type DemoItem =
    | { kind: 'regular'; data: DemographicResult }
    | { kind: 'paired'; data: PairedDemographicResult };

  const orderedDemographics: DemoItem[] = [
    ...demographicResults.map((d) => ({ kind: 'regular' as const, data: d })),
    ...pairedDemographicResults.map((p) => ({ kind: 'paired' as const, data: p })),
  ].sort((a, b) => {
    const idxA =
      a.kind === 'regular' ? a.data.questionIndex : a.data.firstQuestionIndex;
    const idxB =
      b.kind === 'regular' ? b.data.questionIndex : b.data.firstQuestionIndex;
    return idxA - idxB;
  });

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📊 نتائج التحليل</h2>
          <p className="card-subtitle">عرض وتصدير نتائج تحليل الاستبيان</p>
        </div>

        {/* Tabs */}
        {hasDemographic && hasLikert && (
          <div className="tabs">
            <button
              className={`tab-item ${activeTab === 'demographic' ? 'active' : ''}`}
              onClick={() => setActiveTab('demographic')}
            >
              📋 الأسئلة الديموغرافية ({orderedDemographics.length})
            </button>
            <button
              className={`tab-item ${activeTab === 'likert' ? 'active' : ''}`}
              onClick={() => setActiveTab('likert')}
            >
              📊 أسئلة ليكرت ({likertResults.length} مجموعات)
            </button>
          </div>
        )}

        {/* Export bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportDocx}
            disabled={isExporting}
            title="تصدير ملف Word بالمواصفات الكاملة"
          >
            📄 تصدير Word (DOCX)
          </button>

          {/* Commentary Mode Toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>نمط التعليق:</span>
            <select
              value={commentaryMode}
              onChange={(e) => setCommentaryMode(e.target.value as 'basic' | 'advanced')}
              className="form-select"
              style={{ width: 'auto', fontSize: '0.9rem' }}
            >
              <option value="basic">أساسي</option>
              <option value="advanced">متقدم</option>
            </select>
          </div>
        </div>
      </div>

      {/* Demographic Analysis */}
      {(activeTab === 'demographic' || !hasLikert || isExporting) && hasDemographic && (
        <div className="slide-in">
          {orderedDemographics.map((item, qIdx) => {
            if (item.kind === 'paired') {
              return (
                <PairedDemographicTable
                  key={`paired-${item.data.firstQuestionIndex}`}
                  result={item.data}
                  questionNumber={qIdx + 1}
                />
              );
            }
            const result = item.data;
            return (
              <div key={qIdx} className="card analysis-section">
                <div className="analysis-question-title">
                  سؤال {qIdx + 1}: {result.question}
                </div>

                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الإجابة</th>
                        <th>التكرار</th>
                        <th>النسبة المئوية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.responses.map((resp, rIdx) => (
                        <tr key={rIdx}>
                          <td style={{ textAlign: 'right' }}>{resp.answer}</td>
                          <td>{resp.count}</td>
                          <td>{resp.percentage}%</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, background: 'var(--bg-elevated)' }}>
                        <td style={{ textAlign: 'right' }}>الإجمالي</td>
                        <td>{result.responses.reduce((s, r) => s + r.count, 0)}</td>
                        <td>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="analysis-commentary">
                  <strong>📝 تعقيب تحليلي: </strong>
                  {commentaryMode === 'advanced'
                    ? generateAdvancedDemographicCommentary(result)
                    : generateDemographicCommentary(result)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Likert Analysis */}
      {(activeTab === 'likert' || isExporting) && hasLikert && (
        <div className="slide-in">
          {likertResults.map((group) => (
            <div key={group.groupId} className="card analysis-section">
              <div className="analysis-group-header">
                📊 {group.groupName}
                <span className="badge badge-primary">{group.questions.length} عبارة</span>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ verticalAlign: 'middle' }}>م</th>
                      <th rowSpan={2} style={{ verticalAlign: 'middle', minWidth: 250 }}>
                        العبارة
                      </th>
                      {group.scale.labels.map((label, lIdx) => (
                        <th
                          key={lIdx}
                          colSpan={2}
                          style={{ borderBottom: '1px solid var(--border-default)' }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {group.scale.labels.map((_, lIdx) => (
                        <React.Fragment key={`sub-${lIdx}`}>
                          <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ت</th>
                          <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>%</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.questions.map((q) => (
                      <tr key={q.index}>
                        <td style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                          {q.index}
                        </td>
                        <td style={{ textAlign: 'right', maxWidth: 350 }}>{q.text}</td>
                        {q.responses.map((resp, rIdx) => (
                          <React.Fragment key={`resp-${rIdx}`}>
                            <td style={{ fontWeight: 600 }}>{resp.count}</td>
                            <td style={{ color: 'var(--accent-400)' }}>{resp.percentage}%</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="analysis-commentary">
                <strong>📝 تعقيب تحليلي: </strong>
                {commentaryMode === 'advanced'
                  ? generateAdvancedLikertCommentary(group)
                  : generateLikertCommentary(group)}
              </div>
            </div>
          ))}

          {/* Comparative Analysis */}
          {commentaryMode === 'advanced' && likertResults.length > 1 && (
            <div
              className="card analysis-section"
              style={{ borderRight: '4px solid var(--accent-500)' }}
            >
              <div className="analysis-question-title">📈 التحليل المقارن بين المحاور</div>
              <div
                className="analysis-commentary"
                style={{ marginTop: '0.5rem', border: 'none', background: 'transparent', padding: 0 }}
              >
                {generateComparativeLikertCommentary(likertResults)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* General Commentary */}
      <div className="slide-in">
        <div
          className="card analysis-section"
          style={{ borderRight: '4px solid var(--primary-500)' }}
        >
          <div className="analysis-question-title">💡 الخلاصة العامة للاستبيان</div>
          <div
            className="analysis-commentary"
            style={{ marginTop: '0.5rem', border: 'none', background: 'transparent', padding: 0 }}
          >
            {generateOverallCommentary(demographicResults, likertResults)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="actions-bar" style={{ marginTop: '2rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() =>
            dispatch({ type: 'SET_STEP', payload: hasLikert ? 'review-likert' : 'review-demographics' })
          }
        >
          ⬅️ العودة للإعدادات
        </button>
        <div className="actions-bar-end">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleExportDocx}
            disabled={isExporting}
          >
            {isExporting ? 'جاري التصدير...' : '📄 تصدير جميع النتائج (Word)'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'RESET' })}
          >
            🔄 تحليل استبيان جديد
          </button>
        </div>
      </div>
    </div>
  );
}
