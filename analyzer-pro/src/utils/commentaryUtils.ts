import { DemographicResult, LikertGroupResult, PairedDemographicResult } from '../types/survey';
import { TableCommentService } from './tableCommentService';

export function generateDemographicCommentary(result: DemographicResult): string {
  const sorted = [...result.responses].sort((a, b) => b.percentage - a.percentage);
  return TableCommentService.generateGeneralComment(sorted);
}

/**
 * تعقيب على الأسئلة المقارنة (Paired Demographic):
 * قسم لكل بيان — يسرد النسب تنازلياً كما في الأسئلة الديموغرافية العادية.
 * الصيغة:
 *   "يتضح من الجدول (x) أن [البيان الأول]: [سرد النسب].
 *    أما [البيان الثاني]: [سرد النسب]."
 */
export function generatePairedCommentary(
  result: PairedDemographicResult,
  tableNum: number,
  hasChart: boolean
): string {
  if (result.variants.length === 0) return '';

  function toIndic(n: string | number): string {
    const map: Record<string, string> = {
      '0':'٠','1':'١','2':'٢','3':'٣','4':'٤',
      '5':'٥','6':'٦','7':'٧','8':'٨','9':'٩',
    };
    return String(n).replace(/[0-9]/g, (d) => map[d] ?? d);
  }

  const chartRef = hasChart ? `والشكل البياني (${toIndic(tableNum)}) ` : '';
  const parts: string[] = [];

  result.variants.forEach((variant, idx) => {
    const sorted = [...variant.responses].sort((a, b) => b.percentage - a.percentage);
    // نستخدم generateGeneralComment ثم نستخرج الجزء بعد "يتضح من الجدول أن"
    const raw = TableCommentService.generateGeneralComment(sorted);

    // إزالة المقدمة الثابتة لاستخراج متن التعقيب
    const PREFIXES = [
      'يتضح من الجدول أن ',
      'يتضح من الجدول أنه ',
      'أظهرت النتائج ',
      'يستحوذ ',
    ];
    let body = raw.trim();
    for (const p of PREFIXES) {
      if (body.startsWith(p)) { body = body.slice(p.length); break; }
    }
    if (body.startsWith('أن ')) body = body.slice(3);

    if (idx === 0) {
      // القسم الأول: يتضح من الجدول (x) والشكل البياني (x): أن [البيان]: ...
      parts.push(
        `يتضح من الجدول (${toIndic(tableNum)}) ${chartRef}: أن ${variant.label}: ${body}`
      );
    } else {
      // الأقسام التالية: أما [البيان]: ...
      parts.push(`أما ${variant.label}: ${body}`);
    }
  });

  return parts.join('\n');
}

const POSITIVE_WORDS = ['رضا', 'استقرار', 'مهارة', 'جودة', 'كفاءة', 'تفاعل'];
const NEGATIVE_WORDS = ['قلق', 'ضغط', 'تسرب', 'إجهاد', 'توتر', 'سلبي'];

function getLevelArabic(level: string): string {
  if (level === 'High') return 'مرتفع';
  if (level === 'Moderate') return 'متوسط';
  return 'منخفض';
}

export function generateIntelligentSummary(group: LikertGroupResult): string {
  const dimName = group.groupName.toLowerCase();
  const isPositive = POSITIVE_WORDS.some(w => dimName.includes(w));
  const isNegative = NEGATIVE_WORDS.some(w => dimName.includes(w));
  const levelAr = getLevelArabic(group.level);

  let logicSummary = '';
  if (group.level === 'High' && isPositive) {
    logicSummary = `النتائج تشير إلى درجة عالية من (${group.groupName})، مما يعكس حالة إيجابية جداً لدى العينة.`;
  } else if (group.level === 'High' && isNegative) {
    logicSummary = `النتائج تظهر مستوى عالٍ من (${group.groupName})، وهو مؤشر حرج يتطلب الانتباه نظراً لما يعكسه من ضغط سلبي.`;
  } else {
    logicSummary = `قيمة المتوسط الحسابي البالغة (${TableCommentService.toIndic(group.mean.toFixed(2))}) تشير إلى مستوى ${levelAr} من (${group.groupName}).`;
  }

  return `التفسير النوعي: بتحليل البيانات الخاصة بمحور (${group.groupName})، يتضح أن إجابات المشاركين تقع في نطاق المستوى الـ (${levelAr}). وهذا يدل على أن ${logicSummary}`;
}

export function generateLikertCommentary(group: LikertGroupResult): string {
  return TableCommentService.generateGroupComment(group);
}

export function generateOverallCommentary(demographicResults: DemographicResult[], likertResults: LikertGroupResult[]): string {
  return TableCommentService.generateReportSummary(likertResults, demographicResults);
}

export function generateReportSummary(demographicResults: DemographicResult[], likertResults: LikertGroupResult[]): string {
  return TableCommentService.generateReportSummary(likertResults, demographicResults);
}

export function convertToIndicNumbers(input: string | number): string {
  return TableCommentService.toIndic(input);
}
