export enum QuestionType {
  GENERAL = 0,               // نص حر
  DEMOGRAPHIC_SINGLE = 1,    // ديموغرافي - إجابة واحدة
  DEMOGRAPHIC_MULTIPLE = 2,  // ديموغرافي - إجابات متعددة
  LIKERT = 3,                // ليكرت - إجابة واحدة
}

export interface SurveyQuestion {
  id: string;
  templateId: string;
  columnIndex: number;
  text: string;
  questionType: QuestionType;
  answers: string[];
  likertScaleId?: string;
}

export interface LikertScale {
  id: string;
  templateId: string;
  name: string;
  answers: string[];
}

export interface SurveyTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  questions: SurveyQuestion[];
  likertScales: LikertScale[];
}

export interface FormResponse {
  formIndex: number;
  answers: Record<string, string>; // questionId -> answer (comma separated for multiple)
  isComplete: boolean;
  startedAt?: string;
  completedAt?: string;
  durationSeconds: number;
}

export interface SurveySession {
  id: string;
  templateId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalForms: number;
  currentFormIndex: number;
  currentQuestionIndex: number;
  forms: FormResponse[];
  outputPath?: string;
}
