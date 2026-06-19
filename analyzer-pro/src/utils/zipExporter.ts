import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateDocxBuffer } from './docxExporter';
import {
  segmentSurveyDataByUser,
} from './groupAnalysisUtils';
import { analyzeDemographics, detectPairedQuestions, analyzePairedDemographics, getPairedColumnIndices } from './demographicAnalyzer';
import { analyzeLikertGroups } from './likertAnalyzer';
import type { SurveyData, DemographicRange, LikertGroup, LikertScale, DemographicResult, PairedDemographicResult, LikertGroupResult } from '../types/survey';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

export async function exportGroupToZip(
  surveyData: SurveyData,
  userIdColumnIndex: number,
  globalDemographics: DemographicResult[],
  globalPaired: PairedDemographicResult[],
  globalLikert: LikertGroupResult[],
  likertGroups: LikertGroup[],
  demographicRange: DemographicRange | null,
  likertScale: LikertScale | null,
  includeLevelTables: boolean = true
): Promise<void> {
  const zip = new JSZip();

  // 1. Generate Master Report
  const masterFileName = 'Master_Analysis_Report.docx';
  const masterBuffer = await generateDocxBuffer(globalDemographics, globalPaired, globalLikert, includeLevelTables);
  zip.file(masterFileName, masterBuffer);

  // 2. Generate Individual Reports
  const individualFolder = zip.folder('Individual_Reports');
  if (!individualFolder) throw new Error('Could not create folder in zip');

  const segmentedData = segmentSurveyDataByUser(surveyData, userIdColumnIndex);

  for (const [userId, userSurveyData] of segmentedData.entries()) {
    // Re-analyze for user
    let userDemographics: DemographicResult[] = [];
    let userPaired: PairedDemographicResult[] = [];
    let userLikert: LikertGroupResult[] = [];

    if (demographicRange) {
      userDemographics = analyzeDemographics(userSurveyData, demographicRange);

      const pairedGroups = detectPairedQuestions(userSurveyData.headers, demographicRange.startIndex, demographicRange.endIndex, demographicRange.ignoredQuestions);
      const pairedIndices = getPairedColumnIndices(pairedGroups);

      userDemographics = userDemographics.filter(r => 
        !pairedIndices.has(r.questionIndex) && 
        r.questionIndex !== userIdColumnIndex
      );

      userPaired = analyzePairedDemographics(userSurveyData, pairedGroups);
    }

    if (likertGroups.length > 0 && likertScale) {
      userLikert = analyzeLikertGroups(userSurveyData, likertGroups, likertScale);
    }

    const safeUserId = userId.replace(/[\\/*?:"<>|]/g, '_');
    const userFileName = `${safeUserId}_Analysis_Report.docx`;

    const userBuffer = await generateDocxBuffer(userDemographics, userPaired, userLikert, includeLevelTables, true);
    individualFolder.file(userFileName, userBuffer);
  }

  const zipContent = await zip.generateAsync({ type: 'blob' });

  // 3. Save ZIP file
  const zipFileName = 'Group_Analysis_Reports.zip';
  
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    
    const filePath = await save({
      defaultPath: zipFileName,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });
    
    if (filePath) {
      const arrayBuffer = await zipContent.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));
    }
  } else {
    saveAs(zipContent, zipFileName);
  }
}
