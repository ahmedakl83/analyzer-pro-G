/**
 * surveyClassifier.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * خوارزمية التصنيف التلقائي لهيكلية الاستبيان
 *
 * تحلل قائمة رؤوس الأعمدة وتُصنّفها إلى:
 *   - نطاق ديموغرافي  (Demographic Range)
 *   - مجموعات ليكرت   (Likert Groups)
 *
 * المنطق:
 *   1. الأسئلة الأولى التي لا تشترك في بادئة مشتركة → ديموغرافية
 *   2. كل تسلسل من 3+ أسئلة متتالية تشترك في بادئة > 5 أحرف → مجموعة ليكرت
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { LikertGroup } from '../types/survey';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  /** نطاق الأسئلة الديموغرافية (null إذا لم توجد) */
  demographicRange: { startIndex: number; endIndex: number } | null;
  /** مجموعات ليكرت المكتشفة */
  likertGroups: LikertGroup[];
  /** الأسئلة التي لم تُصنَّف في أي مجموعة */
  unclassifiedRange: { startIndex: number; endIndex: number } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** الحد الأدنى لطول البادئة المشتركة لاعتبارها معرّف مجموعة */
const MIN_PREFIX_LENGTH = 5;

/** الحد الأدنى لعدد الأسئلة المتتالية لتشكيل مجموعة */
const MIN_GROUP_SIZE = 3;

// ─── Core Helpers ─────────────────────────────────────────────────────────────

/**
 * يحسب أطول بادئة مشتركة بين سلسلتين نصيتين
 * مثال: ("أولاً: الرضا - بيئة العمل", "أولاً: الرضا - الراتب") → "أولاً: الرضا"
 */
export function longestCommonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let prefix = a.substring(0, i);

  // إذا كانت إحدى السلسلتين بادئة كاملة للأخرى (i == a.length أو i == b.length)
  // فالبادئة مكتملة ولا داعي لأي قطع إضافي — نُرجعها مباشرة
  if (i === a.length || i === b.length) {
    return prefix.trimEnd();
  }

  // قطع عند آخر مسافة أو فاصل لتجنب قطع الكلمات في المنتصف
  const separators = [' ', '-', '–', ':', '،', ',', '[', '('];

  // إذا كان الحرف التالي في كلتا السلسلتين فاصلاً → لا حاجة للبحث عن فاصل سابق
  if (separators.includes(a[i]) || separators.includes(b[i])) {
    return prefix.trimEnd();
  }

  // توقفنا في منتصف كلمة → ابحث عن آخر فاصل للقطع بشكل نظيف
  const trimmed = prefix.trimEnd();
  if (trimmed.length < prefix.length) {
    return trimmed;
  }

  let lastSep = -1;
  for (let j = prefix.length - 1; j >= 0; j--) {
    if (separators.includes(prefix[j])) { lastSep = j; break; }
  }
  if (lastSep > MIN_PREFIX_LENGTH) {
    return prefix.substring(0, lastSep).trimEnd();
  }

  return prefix;
}

/**
 * يحسب البادئة المشتركة لمجموعة من النصوص
 */
function commonPrefixOfGroup(headers: string[]): string {
  if (headers.length === 0) return '';
  if (headers.length === 1) return headers[0];
  let prefix = headers[0];
  for (let i = 1; i < headers.length; i++) {
    prefix = longestCommonPrefix(prefix, headers[i]);
    if (prefix.length < MIN_PREFIX_LENGTH) return '';
  }
  return prefix;
}

/**
 * يتحقق مما إذا كانت مجموعة من الأسئلة المتتالية تشترك في بادئة كافية
 */
function hasCommonPrefix(headers: string[]): boolean {
  return commonPrefixOfGroup(headers).length >= MIN_PREFIX_LENGTH;
}

/**
 * يُنظّف اسم المجموعة من الفواصل والمسافات الزائدة في النهاية
 */
function cleanGroupName(prefix: string): string {
  return prefix.replace(/[\s\-–:،,]+$/, '').trim();
}

// ─── Main Classifier ──────────────────────────────────────────────────────────

/**
 * الدالة الرئيسية: تصنّف قائمة رؤوس الأعمدة تلقائياً
 *
 * @param headers - قائمة رؤوس الأعمدة من ملف Excel
 * @returns ClassificationResult يحتوي على النطاق الديموغرافي ومجموعات ليكرت
 *
 * @example
 * classifySurveyHeaders([
 *   'العمر', 'الجنس', 'الوظيفة',
 *   'أولاً: الرضا - بيئة العمل',
 *   'أولاً: الرضا - الراتب',
 *   'أولاً: الرضا - المدير',
 *   'ثانياً: الأداء - الإنتاجية',
 *   'ثانياً: الأداء - الجودة',
 *   'ثانياً: الأداء - الالتزام',
 * ])
 * // → { demographicRange: {0,2}, likertGroups: [{أولاً: الرضا, 3,5}, {ثانياً: الأداء, 6,8}] }
 */
export function classifySurveyHeaders(headers: string[]): ClassificationResult {
  if (headers.length === 0) {
    return { demographicRange: null, likertGroups: [], unclassifiedRange: null };
  }

  const n = headers.length;
  const likertGroups: LikertGroup[] = [];

  // ─── الخطوة 1: تحديد نهاية النطاق الديموغرافي ──────────────────────────
  // الأسئلة الديموغرافية هي الأسئلة الأولى التي لا تبدأ مجموعة ليكرت
  // نبحث عن أول موضع تبدأ فيه مجموعة ليكرت (3+ أسئلة بنفس البادئة)
  let demoEndIndex = -1; // -1 يعني لا توجد أسئلة ديموغرافية

  // فحص كل موضع محتمل لبداية مجموعة ليكرت
  let firstGroupStart = n; // افتراضياً لا توجد مجموعات
  const PAIRED_PATTERN = /^(.+?)\s*[\[(](.+?)[\])]$/;

  for (let i = 0; i <= n - MIN_GROUP_SIZE; i++) {
    const window = headers.slice(i, i + MIN_GROUP_SIZE);
    
    // إذا كانت الأسئلة تتبع نمط الأقواس (مقارنة/ديموغرافية مدمجة)، نتخطاها من تصنيف ليكرت
    const isPairedPattern = window.every(h => PAIRED_PATTERN.test(h));
    if (isPairedPattern) continue;

    if (hasCommonPrefix(window)) {
      firstGroupStart = i;
      break;
    }
  }

  if (firstGroupStart > 0) {
    demoEndIndex = firstGroupStart - 1;
  }

  // ─── الخطوة 2: اكتشاف مجموعات ليكرت ────────────────────────────────────
  let cursor = firstGroupStart;

  while (cursor < n) {
    // هل يوجد على الأقل MIN_GROUP_SIZE أسئلة متبقية؟
    if (cursor + MIN_GROUP_SIZE > n) {
      // الأسئلة المتبقية أقل من الحد الأدنى → لا تشكّل مجموعة
      break;
    }

    // اختبر نافذة البداية
    const startWindow = headers.slice(cursor, cursor + MIN_GROUP_SIZE);
    
    // تخطي إذا كانت تتبع نمط الأقواس (ديموغرافية مدمجة)
    if (startWindow.every(h => PAIRED_PATTERN.test(h))) {
      cursor++;
      continue;
    }

    if (!hasCommonPrefix(startWindow)) {
      // لا بادئة مشتركة → هذا السؤال لا ينتمي لمجموعة، تخطَّه
      cursor++;
      continue;
    }

    // وُجدت بادئة → امتد للأمام ما دام السؤال التالي يشارك نفس البادئة
    const groupPrefix = commonPrefixOfGroup(startWindow);
    let groupEnd = cursor + MIN_GROUP_SIZE - 1;

    while (groupEnd + 1 < n) {
      const next = headers[groupEnd + 1];
      const extendedPrefix = longestCommonPrefix(groupPrefix, next);
      if (extendedPrefix.length >= MIN_PREFIX_LENGTH) {
        groupEnd++;
      } else {
        break;
      }
    }

    // أنشئ المجموعة
    const groupName = cleanGroupName(groupPrefix);
    likertGroups.push({
      id: `auto_group_${likertGroups.length + 1}_${Date.now()}`,
      name: groupName,
      startIndex: cursor,
      endIndex: groupEnd,
    });

    cursor = groupEnd + 1;
  }

  // ─── الخطوة 3: تحديد الأسئلة غير المصنّفة ──────────────────────────────
  const lastAssigned = likertGroups.length > 0
    ? likertGroups[likertGroups.length - 1].endIndex
    : demoEndIndex;

  const unclassifiedStart = lastAssigned + 1;
  const unclassifiedRange = unclassifiedStart < n
    ? { startIndex: unclassifiedStart, endIndex: n - 1 }
    : null;

  // ─── النتيجة النهائية ────────────────────────────────────────────────────
  return {
    demographicRange: demoEndIndex >= 0
      ? { startIndex: 0, endIndex: demoEndIndex }
      : null,
    likertGroups,
    unclassifiedRange,
  };
}

// ─── Utility: Confidence Score ────────────────────────────────────────────────

/**
 * يحسب درجة الثقة في نتيجة التصنيف (0–100)
 * تُستخدم لإظهار مؤشر بصري للمستخدم
 */
export function classificationConfidence(
  headers: string[],
  result: ClassificationResult
): number {
  if (headers.length === 0) return 0;

  const classified =
    (result.demographicRange
      ? result.demographicRange.endIndex - result.demographicRange.startIndex + 1
      : 0) +
    result.likertGroups.reduce(
      (sum, g) => sum + (g.endIndex - g.startIndex + 1),
      0
    );

  return Math.round((classified / headers.length) * 100);
}
