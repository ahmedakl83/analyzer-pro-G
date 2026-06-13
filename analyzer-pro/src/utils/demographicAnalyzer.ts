import type {
  SurveyData,
  DemographicRange,
  DemographicResult,
  PairedDemographicResult,
  PairedVariant,
} from '../types/survey';

// ─── Regular Demographic Analysis ────────────────────────────────────────────

export function analyzeDemographics(
  surveyData: SurveyData,
  range: DemographicRange
): DemographicResult[] {
  const results: DemographicResult[] = [];
  const multiSet = new Set(range.multiChoiceQuestions || []);

  for (let i = range.startIndex; i <= range.endIndex; i++) {
    const question = surveyData.headers[i];
    const answers: Record<string, number> = {};
    const isMulti = multiSet.has(i);
    let totalValid = 0;

    // Count occurrences of each answer
    for (const row of surveyData.rows) {
      const cellValue = row[i] ?? '';
      if (cellValue.trim() === '') {
        answers['لا إجابة'] = (answers['لا إجابة'] || 0) + 1;
        totalValid++;
      } else {
        if (isMulti) {
          const parts = cellValue.split(/,|،|-/).map(p => p.trim()).filter(p => p !== '');
          for (const p of parts) {
            answers[p] = (answers[p] || 0) + 1;
            totalValid++;
          }
        } else {
          const val = cellValue.trim();
          answers[val] = (answers[val] || 0) + 1;
          totalValid++;
        }
      }
    }

    // Include zero-frequency answers from custom order
    const customOrder = range.customAnswerOrders?.[i];
    if (customOrder) {
      for (const expected of customOrder) {
        if (!(expected in answers)) {
          answers[expected] = 0;
        }
      }
    }

    // Convert to result format
    const responses = Object.entries(answers).map(([answer, count]) => ({
      answer,
      count,
      percentage: totalValid > 0 ? Math.round((count / totalValid) * 10000) / 100 : 0,
    }));

    if (customOrder) {
      responses.sort((a, b) => {
        const idxA = customOrder.indexOf(a.answer);
        const idxB = customOrder.indexOf(b.answer);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    } else {
      responses.sort((a, b) => b.count - a.count);
    }

    results.push({
      questionIndex: i,
      question,
      responses,
      isMultipleChoice: isMulti,
    });
  }

  return results;
}

// ─── Paired Question Detection ────────────────────────────────────────────────

/**
 * نمط الكشف: نص + مسافة + [بيان] أو (بيان)
 * مثال: "المهنة للوالدين [الأم]" أو "(المستوى التعليمي) (بكالوريوس)"
 */
const PAIRED_PATTERN = /^(.+?)\s*[\[(](.+?)[\])]$/;

interface PairedGroup {
  baseLabel: string;
  /** فهارس الأعمدة المنتمية لهذه المجموعة */
  columnIndices: number[];
  /** البيانات المقابلة لكل فهرس */
  labels: string[];
}

/**
 * يكتشف الأسئلة الديموغرافية المقارنة:
 * أسئلة متتالية تشترك في نفس النص قبل [...] وتختلف في محتوى الأقواس.
 * ترجع قائمة بالمجموعات المكتشفة (كل مجموعة 2+ أسئلة).
 */
export function detectPairedQuestions(
  headers: string[],
  startIndex: number,
  endIndex: number
): PairedGroup[] {
  const groups: PairedGroup[] = [];
  let i = startIndex;

  while (i <= endIndex) {
    const header = headers[i];
    const match = PAIRED_PATTERN.exec(header);

    if (!match) {
      i++;
      continue;
    }

    const base = match[1].trim();
    const label = match[2].trim();

    // ابدأ مجموعة جديدة
    const columnIndices: number[] = [i];
    const labels: string[] = [label];

    // امتد للأمام ما دام التالي يشارك نفس القاعدة
    let j = i + 1;
    while (j <= endIndex) {
      const nextMatch = PAIRED_PATTERN.exec(headers[j]);
      if (nextMatch && nextMatch[1].trim() === base) {
        columnIndices.push(j);
        labels.push(nextMatch[2].trim());
        j++;
      } else {
        break;
      }
    }

    // فقط إذا كانت المجموعة تحتوي على 2+ أسئلة
    if (columnIndices.length >= 2) {
      groups.push({ baseLabel: base, columnIndices, labels });
      i = j; // تخطَّ ما تم تجميعه
    } else {
      i++;
    }
  }

  return groups;
}

/**
 * يحلل الأسئلة الديموغرافية المقارنة ويحسب التكرارات والنسب لكل بيان.
 */
export function analyzePairedDemographics(
  surveyData: SurveyData,
  groups: PairedGroup[]
): PairedDemographicResult[] {
  return groups.map((group) => {
    const variants: PairedVariant[] = group.columnIndices.map((colIdx, vIdx) => {
      const answers: Record<string, number> = {};

      for (const row of surveyData.rows) {
        const answer = row[colIdx] ?? '';
        const key = answer.trim() === '' ? 'لا إجابة' : answer.trim();
        answers[key] = (answers[key] || 0) + 1;
      }

      const total = Object.values(answers).reduce((s, c) => s + c, 0);
      const responses = Object.entries(answers)
        .sort((a, b) => b[1] - a[1])
        .map(([answer, count]) => ({
          answer,
          count,
          percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        }));

      return { label: group.labels[vIdx], responses };
    });

    return {
      baseLabel: group.baseLabel,
      firstQuestionIndex: group.columnIndices[0],
      columnIndices: group.columnIndices,
      variants,
    };
  });
}

/**
 * يُرجع مجموعة فهارس الأعمدة التي تنتمي لأسئلة مقارنة (لاستبعادها من الجداول الفردية).
 */
export function getPairedColumnIndices(groups: PairedGroup[]): Set<number> {
  const set = new Set<number>();
  for (const g of groups) g.columnIndices.forEach((idx) => set.add(idx));
  return set;
}

