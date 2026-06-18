import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, AppAction } from '../types/survey';

const initialState: AppState = {
  activeTab: 'analysis',
  currentStep: 'upload',
  activeTemplate: null,
  activeSession: null,
  surveyData: null,
  demographicRange: null,
  likertGroups: [],
  likertScale: null,
  demographicResults: [],
  pairedDemographicResults: [],
  likertResults: [],
  isAnalyzing: false,
  isGroupSurvey: false,
  groupUserIdColumnIndex: null,
  includeLevelTables: true,
};

function surveyReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_SURVEY_DATA':
      return { ...state, surveyData: action.payload };
    case 'SET_DEMOGRAPHIC_RANGE':
      return { ...state, demographicRange: action.payload };
    case 'SET_LIKERT_GROUPS':
      return { ...state, likertGroups: action.payload };
    case 'ADD_LIKERT_GROUP':
      return { ...state, likertGroups: [...state.likertGroups, action.payload] };
    case 'REMOVE_LIKERT_GROUP':
      return {
        ...state,
        likertGroups: state.likertGroups.filter(g => g.id !== action.payload),
      };
    case 'SET_LIKERT_SCALE':
      return { ...state, likertScale: action.payload };
    case 'SET_DEMOGRAPHIC_RESULTS':
      return { ...state, demographicResults: action.payload };
    case 'SET_PAIRED_DEMOGRAPHIC_RESULTS':
      return { ...state, pairedDemographicResults: action.payload };
    case 'SET_LIKERT_RESULTS':
      return { ...state, likertResults: action.payload };
    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.payload };
    case 'SET_GROUP_SURVEY':
      return { ...state, isGroupSurvey: action.payload };
    case 'SET_GROUP_USER_COLUMN':
      return { ...state, groupUserIdColumnIndex: action.payload };
    case 'SET_INCLUDE_LEVEL_TABLES':
      return { ...state, includeLevelTables: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_ACTIVE_TEMPLATE':
      return { ...state, activeTemplate: action.payload };
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSession: action.payload };
    case 'RESET':
      return initialState;
    case 'APPLY_TEMPLATE':
      return {
        ...state,
        demographicRange: action.payload.demographicRange,
        likertGroups: action.payload.likertGroups,
        likertScale: action.payload.likertScale,
        isGroupSurvey: action.payload.isGroupSurvey,
        groupUserIdColumnIndex: action.payload.groupUserIdColumnIndex,
        includeLevelTables: action.payload.includeLevelTables,
        currentStep: 'configure' // Send them to configure step so they can proceed and trigger calculation, or we could just leave them at configure. Let's leave at configure for review.
      };
    default:
      return state;
  }
}

interface SurveyContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(surveyReducer, initialState);

  return (
    <SurveyContext.Provider value={{ state, dispatch }}>
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey(): SurveyContextType {
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error('useSurvey must be used within a SurveyProvider');
  }
  return context;
}

