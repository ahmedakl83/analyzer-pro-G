# flexible-survey-analysis Bugfix Design

## Overview

يعاني التطبيق من أربع مشكلات مترابطة:

1. **زر "بدء التحليل" معطّل** — المنطق الحالي في `canProceed` يشترط تغطية جميع الأعمدة، مما يمنع تحليل مجموعة فرعية من الأسئلة.
2. **فشل التصدير عند الاستبيان الديموغرافي البحت** — `saveBrowser` تستدعي `buildSummarySheet` التي تعتمد على `likertResults`، لكن لا يوجد حارس يمنع التصدير عند كون القائمتين غير فارغتين معاً.
3. **الأعمدة الفارغة توقف التصدير** — `buildDemographicSheet` لا تتعامل مع حالة `responses.length === 0`، مما قد يُنتج صفوفاً غير صحيحة أو يرمي استثناء.
4. **غياب الرسم البياني** — لا توجد أي رسوم بيانية في أوراق التصدير حالياً.

استراتيجية الإصلاح: تعديلات جراحية دقيقة في ملفين فقط (`QuestionConfig.tsx` و `exportUtils.ts`) مع الحفاظ على السلوك الحالي لجميع الحالات الأخرى.

---

## Glossary

- **Bug_Condition (C)**: الشرط الذي يُفعّل الخلل — وصف دقيق للمدخلات التي تُظهر السلوك الخاطئ
- **Property (P)**: السلوك الصحيح المتوقع عند تحقق شرط الخلل
- **Preservation**: السلوك الحالي الصحيح الذي يجب ألا يتغير بعد الإصلاح
- **canProceed**: المتغير المنطقي في `QuestionConfig.tsx` الذي يتحكم في تفعيل زر "بدء التحليل"
- **buildDemographicSheet**: الدالة في `exportUtils.ts` التي تبني ورقة Excel لسؤال ديموغرافي واحد
- **buildLikertSheet**: الدالة في `exportUtils.ts` التي تبني ورقة Excel لمجموعة ليكرت
- **saveBrowser**: الدالة الرئيسية للتصدير في بيئة المتصفح
- **demographicResults**: مصفوفة نتائج الأسئلة الديموغرافية (قد تكون فارغة)
- **likertResults**: مصفوفة نتائج مجموعات ليكرت (قد تكون فارغة)

---

## Bug Details

### Bug Condition

تتجلى المشكلات الأربع في حالات مدخلات محددة:

**الخلل 1 — زر "بدء التحليل":**
```
FUNCTION isBugCondition_Button(state)
  INPUT: state يحتوي على demoEnd, maxIndex, likertGroups
  OUTPUT: boolean

  hasDemoQuestions  := demoEnd >= 0
  hasLikertGroups   := likertGroups.length > 0
  hasAnySelection   := hasDemoQuestions OR hasLikertGroups
  allCovered        := isDemoOnly OR (likertGroups.last.endIndex >= maxIndex)

  RETURN hasAnySelection AND NOT allCovered
  -- الزر معطّل رغم وجود اختيار جزئي صالح
END FUNCTION
```

**الخلل 2 — تصدير ديموغرافي بحت:**
```
FUNCTION isBugCondition_Export(inputs)
  INPUT: demographicResults, likertResults
  OUTPUT: boolean

  RETURN demographicResults.length > 0
         AND likertResults.length = 0
         -- التصدير يفشل أو ينتج ملفاً ناقصاً
END FUNCTION
```

**الخلل 3 — عمود فارغ:**
```
FUNCTION isBugCondition_EmptyColumn(result)
  INPUT: DemographicResult
  OUTPUT: boolean

  RETURN result.responses.length = 0
         -- buildDemographicSheet لا تتعامل مع هذه الحالة
END FUNCTION
```

**الخلل 4 — غياب الرسم البياني:**
```
FUNCTION isBugCondition_NoChart(sheet)
  INPUT: ExcelJS.Worksheet
  OUTPUT: boolean

  RETURN sheet.charts = undefined OR sheet.charts.length = 0
END FUNCTION
```

### Examples

- **الخلل 1**: استبيان بـ 10 أعمدة، المستخدم يختار الأعمدة 1-3 ديموغرافية فقط → `canProceed = false` رغم وجود اختيار صالح
- **الخلل 2**: استبيان ديموغرافي بحت (5 أسئلة، لا ليكرت) → التصدير يفشل أو ينتج ملفاً فارغاً
- **الخلل 3**: عمود "الجنس" لا يحتوي على أي إجابات → `buildDemographicSheet` تُنتج صفاً بإجمالي 0 لكن قد يرمي استثناء عند حساب النسب
- **الخلل 4**: أي ورقة تصدير ناتجة → لا يوجد رسم بياني

---

## Expected Behavior

### Preservation Requirements

**السلوكيات التي يجب ألا تتغير:**
- تصدير الاستبيانات المختلطة (ديموغرافي + ليكرت) يجب أن يستمر بنفس الطريقة
- تصدير الاستبيانات التي تحتوي على ليكرت فقط يجب أن يستمر بنفس الطريقة
- الأعمدة التي تحتوي على إجابات صحيحة يجب أن تُحلَّل وتُصدَّر بنفس النتائج
- الزر يجب أن يظل معطّلاً عند عدم اختيار أي سؤال (صفر ديموغرافي + صفر ليكرت)
- منطق `inferGroupName` واستخلاص اسم المجموعة تلقائياً يجب أن يستمر كما هو
- التعقيبات التحليلية في أوراق التصدير يجب أن تستمر كما هي

**النطاق:**
جميع المدخلات التي لا تنطبق عليها شروط الخلل يجب أن تبقى غير متأثرة بالإصلاح.

---

## Hypothesized Root Cause

### الخلل 1 — زر "بدء التحليل"

**السبب المرجّح**: المتغير `canProceed` يشترط `isAllQuestionsAssigned` وهو يتطلب تغطية جميع الأعمدة:

```typescript
// الكود الحالي (خاطئ)
const canProceed = isDemoOnly || (likertGroups.length > 0 && isAllQuestionsAssigned);
```

المشكلة: لا يوجد مسار يسمح بالمتابعة عند اختيار مجموعة فرعية فقط من الأسئلة (مثلاً: ديموغرافي فقط دون تغطية كل الأعمدة).

### الخلل 2 — تصدير ديموغرافي بحت

**السبب المرجّح**: `saveBrowser` تستدعي `buildSummarySheet` دائماً، وهذه الدالة تعمل بشكل صحيح. لكن المشكلة قد تكون في `saveTauri` التي ترسل `likert: []` إلى الـ Rust backend الذي قد لا يتعامل مع هذه الحالة. في المتصفح، قد تكون المشكلة في `generateOverallCommentary` عند استدعائها بـ `likertResults = []`.

### الخلل 3 — عمود فارغ

**السبب المرجّح**: في `buildDemographicSheet`، عند `result.responses.length === 0`:
- حلقة `for (const r of result.responses)` لا تُضيف أي صفوف
- `result.responses.reduce(...)` تُعيد 0 (صحيح)
- لكن قد يكون هناك مشكلة في `generateDemographicCommentary` عند استدعائها بـ responses فارغة

### الخلل 4 — غياب الرسم البياني

**السبب المرجّح**: لم يُنفَّذ هذا الميزة أصلاً. ExcelJS يدعم إضافة الرسوم البيانية عبر `ws.addChart()`.

---

## Correctness Properties

Property 1: Bug Condition - تفعيل الزر بمجرد وجود اختيار واحد

_For any_ حالة تطبيق يكون فيها المستخدم قد اختار سؤالاً ديموغرافياً واحداً على الأقل أو أضاف مجموعة ليكرت واحدة على الأقل، يجب أن تكون قيمة `canProceed` مساوية لـ `true` بغض النظر عن تغطية باقي الأعمدة.

**Validates: Requirements 2.2**

Property 2: Bug Condition - نجاح التصدير للاستبيان الديموغرافي البحت

_For any_ استدعاء لـ `exportAllToXlsx` حيث `demographicResults.length > 0` و `likertResults.length === 0`، يجب أن تنجح العملية دون رمي استثناء وأن ينتج ملف Excel يحتوي على ورقة لكل سؤال ديموغرافي وورقة الملخص التنفيذي.

**Validates: Requirements 2.1**

Property 3: Bug Condition - تصدير الأعمدة الفارغة بدون أخطاء

_For any_ `DemographicResult` تكون فيها `responses` فارغة (لا إجابات)، يجب أن تنجح `buildDemographicSheet` دون استثناء وأن تُنتج ورقة تحتوي على صف الإجمالي بقيمة 0.

**Validates: Requirements 2.3**

Property 4: Bug Condition - وجود رسم بياني في كل ورقة تصدير

_For any_ ورقة تصدير ناتجة (ديموغرافية أو ليكرت)، يجب أن تحتوي على رسم بياني عمودي (Bar Chart) يأخذ بياناته من العمود الأول (العبارات) والعمود الثالث (النسبة المئوية).

**Validates: Requirements 2.4**

Property 5: Preservation - السلوك الحالي للاستبيانات المختلطة

_For any_ استدعاء لـ `exportAllToXlsx` حيث `demographicResults.length > 0` و `likertResults.length > 0`، يجب أن تنتج نفس البنية والمحتوى الذي كانت تنتجه قبل الإصلاح (مع إضافة الرسوم البيانية فقط).

**Validates: Requirements 3.1, 3.3**

Property 6: Preservation - الزر معطّل عند عدم الاختيار

_For any_ حالة تطبيق لم يختر فيها المستخدم أي سؤال ديموغرافي ولم يضف أي مجموعة ليكرت، يجب أن تكون قيمة `canProceed` مساوية لـ `false`.

**Validates: Requirements 3.4**

---

## Fix Implementation

### Changes Required

#### الملف 1: `analyzer-pro/src/components/QuestionConfig/QuestionConfig.tsx`

**الدالة**: `canProceed` (السطر الأخير قبل `return`)

**التغيير المطلوب**:
```typescript
// قبل الإصلاح
const canProceed = isDemoOnly || (likertGroups.length > 0 && isAllQuestionsAssigned);

// بعد الإصلاح
const hasDemoSelection = demoEnd >= demoStart; // دائماً صحيح إذا اختار المستخدم نطاقاً
const hasAnySelection = hasDemoSelection || likertGroups.length > 0;
const canProceed = hasAnySelection;
```

**ملاحظة**: يجب أيضاً تعديل `handleProceed` للتعامل مع الحالة الجديدة حيث يمكن المتابعة بمجموعة فرعية من الأسئلة دون تغطية الكل.

#### الملف 2: `analyzer-pro/src/utils/exportUtils.ts`

**التغيير 1 — إصلاح الخلل 2 (ديموغرافي بحت)**:
- التحقق من أن `saveBrowser` تعمل بشكل صحيح عند `likertResults = []`
- التحقق من `generateOverallCommentary` عند استدعائها بـ `likertResults = []`
- إضافة حارس في `saveTauri` إذا لزم الأمر

**التغيير 2 — إصلاح الخلل 3 (أعمدة فارغة)**:
في `buildDemographicSheet`، إضافة معالجة صريحة لحالة `responses.length === 0`:
```typescript
if (result.responses.length === 0) {
  ws.addRow(['لا توجد إجابات', 0, '0%']);
}
```

**التغيير 3 — إضافة الرسم البياني (الخلل 4)**:
إضافة دالة مساعدة `addBarChart` تُضاف في نهاية `buildDemographicSheet` و `buildLikertSheet`:
```typescript
function addBarChart(ws: ExcelJS.Worksheet, dataStartRow: number, dataEndRow: number): void {
  // إضافة Bar Chart يأخذ بياناته من العمود 1 (العبارات) والعمود 3 (النسبة المئوية)
  const chart = wb.addChart({ type: 'bar', ... });
  // ...
}
```

---

## Testing Strategy

### Validation Approach

نتبع نهجاً ثنائي المرحلة: أولاً نكتب اختبارات تُظهر الخلل على الكود غير المُصلَح، ثم نتحقق من الإصلاح والحفاظ على السلوك الحالي.

### Exploratory Bug Condition Checking

**الهدف**: إظهار الأخطاء على الكود الحالي قبل الإصلاح.

**خطة الاختبار**: كتابة اختبارات وحدة تستدعي الدوال مباشرة بمدخلات تُفعّل شروط الخلل.

**حالات الاختبار**:
1. **اختبار الزر**: إنشاء حالة تطبيق بـ `demoEnd = 2` و `maxIndex = 9` و `likertGroups = []` → التحقق من أن `canProceed = false` (سيفشل بعد الإصلاح)
2. **اختبار التصدير الديموغرافي**: استدعاء `exportAllToXlsx` بـ `demographicResults = [...]` و `likertResults = []` → التحقق من نجاح العملية
3. **اختبار العمود الفارغ**: استدعاء `buildDemographicSheet` بـ `result.responses = []` → التحقق من عدم رمي استثناء
4. **اختبار الرسم البياني**: التحقق من وجود chart في الورقة الناتجة

**الأخطاء المتوقعة**:
- الاختبار 1: `canProceed = false` رغم وجود اختيار ديموغرافي
- الاختبار 2: استثناء أو ملف فارغ
- الاختبار 3: استثناء أو صف إجمالي خاطئ
- الاختبار 4: لا يوجد chart

### Fix Checking

**الهدف**: التحقق من أن الإصلاح يعمل لجميع المدخلات التي تُفعّل شروط الخلل.

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition_Button(state) DO
  result := computeCanProceed(state)
  ASSERT result = true
END FOR

FOR ALL inputs WHERE isBugCondition_Export(inputs) DO
  result := exportAllToXlsx(inputs.demographic, [])
  ASSERT NOT throws(result)
  ASSERT result.sheets.length >= inputs.demographic.length + 1
END FOR

FOR ALL result WHERE isBugCondition_EmptyColumn(result) DO
  sheet := buildDemographicSheet(result)
  ASSERT NOT throws(sheet)
  ASSERT sheet.totalRow.count = 0
END FOR
```

### Preservation Checking

**الهدف**: التحقق من أن السلوك الحالي الصحيح لم يتغير.

**Pseudocode:**
```
FOR ALL inputs WHERE NOT isBugCondition_Export(inputs) DO
  result_before := exportAllToXlsx_original(inputs)
  result_after  := exportAllToXlsx_fixed(inputs)
  ASSERT structure(result_before) = structure(result_after)
  -- مع السماح بإضافة charts جديدة
END FOR

FOR ALL state WHERE NOT isBugCondition_Button(state) AND hasNoSelection(state) DO
  ASSERT computeCanProceed(state) = false
END FOR
```

**نهج الاختبار**: يُوصى باستخدام Property-Based Testing لأنه يولّد حالات اختبار متعددة تلقائياً عبر نطاق المدخلات.

**حالات الاختبار**:
1. **Preservation — استبيان مختلط**: التحقق من أن الاستبيانات التي تحتوي على ديموغرافي + ليكرت تُصدَّر بنفس البنية
2. **Preservation — ليكرت فقط**: التحقق من أن الاستبيانات التي تحتوي على ليكرت فقط تُصدَّر بشكل صحيح
3. **Preservation — الزر معطّل عند عدم الاختيار**: التحقق من أن `canProceed = false` عند `demoEnd < demoStart` و `likertGroups = []`

### Unit Tests

- اختبار `canProceed` بحالات مختلفة: اختيار جزئي، اختيار كامل، لا اختيار
- اختبار `buildDemographicSheet` بـ responses فارغة وغير فارغة
- اختبار `buildLikertSheet` بمجموعات ليكرت مختلفة
- اختبار `exportAllToXlsx` بـ `likertResults = []`

### Property-Based Tests

- توليد `DemographicResult[]` عشوائية والتحقق من نجاح التصدير دائماً
- توليد حالات تطبيق عشوائية والتحقق من أن `canProceed` يتبع المنطق الصحيح
- توليد `responses` فارغة وغير فارغة والتحقق من سلامة `buildDemographicSheet`

### Integration Tests

- تحميل ملف CSV ديموغرافي بحت والمرور بالتدفق الكامل حتى التصدير
- تحميل ملف CSV يحتوي على عمود فارغ والتحقق من نجاح التصدير
- التحقق من وجود الرسوم البيانية في الملف المُصدَّر
- التحقق من أن الاستبيانات المختلطة تُصدَّر بنفس الجودة السابقة
