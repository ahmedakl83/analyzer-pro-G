import { TableCommentService } from './tableCommentService';
import type { DemographicResult, LikertGroupResult } from '../types/survey';

/**
 * أمثلة تطبيقية لاستخدام خدمة التعليقات المحسنة
 */

// مثال على بيانات ديموغرافية
const sampleDemographicResult: DemographicResult = {
  questionIndex: 0,
  question: "ما هو مستواك التعليمي؟",
  responses: [
    { answer: "بكالوريوس", count: 45, percentage: 45.0 },
    { answer: "ماجستير", count: 30, percentage: 30.0 },
    { answer: "دكتوراه", count: 15, percentage: 15.0 },
    { answer: "دبلوم", count: 10, percentage: 10.0 }
  ]
};

// مثال على مجموعة ليكرت
const sampleLikertGroup: LikertGroupResult = {
  groupId: "satisfaction",
  groupName: "الرضا الوظيفي",
  scale: {
    labels: ["أوافق بشدة", "أوافق", "محايد", "لا أوافق", "لا أوافق بشدة"]
  },
  questions: [
    {
      index: 1,
      text: "أشعر بالرضا عن طبيعة عملي",
      responses: [
        { label: "أوافق بشدة", count: 35, percentage: 35.0 },
        { label: "أوافق", count: 40, percentage: 40.0 },
        { label: "محايد", count: 15, percentage: 15.0 },
        { label: "لا أوافق", count: 8, percentage: 8.0 },
        { label: "لا أوافق بشدة", count: 2, percentage: 2.0 }
      ],
      direction: 'positive',
      mean: 4.1,
      stdDev: 0.8,
      level: 'High'
    },
    {
      index: 2,
      text: "أحصل على التقدير المناسب لجهودي",
      responses: [
        { label: "أوافق بشدة", count: 20, percentage: 20.0 },
        { label: "أوافق", count: 35, percentage: 35.0 },
        { label: "محايد", count: 25, percentage: 25.0 },
        { label: "لا أوافق", count: 15, percentage: 15.0 },
        { label: "لا أوافق بشدة", count: 5, percentage: 5.0 }
      ],
      direction: 'positive',
      mean: 3.5,
      stdDev: 1.1,
      level: 'Moderate'
    },
    {
      index: 3,
      text: "بيئة العمل محفزة للإبداع",
      responses: [
        { label: "أوافق بشدة", count: 25, percentage: 25.0 },
        { label: "أوافق", count: 30, percentage: 30.0 },
        { label: "محايد", count: 20, percentage: 20.0 },
        { label: "لا أوافق", count: 20, percentage: 20.0 },
        { label: "لا أوافق بشدة", count: 5, percentage: 5.0 }
      ],
      direction: 'positive',
      mean: 3.6,
      stdDev: 1.0,
      level: 'Moderate'
    }
  ],
  mean: 3.73,
  stdDev: 0.97,
  level: 'High'
};

// مثال على مجموعة ليكرت ثانية للمقارنة
const sampleLikertGroup2: LikertGroupResult = {
  groupId: "training",
  groupName: "التدريب والتطوير",
  scale: {
    labels: ["أوافق بشدة", "أوافق", "محايد", "لا أوافق", "لا أوافق بشدة"]
  },
  questions: [
    {
      index: 1,
      text: "أحصل على فرص تدريبية كافية",
      responses: [
        { label: "أوافق بشدة", count: 15, percentage: 15.0 },
        { label: "أوافق", count: 25, percentage: 25.0 },
        { label: "محايد", count: 30, percentage: 30.0 },
        { label: "لا أوافق", count: 25, percentage: 25.0 },
        { label: "لا أوافق بشدة", count: 5, percentage: 5.0 }
      ],
      direction: 'positive',
      mean: 3.2,
      stdDev: 1.2,
      level: 'Moderate'
    },
    {
      index: 2,
      text: "التدريب المقدم يلبي احتياجاتي",
      responses: [
        { label: "أوافق بشدة", count: 10, percentage: 10.0 },
        { label: "أوافق", count: 30, percentage: 30.0 },
        { label: "محايد", count: 35, percentage: 35.0 },
        { label: "لا أوافق", count: 20, percentage: 20.0 },
        { label: "لا أوافق بشدة", count: 5, percentage: 5.0 }
      ],
      direction: 'positive',
      mean: 3.3,
      stdDev: 1.1,
      level: 'Moderate'
    }
  ],
  mean: 3.25,
  stdDev: 1.15,
  level: 'Moderate'
};

/**
 * دالة لعرض أمثلة على جميع أنواع التعليقات
 */
export function demonstrateCommentaryFeatures(): void {
  console.log("=== أمثلة على ميزات التعليقات المحسنة ===\n");

  // 1. تحويل الأرقام العربية
  console.log("1. تحويل الأرقام العربية:");
  console.log(`الرقم الإنجليزي: 123.45`);
  console.log(`الرقم العربي: ${TableCommentService.toIndic("123.45")}\n`);

  // 2. التعليق الأساسي للبيانات الديموغرافية
  console.log("2. التعليق الأساسي للبيانات الديموغرافية:");
  const sortedResponses = [...sampleDemographicResult.responses].sort((a, b) => b.percentage - a.percentage);
  const basicDemoComment = TableCommentService.generateGeneralComment(sortedResponses);
  console.log(basicDemoComment + "\n");

  // 3. التعليق المتقدم للبيانات الديموغرافية
  console.log("3. التعليق المتقدم للبيانات الديموغرافية:");
  const advancedDemoComment = TableCommentService.generateAdvancedDemographicComment(sampleDemographicResult);
  console.log(advancedDemoComment + "\n");

  // 4. التعليق الأساسي لمجموعة ليكرت
  console.log("4. التعليق الأساسي لمجموعة ليكرت:");
  const basicLikertComment = TableCommentService.generateGroupComment(sampleLikertGroup);
  console.log(basicLikertComment + "\n");

  // 5. التعليق المتقدم لمجموعة ليكرت
  console.log("5. التعليق المتقدم لمجموعة ليكرت:");
  const advancedLikertComment = TableCommentService.generateAdvancedGroupComment(sampleLikertGroup);
  console.log(advancedLikertComment + "\n");

  // 6. التحليل المقارن بين المجموعات
  console.log("6. التحليل المقارن بين المجموعات:");
  const comparativeComment = TableCommentService.generateComparativeComment([sampleLikertGroup, sampleLikertGroup2]);
  console.log(comparativeComment + "\n");

  // 7. الملخص التنفيذي للتقرير
  console.log("7. الملخص التنفيذي للتقرير:");
  const reportSummary = TableCommentService.generateReportSummary([sampleLikertGroup, sampleLikertGroup2], [sampleDemographicResult]);
  console.log(reportSummary + "\n");

  // 8. تعليق مخصص لسؤال واحد
  console.log("8. تعليق مخصص لسؤال واحد:");
  const customComment = TableCommentService.generateCustomScaleComment(sampleLikertGroup.questions[0]);
  console.log(customComment);
}

/**
 * دالة لاختبار تحويل الأرقام العربية
 */
export function testArabicNumbers(): void {
  const testCases = [
    "123",
    "45.67",
    "0.5",
    "100%",
    "النسبة: 85.5%",
    "المتوسط: 3.75 من 5"
  ];

  console.log("=== اختبار تحويل الأرقام العربية ===");
  testCases.forEach(testCase => {
    console.log(`الأصلي: ${testCase}`);
    console.log(`المحول: ${TableCommentService.toIndic(testCase)}\n`);
  });
}

/**
 * دالة لمقارنة التعليقات الأساسية والمتقدمة
 */
export function compareCommentaryModes(): void {
  console.log("=== مقارنة بين أنماط التعليق ===\n");

  console.log("--- النمط الأساسي ---");
  console.log("للبيانات الديموغرافية:");
  const sortedResponses = [...sampleDemographicResult.responses].sort((a, b) => b.percentage - a.percentage);
  console.log(TableCommentService.generateGeneralComment(sortedResponses));
  
  console.log("\nلمجموعة ليكرت:");
  console.log(TableCommentService.generateGroupComment(sampleLikertGroup));

  console.log("\n--- النمط المتقدم ---");
  console.log("للبيانات الديموغرافية:");
  console.log(TableCommentService.generateAdvancedDemographicComment(sampleDemographicResult));
  
  console.log("\nلمجموعة ليكرت:");
  console.log(TableCommentService.generateAdvancedGroupComment(sampleLikertGroup));
}

// تصدير البيانات النموذجية للاستخدام في الاختبارات
export const sampleData = {
  demographicResult: sampleDemographicResult,
  likertGroup1: sampleLikertGroup,
  likertGroup2: sampleLikertGroup2
};