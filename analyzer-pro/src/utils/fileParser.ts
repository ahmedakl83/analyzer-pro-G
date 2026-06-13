import * as XLSX from 'xlsx';
import type { SurveyData } from '../types/survey';

export async function parseFile(file: File): Promise<SurveyData> {
  const data = await file.arrayBuffer();
  return parseBuffer(data, file.name);
}

export async function parseBuffer(data: ArrayBuffer, fileName: string): Promise<SurveyData> {
  // Try to detect if it's a CSV file and handle encoding properly
  if (fileName.toLowerCase().endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(data);
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('الملف لا يحتوي على بيانات كافية. يجب أن يحتوي على صف للعناوين وصف واحد على الأقل من البيانات.');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    ).filter(row => row.some(cell => cell !== ''));
    
    if (rows.length === 0) {
      throw new Error('الملف لا يحتوي على إجابات.');
    }
    
    return {
      headers,
      rows,
      totalQuestions: headers.length,
      totalResponses: rows.length,
      fileName,
    };
  }
  
  // For Excel files, use XLSX
  const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to array of arrays
  const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (jsonData.length < 2) {
    throw new Error('الملف لا يحتوي على بيانات كافية. يجب أن يحتوي على صف للعناوين وصف واحد على الأقل من البيانات.');
  }

  const headers = jsonData[0].map(h => String(h).trim());
  const rows = jsonData.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

  if (rows.length === 0) {
    throw new Error('الملف لا يحتوي على إجابات.');
  }

  return {
    headers,
    rows: rows.map(row => row.map(cell => String(cell).trim())),
    totalQuestions: headers.length,
    totalResponses: rows.length,
    fileName,
  };
}

export function getQuestionLabel(header: string, maxLength: number = 60): string {
  if (header.length <= maxLength) return header;
  return header.substring(0, maxLength) + '...';
}
