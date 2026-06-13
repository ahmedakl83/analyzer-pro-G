import type { SurveyData, LikertGroup, LikertScale, LikertGroupResult } from '../types/survey';

// Known Likert scale patterns for auto-detection (Arabic & English)
const KNOWN_SCALES: Record<string, string[]> = {
  'ar_5': ['أوافق بشدة', 'أوافق', 'محايد', 'لا أوافق', 'لا أوافق بشدة'],
  'ar_5_alt': ['موافق بشدة', 'موافق', 'محايد', 'غير موافق', 'غير موافق بشدة'],
  'ar_5_alt2': ['أوافق بشدة', 'أوافق', 'أوافق إلى حد ما', 'لا أوافق', 'لا أوافق بشدة'],
  'ar_3': ['أوافق', 'محايد', 'لا أوافق'],
  'ar_3_alt': ['موافق', 'محايد', 'غير موافق'],
  'ar_5_freq': ['دائماً', 'غالباً', 'أحياناً', 'نادراً', 'أبداً'],
  'ar_5_freq_alt': ['دائما', 'غالبا', 'أحيانا', 'نادرا', 'أبدا'],
  'ar_5_degree': ['بدرجة كبيرة جداً', 'بدرجة كبيرة', 'بدرجة متوسطة', 'بدرجة قليلة', 'بدرجة قليلة جداً'],
  'ar_5_degree_alt': ['كبيرة جدا', 'كبيرة', 'متوسطة', 'قليلة', 'قليلة جدا'],
  'ar_5_satisfaction': ['راضٍ جداً', 'راضٍ', 'محايد', 'غير راضٍ', 'غير راضٍ إطلاقاً'],
  'en_5': ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'],
  'en_3': ['Agree', 'Neutral', 'Disagree'],
  'en_5_freq': ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
  'en_7': ['Strongly Agree', 'Agree', 'Somewhat Agree', 'Neutral', 'Somewhat Disagree', 'Disagree', 'Strongly Disagree'],
};

export function detectLikertScale(
  surveyData: SurveyData,
  groups: LikertGroup[]
): LikertScale {
  // Collect all unique answers from Likert columns
  const allAnswers = new Set<string>();
  
  for (const group of groups) {
    for (let i = group.startIndex; i <= group.endIndex; i++) {
      for (const row of surveyData.rows) {
        const answer = row[i]?.trim();
        if (answer) {
          allAnswers.add(answer);
        }
      }
    }
  }

  const answersArray = Array.from(allAnswers);

  // Try to match with known scales
  let bestMatch: string[] | null = null;
  let bestMatchScore = 0;

  for (const [, scaleLabels] of Object.entries(KNOWN_SCALES)) {
    let matchCount = 0;
    for (const answer of answersArray) {
      if (scaleLabels.some(label => 
        label.toLowerCase() === answer.toLowerCase() || 
        normalizeArabic(label) === normalizeArabic(answer)
      )) {
        matchCount++;
      }
    }
    
    const score = matchCount / Math.max(answersArray.length, scaleLabels.length);
    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestMatch = scaleLabels;
    }
  }

  // If we found a good match (>50% overlap), use it
  if (bestMatch && bestMatchScore > 0.5) {
    return { labels: bestMatch };
  }

  // Otherwise, return the unique answers as-is
  return { labels: answersArray };
}

function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ً|ٌ|ٍ|َ|ُ|ِ|ّ|ْ/g, '')
    .trim();
}

function getLevel(mean: number, scaleLength: number): 'Low' | 'Moderate' | 'High' {
  if (mean === 0) return 'Low'; // Fallback
  const m = Math.round(mean * 100) / 100;
  const interval = Math.round(((scaleLength - 1) / 3) * 100) / 100;
  
  const t1 = Math.round((1.00 + interval - 0.01) * 100) / 100;
  const t2 = Math.round((t1 + 0.01 + interval - 0.01) * 100) / 100;

  if (m <= t1) return 'Low';
  if (m <= t2) return 'Moderate';
  return 'High';
}

export function analyzeLikertGroups(
  surveyData: SurveyData,
  groups: LikertGroup[],
  scale: LikertScale
): LikertGroupResult[] {
  return groups.map(group => {
    const questions = [];
    
    let groupSum = 0;
    let groupSumSq = 0;
    let groupN = 0;

    for (let i = group.startIndex; i <= group.endIndex; i++) {
      const questionText = surveyData.headers[i];
      const direction = group.itemDirections?.[i] || 'positive';
      const responseCounts: Record<string, number> = {};

      // Initialize all scale labels with 0
      for (const label of scale.labels) {
        responseCounts[label] = 0;
      }

      // Count responses
      let totalValid = 0;
      for (const row of surveyData.rows) {
        const answer = row[i]?.trim();
        if (!answer) continue;
        
        // Try exact match first
        if (responseCounts.hasOwnProperty(answer)) {
          responseCounts[answer]++;
          totalValid++;
        } else {
          // Try normalized match
          const normalizedAnswer = normalizeArabic(answer);
          const matchedLabel = scale.labels.find(
            label => normalizeArabic(label) === normalizedAnswer
          );
          if (matchedLabel) {
            responseCounts[matchedLabel]++;
            totalValid++;
          }
        }
      }

      let qSum = 0;
      let qSumSq = 0;
      let qN = 0;

      const responses = scale.labels.map((label, idx) => {
        const count = responseCounts[label] || 0;
        const score = direction === 'positive' ? scale.labels.length - idx : idx + 1;
        
        qSum += score * count;
        qSumSq += score * score * count;
        qN += count;

        return {
          label,
          count,
          percentage: totalValid > 0 
            ? Math.round((count / totalValid) * 10000) / 100 
            : 0,
        };
      });

      const mean = qN > 0 ? qSum / qN : 0;
      const stdDev = qN > 1 ? Math.sqrt(Math.max(0, (qSumSq - (qSum * qSum) / qN) / (qN - 1))) : 0;
      const level = getLevel(mean, scale.labels.length);

      groupSum += qSum;
      groupSumSq += qSumSq;
      groupN += qN;

      questions.push({
        index: i - group.startIndex + 1,
        text: questionText,
        responses,
        direction,
        mean,
        stdDev,
        level
      });
    }

    const groupMean = groupN > 0 ? groupSum / groupN : 0;
    const groupStdDev = groupN > 1 ? Math.sqrt(Math.max(0, (groupSumSq - (groupSum * groupSum) / groupN) / (groupN - 1))) : 0;
    const groupLevel = getLevel(groupMean, scale.labels.length);

    return {
      groupId: group.id,
      groupName: group.name,
      questions,
      scale,
      mean: groupMean,
      stdDev: groupStdDev,
      level: groupLevel
    };
  });
}
