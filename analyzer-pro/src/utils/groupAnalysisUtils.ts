import type { SurveyData, DemographicResult, PairedDemographicResult } from '../types/survey';

/**
 * Segments the survey rows by the unique values in the specified user ID column.
 * Excludes the user ID column from standard data analysis by returning subsets.
 */
export function segmentSurveyDataByUser(
  surveyData: SurveyData,
  userIdColumnIndex: number
): Map<string, SurveyData> {
  const segmented = new Map<string, SurveyData>();

  for (const row of surveyData.rows) {
    const rawUserId = row[userIdColumnIndex] ?? '';
    const userId = rawUserId.trim() || 'بدون اسم';

    if (!segmented.has(userId)) {
      segmented.set(userId, {
        ...surveyData,
        rows: [],
      });
    }
    segmented.get(userId)!.rows.push(row);
  }

  return segmented;
}

/**
 * Applies zero-value consistency to DemographicResults.
 * Uses the global results as a template to ensure all reference categories are present.
 */
export function applyDemographicZeroValueConsistency(
  individualResults: DemographicResult[],
  globalResults: DemographicResult[]
): DemographicResult[] {
  return globalResults.map((globalResult, index) => {
    const individualResult = individualResults[index];
    
    // Create a lookup for individual responses
    const individualLookup = new Map<string, { count: number; percentage: number }>();
    if (individualResult) {
      for (const res of individualResult.responses) {
        individualLookup.set(res.answer, { count: res.count, percentage: res.percentage });
      }
    }

    // Map through global responses to maintain reference categories
    const consistentResponses = globalResult.responses.map(globalRes => {
      const match = individualLookup.get(globalRes.answer);
      return {
        answer: globalRes.answer,
        count: match ? match.count : 0,
        percentage: match ? match.percentage : 0,
      };
    });

    return {
      ...globalResult, // questionIndex, question
      responses: consistentResponses,
    };
  });
}

/**
 * Applies zero-value consistency to PairedDemographicResults.
 */
export function applyPairedDemographicZeroValueConsistency(
  individualResults: PairedDemographicResult[],
  globalResults: PairedDemographicResult[]
): PairedDemographicResult[] {
  return globalResults.map((globalResult, index) => {
    const individualResult = individualResults[index];

    const consistentVariants = globalResult.variants.map((globalVariant, vIndex) => {
      const individualVariant = individualResult?.variants[vIndex];
      
      const individualLookup = new Map<string, { count: number; percentage: number }>();
      if (individualVariant) {
        for (const res of individualVariant.responses) {
          individualLookup.set(res.answer, { count: res.count, percentage: res.percentage });
        }
      }

      const consistentResponses = globalVariant.responses.map(globalRes => {
        const match = individualLookup.get(globalRes.answer);
        return {
          answer: globalRes.answer,
          count: match ? match.count : 0,
          percentage: match ? match.percentage : 0,
        };
      });

      return {
        label: globalVariant.label,
        responses: consistentResponses,
      };
    });

    return {
      ...globalResult, // baseLabel, firstQuestionIndex, columnIndices
      variants: consistentVariants,
    };
  });
}

// Note: Likert analysis inherently has zero-value consistency because it iterates over a predefined LikertScale.
