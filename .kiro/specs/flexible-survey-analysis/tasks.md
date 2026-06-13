# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - تفعيل الزر + فشل التصدير + الأعمدة الفارغة + غياب الرسم البياني
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing cases for reproducibility
  - Test 1a — زر "بدء التحليل": أنشئ حالة بـ `demoEnd=2`, `maxIndex=9`, `likertGroups=[]` → تحقق أن `canProceed = true` (من Bug_Condition 1 في design.md: `hasAnySelection AND NOT allCovered`)
  - Test 1b — تصدير ديموغرافي بحت: استدعِ `exportAllToXlsx(demographicResults=[...], likertResults=[])` → تحقق أن العملية لا ترمي استثناء وأن الملف يحتوي على ورقة لكل سؤال + ورقة الملخص (من Bug_Condition 2: `demographicResults.length > 0 AND likertResults.length = 0`)
  - Test 1c — عمود فارغ: استدعِ `buildDemographicSheet` بـ `result.responses=[]` → تحقق أن لا استثناء يُرمى وأن صف الإجمالي يحتوي على 0 (من Bug_Condition 3: `result.responses.length = 0`)
  - Test 1d — غياب الرسم البياني: تحقق من أن الورقة الناتجة تحتوي على chart (من Bug_Condition 4: `sheet.charts = undefined`)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - السلوك الحالي الصحيح للاستبيانات المختلطة والزر المعطّل
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `exportAllToXlsx(demoResults=[...], likertResults=[...])` ينجح ويُنتج ورقة لكل سؤال ديموغرافي + ورقة لكل مجموعة ليكرت + ورقة الملخص على الكود غير المُصلَح
  - Observe: `canProceed = false` عند `demoEnd < demoStart` و `likertGroups = []` على الكود غير المُصلَح
  - Observe: `exportAllToXlsx(demoResults=[], likertResults=[...])` ينجح ويُنتج أوراق ليكرت + ورقة الملخص
  - Write property-based test: لجميع المدخلات حيث `demographicResults.length > 0 AND likertResults.length > 0`، يجب أن تنجح العملية وتُنتج نفس البنية (من Preservation Requirements في design.md: Requirements 3.1, 3.3)
  - Write property-based test: لجميع الحالات حيث لم يختر المستخدم أي سؤال (`demoEnd < demoStart AND likertGroups = []`)، يجب أن `canProceed = false` (من Preservation Requirements: Requirement 3.4)
  - Write property-based test: لجميع المدخلات حيث `likertResults.length > 0 AND demographicResults.length = 0`، يجب أن يستمر التصدير بشكل صحيح (Requirement 3.2)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for flexible-survey-analysis bugs

  - [x] 3.1 إصلاح زر "بدء التحليل" في QuestionConfig.tsx
    - في `QuestionConfig.tsx`، استبدل منطق `canProceed` الحالي:
      ```typescript
      // قبل
      const canProceed = isDemoOnly || (likertGroups.length > 0 && isAllQuestionsAssigned);
      // بعد
      const hasDemoSelection = demoEnd >= demoStart;
      const hasAnySelection = hasDemoSelection || likertGroups.length > 0;
      const canProceed = hasAnySelection;
      ```
    - عدّل `handleProceed` للتعامل مع الحالة الجديدة: عند `!isDemoOnly` و `likertGroups.length > 0` (حتى لو لم تُغطَّ جميع الأعمدة)، تابع إلى مرحلة مراجعة ليكرت
    - _Bug_Condition: isBugCondition_Button(state) حيث hasAnySelection=true AND NOT allCovered_
    - _Expected_Behavior: canProceed = true لأي حالة يوجد فيها اختيار واحد على الأقل_
    - _Preservation: canProceed = false عند عدم وجود أي اختيار (demoEnd < demoStart AND likertGroups=[])_
    - _Requirements: 2.2, 3.4_

  - [x] 3.2 إصلاح تصدير الاستبيان الديموغرافي البحت في exportUtils.ts
    - تحقق من سلوك `generateOverallCommentary` عند `likertResults=[]` وأصلح إن لزم
    - تحقق من `saveTauri` وأضف حارساً إذا كان الـ Rust backend لا يتعامل مع `likert=[]`
    - تأكد أن `saveBrowser` تعمل بشكل صحيح عند `likertResults=[]` (لا تحتاج تغييراً إذا كانت `buildSummarySheet` تعمل)
    - _Bug_Condition: isBugCondition_Export حيث demographicResults.length > 0 AND likertResults.length = 0_
    - _Expected_Behavior: ينتج ملف Excel يحتوي على ورقة لكل سؤال ديموغرافي + ورقة الملخص_
    - _Preservation: الاستبيانات المختلطة تُصدَّر بنفس البنية السابقة_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.3 إصلاح الأعمدة الفارغة في buildDemographicSheet
    - في `buildDemographicSheet`، أضف معالجة صريحة لحالة `result.responses.length === 0`:
      ```typescript
      if (result.responses.length === 0) {
        ws.addRow(['لا توجد إجابات', 0, '0%']);
      }
      ```
    - تأكد أن `generateDemographicCommentary` لا ترمي استثناء عند `responses=[]`
    - _Bug_Condition: isBugCondition_EmptyColumn حيث result.responses.length = 0_
    - _Expected_Behavior: ورقة تحتوي على صف "لا توجد إجابات" بإجمالي 0 دون استثناء_
    - _Preservation: الأعمدة التي تحتوي على إجابات تُحلَّل وتُصدَّر بنفس النتائج_
    - _Requirements: 2.3, 3.3_

  - [x] 3.4 إضافة حساب "لا إجابة" في demographicAnalyzer.ts
    - في `analyzeDemographics`، بدلاً من `continue` عند الخلية الفارغة، أضفها كفئة "لا إجابة":
      ```typescript
      const answer = row[i] ?? '';
      if (answer.trim() === '') {
        answers['لا إجابة'] = (answers['لا إجابة'] || 0) + 1;
      } else {
        answers[answer] = (answers[answer] || 0) + 1;
      }
      ```
    - احسب النسبة المئوية بناءً على إجمالي المستجيبين (بما فيهم "لا إجابة")
    - _Bug_Condition: خلايا فارغة في بيانات الاستجابة تُتجاهل حالياً_
    - _Expected_Behavior: تظهر "لا إجابة" كفئة مستقلة في الجدول والرسم البياني_
    - _Requirements: 2.5_

  - [x] 3.5 إضافة رسم بياني عمودي (Bar Chart) في كل ورقة تصدير
    - أضف دالة مساعدة `addBarChart(ws, dataStartRow, dataEndRow)` في `exportUtils.ts`
    - الرسم يأخذ بياناته من العمود الأول (العبارات/الفئات) والعمود الثالث (النسبة المئوية)
    - استدعِ `addBarChart` في نهاية `buildDemographicSheet` و `buildLikertSheet`
    - إذا كانت `responses` فارغة، أنشئ رسماً فارغاً أو تخطَّ دون إيقاف التصدير
    - _Bug_Condition: isBugCondition_NoChart حيث sheet.charts = undefined_
    - _Expected_Behavior: كل ورقة تصدير تحتوي على Bar Chart يعكس توزيع الإجابات_
    - _Preservation: التعقيبات التحليلية وبنية الجداول تبقى كما هي_
    - _Requirements: 2.4_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - تفعيل الزر + نجاح التصدير + الأعمدة الفارغة + وجود الرسم البياني
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - السلوك الحالي الصحيح للاستبيانات المختلطة والزر المعطّل
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
