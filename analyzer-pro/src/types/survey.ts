// === Core Data Types ===

export interface SurveyData {
  headers: string[];
  rows: string[][];
  totalQuestions: number;
  totalResponses: number;
  fileName: string;
}

export interface DemographicRange {
  startIndex: number;
  endIndex: number;
  multiChoiceQuestions?: number[];
  customAnswerOrders?: Record<number, string[]>;
  ignoredQuestions?: number[];
}

export interface LikertGroup {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  itemDirections?: Record<number, 'positive' | 'negative'>;
}

export interface LikertScale {
  labels: string[];
}

// === Analysis Results ===

export interface DemographicResult {
  questionIndex: number;
  question: string;
  responses: ResponseItem[];
  isMultipleChoice?: boolean;
}

export interface ResponseItem {
  answer: string;
  count: number;
  percentage: number;
}

export interface LikertResponseItem {
  label: string;
  count: number;
  percentage: number;
}

export interface LikertQuestionResult {
  index: number;
  text: string;
  responses: LikertResponseItem[];
  direction: 'positive' | 'negative';
  mean: number;
  stdDev: number;
  level: 'High' | 'Moderate' | 'Low';
}

export interface LikertGroupResult {
  groupId: string;
  groupName: string;
  questions: LikertQuestionResult[];
  scale: LikertScale;
  mean: number;
  stdDev: number;
  level: 'High' | 'Moderate' | 'Low';
}

// === Paired Demographic Questions ===
// أسئلة ديموغرافية متتالية تشترك في نفس النص قبل [...] وتختلف في البيان داخل الأقواس

export interface PairedVariant {
  /** اسم البيان داخل الأقواس، مثلاً "الأم" أو "الأب" */
  label: string;
  /** إجابات هذا البيان */
  responses: ResponseItem[];
}

export interface PairedDemographicResult {
  /** الاسم الموحد المشترك (قبل الأقواس)، مثلاً "المهنة للوالدين" */
  baseLabel: string;
  /** رقم السؤال الأول في المجموعة (للترتيب) */
  firstQuestionIndex: number;
  /** مجموعة فهارس الأعمدة في الاستبيان التي تنتمي لهذه المجموعة */
  columnIndices: number[];
  /** البيانات المختلفة (الأم، الأب، ...) مع إجاباتها */
  variants: PairedVariant[];
}

// === App State ===

export type AppStep =
  | "upload"
  | "configure"
  | "review-demographics"
  | "review-likert"
  | "analysis"
  | "export"
  | "survey-setup"
  | "data-entry";

export type AppTab = "survey" | "entry" | "analysis";

export interface AppState {
  activeTab: AppTab;
  currentStep: AppStep;
  // Survey Flow
  activeTemplate: import('./surveyFlow').SurveyTemplate | null;
  activeSession: import('./surveyFlow').SurveySession | null;
  // Analysis Flow
  surveyData: SurveyData | null;
  demographicRange: DemographicRange | null;
  likertGroups: LikertGroup[];
  likertScale: LikertScale | null;
  demographicResults: DemographicResult[];
  pairedDemographicResults: PairedDemographicResult[];
  likertResults: LikertGroupResult[];
  isAnalyzing: boolean;
  isGroupSurvey: boolean;
  groupUserIdColumnIndex: number | null;
  includeLevelTables: boolean;
}

export type AppAction =
  | { type: "SET_STEP"; payload: AppStep }
  | { type: "SET_SURVEY_DATA"; payload: SurveyData }
  | { type: "SET_DEMOGRAPHIC_RANGE"; payload: DemographicRange }
  | { type: "SET_LIKERT_GROUPS"; payload: LikertGroup[] }
  | { type: "ADD_LIKERT_GROUP"; payload: LikertGroup }
  | { type: "REMOVE_LIKERT_GROUP"; payload: string }
  | { type: "SET_LIKERT_SCALE"; payload: LikertScale }
  | { type: "SET_DEMOGRAPHIC_RESULTS"; payload: DemographicResult[] }
  | { type: "SET_PAIRED_DEMOGRAPHIC_RESULTS"; payload: PairedDemographicResult[] }
  | { type: "SET_LIKERT_RESULTS"; payload: LikertGroupResult[] }
  | { type: "SET_ANALYZING"; payload: boolean }
  | { type: "SET_GROUP_SURVEY"; payload: boolean }
  | { type: "SET_GROUP_USER_COLUMN"; payload: number | null }
  | { type: "SET_INCLUDE_LEVEL_TABLES"; payload: boolean }
  | { type: "SET_ACTIVE_TAB"; payload: AppTab }
  | { type: "SET_ACTIVE_TEMPLATE"; payload: import('./surveyFlow').SurveyTemplate | null }
  | { type: "SET_ACTIVE_SESSION"; payload: import('./surveyFlow').SurveySession | null }
  | { type: "RESET" };
