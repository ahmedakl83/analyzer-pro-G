import ExcelJS from 'exceljs';
import { 
  SurveyTemplate, 
  SurveyQuestion, 
  QuestionType, 
  LikertScale, 
  SurveySession, 
  FormResponse 
} from '../types/surveyFlow';
const generateId = () => crypto.randomUUID();

/**
 * يقرأ ملف Excel ويستخرج الأسئلة وأنواعها وإجاباتها.
 */
export async function importTemplateFromExcel(buffer: ArrayBuffer, fileName: string): Promise<{ template: SurveyTemplate; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error("الملف لا يحتوي على أي ورقة بيانات.");
  }

  const warnings: string[] = [];
  const questions: SurveyQuestion[] = [];
  const likertScales: LikertScale[] = [];
  const likertMap = new Map<string, string>(); // answers key -> scaleId

  const templateId = generateId();

  // Iterating through columns
  const colCount = worksheet.columnCount;
  for (let c = 1; c <= colCount; c++) {
    const colValues: any[] = [];
    worksheet.getColumn(c).eachCell({ includeEmpty: true }, (cell) => {
      colValues.push(cell.value);
    });

    if (colValues.length === 0 || colValues[0] === null || colValues[0] === undefined) {
      // Column index in Excel is 1-based, we'll report 1-based to user
      // But we check if it's really empty or just a missing header
      const headerCell = worksheet.getCell(1, c);
      if (!headerCell.value) {
        // Skip truly empty columns but don't warn unless there's data below
        continue;
      }
    }

    const header = String(worksheet.getCell(1, c).value || "").trim();
    if (!header) {
      warnings.push(`العمود ${c} لا يحتوي على رأس، تم تجاهله.`);
      continue;
    }

    // Get non-empty cells after header
    const rest: any[] = [];
    for (let r = 2; r <= worksheet.rowCount; r++) {
      const val = worksheet.getCell(r, c).value;
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        rest.push(val);
      }
    }

    if (rest.length === 0) {
      // General question
      questions.push({
        id: generateId(),
        templateId,
        columnIndex: c - 1,
        text: header,
        questionType: QuestionType.GENERAL,
        answers: []
      });
      continue;
    }

    // Last element is type number if 1, 2, or 3
    const lastVal = String(rest[rest.length - 1]).trim();
    let typeNum = 0;
    let answerValues: string[] = [];

    if (["1", "2", "3"].includes(lastVal)) {
      typeNum = parseInt(lastVal);
      answerValues = rest.slice(0, -1).map(v => String(v).trim()).filter(v => v !== "");
    } else {
      typeNum = 0;
      answerValues = [];
    }

    let qType: QuestionType = QuestionType.GENERAL;
    let qAnswers: string[] = [];
    let scaleId: string | undefined = undefined;

    switch (typeNum) {
      case 1:
        qType = QuestionType.DEMOGRAPHIC_SINGLE;
        qAnswers = answerValues;
        if (qAnswers.length === 0) warnings.push(`السؤال '${header}' ديموغرافي لكن لا يحتوي على إجابات.`);
        break;
      case 2:
        qType = QuestionType.DEMOGRAPHIC_MULTIPLE;
        qAnswers = answerValues;
        if (qAnswers.length === 0) warnings.push(`السؤال '${header}' ديموغرافي متعدد لكن لا يحتوي على إجابات.`);
        break;
      case 3:
        qType = QuestionType.LIKERT;
        qAnswers = answerValues;
        if (qAnswers.length === 0) {
           warnings.push(`السؤال '${header}' ليكرت لكن لا يحتوي على إجابات.`);
        } else {
          const key = qAnswers.join('|');
          if (!likertMap.has(key)) {
            const newScale: LikertScale = {
              id: generateId(),
              templateId,
              name: `مقياس ليكرت ${likertScales.length + 1}`,
              answers: qAnswers
            };
            likertScales.push(newScale);
            likertMap.set(key, newScale.id);
            scaleId = newScale.id;
          } else {
            scaleId = likertMap.get(key);
          }
        }
        break;
      default:
        qType = QuestionType.GENERAL;
        qAnswers = [];
    }

    questions.push({
      id: generateId(),
      templateId,
      columnIndex: c - 1,
      text: header,
      questionType: qType,
      answers: qAnswers,
      likertScaleId: scaleId
    });
  }

  if (questions.length === 0) {
    throw new Error("لم يتم العثور على أي أسئلة صالحة في الملف.");
  }

  const template: SurveyTemplate = {
    id: templateId,
    name: fileName.replace(/\.[^/.]+$/, ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions,
    likertScales
  };

  return { template, warnings };
}

/**
 * يصدّر نتائج جلسة التفريغ إلى ملف Excel يحتوي على ورقتي عمل.
 */
export async function exportSessionToExcel(session: SurveySession, template: SurveyTemplate): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Textual Results
  const wsText = workbook.addWorksheet('النتائج النصية', { views: [{ rightToLeft: true }] });
  _formatSheet(wsText, session, template, 'text');

  // Sheet 2: Numeric Results
  const wsNumeric = workbook.addWorksheet('النتائج الرقمية', { views: [{ rightToLeft: true }] });
  _formatSheet(wsNumeric, session, template, 'numeric');

  return await workbook.xlsx.writeBuffer();
}

function _formatSheet(ws: ExcelJS.Worksheet, session: SurveySession, template: SurveyTemplate, mode: 'text' | 'numeric') {
  // Styles
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle', wrapText: true };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }
  };

  // Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 30;

  // First Cell: ID
  const idCell = headerRow.getCell(1);
  idCell.value = "رقم الاستمارة";
  idCell.fill = headerFill;
  idCell.font = headerFont;
  idCell.alignment = centerAlign;
  idCell.border = thinBorder;
  ws.getColumn(1).width = 16;

  const questions = [...template.questions].sort((a, b) => a.columnIndex - b.columnIndex);

  questions.forEach((q, idx) => {
    const cell = headerRow.getCell(idx + 2);
    cell.value = q.text;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
    ws.getColumn(idx + 2).width = Math.max(20, q.text.length + 4);
  });

  // Data Rows
  session.forms.forEach((form, fIdx) => {
    const rowNum = fIdx + 2;
    const row = ws.getRow(rowNum);
    const useAlt = fIdx % 2 === 1;

    // Form ID
    const numCell = row.getCell(1);
    numCell.value = form.formIndex + 1;
    numCell.alignment = centerAlign;
    numCell.border = thinBorder;
    if (useAlt) numCell.fill = altFill;

    // Answers
    questions.forEach((q, qIdx) => {
      const rawAnswer = form.answers[q.id] || "";
      let displayValue: any = rawAnswer;

      if (mode === 'numeric' && rawAnswer) {
        if (q.questionType === QuestionType.DEMOGRAPHIC_SINGLE || q.questionType === QuestionType.LIKERT) {
          const idx = q.answers.indexOf(rawAnswer);
          if (idx !== -1) displayValue = idx + 1;
        } else if (q.questionType === QuestionType.DEMOGRAPHIC_MULTIPLE) {
          const selected = rawAnswer.split(",").map(s => s.trim()).filter(Boolean);
          const indices = selected.map(s => {
            const idx = q.answers.indexOf(s);
            return idx !== -1 ? (idx + 1).toString() : s;
          });
          displayValue = indices.join(",");
        }
      }

      const cell = row.getCell(qIdx + 2);
      cell.value = displayValue;
      cell.alignment = typeof displayValue === 'string' ? rightAlign : centerAlign;
      cell.border = thinBorder;
      if (useAlt) cell.fill = altFill;
    });
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
}

/**
 * يقرأ ملف Excel يحتوي على إجابات رقمية ويحوّلها إلى نصوص بالاستناد إلى القالب.
 */
export async function importResponsesFromExcel(
  buffer: ArrayBuffer,
  template: SurveyTemplate
): Promise<{ forms: FormResponse[]; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error("الملف لا يحتوي على أي ورقة بيانات.");
  }

  const rows: any[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values as any[]);
  });

  if (rows.length < 2) {
    throw new Error("الملف فارغ أو يحتوي على رأس فقط.");
  }

  // exceljs row.values is 1-based array (index 0 is empty)
  const headerRow = (rows[0] as any[]).slice(1).map(v => String(v || "").trim().toLowerCase());
  const dataRows = rows.slice(1);

  const questionMap = new Map<string, SurveyQuestion>();
  template.questions.forEach(q => {
    questionMap.set(q.text.trim().toLowerCase(), q);
  });

  const warnings: string[] = [];
  const colToQuestion = new Map<number, SurveyQuestion>();

  headerRow.forEach((header, colIdx) => {
    if (!header) {
      warnings.push(`العمود ${colIdx + 1} لا يحتوي على رأس، سيتم تجاهله.`);
      return;
    }
    const q = questionMap.get(header);
    if (!q) {
      warnings.push(`العمود '${header}' لا يطابق أي سؤال في القالب، سيتم تجاهله.`);
    } else {
      colToQuestion.set(colIdx, q);
    }
  });

  if (colToQuestion.size === 0) {
    throw new Error("لم يتم العثور على أي تطابق بين أعمدة الملف وأسئلة القالب.");
  }

  const forms: FormResponse[] = [];
  const now = new Date().toISOString();

  dataRows.forEach((row, rowIdx) => {
    // row is also 1-based from exceljs values
    const rowValues = (row as any[]).slice(1);
    
    if (rowValues.every(v => v === null || v === undefined || String(v).trim() === "")) {
      return;
    }

    const answers: Record<string, string> = {};

    colToQuestion.forEach((q, colIdx) => {
      const raw = rowValues[colIdx];
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        answers[q.id] = "";
        return;
      }

      const rawStr = String(raw).trim();

      if (q.questionType === QuestionType.GENERAL) {
        answers[q.id] = rawStr;
      } else if (q.questionType === QuestionType.DEMOGRAPHIC_MULTIPLE) {
        const parts = rawStr.split(/[,،\s/]+/).map(p => p.trim()).filter(Boolean);
        const selected: string[] = [];
        parts.forEach(part => {
          const num = parseInt(part);
          if (!isNaN(num)) {
            if (num >= 1 && num <= q.answers.length) {
              selected.push(q.answers[num - 1]);
            } else {
              warnings.push(`الصف ${rowIdx + 2}، السؤال '${q.text}': الرقم ${num} خارج النطاق، تم تجاهله.`);
            }
          } else if (q.answers.includes(part)) {
            selected.push(part);
          } else {
            warnings.push(`الصف ${rowIdx + 2}، السؤال '${q.text}': القيمة '${part}' غير صالحة.`);
          }
        });
        answers[q.id] = selected.join(",");
      } else {
        // Single choice or Likert
        const num = parseInt(rawStr);
        if (!isNaN(num)) {
          if (num >= 1 && num <= q.answers.length) {
            answers[q.id] = q.answers[num - 1];
          } else {
            warnings.push(`الصف ${rowIdx + 2}، السؤال '${q.text}': الرقم ${num} خارج النطاق.`);
            answers[q.id] = "";
          }
        } else if (q.answers.includes(rawStr)) {
          answers[q.id] = rawStr;
        } else {
          warnings.push(`الصف ${rowIdx + 2}، السؤال '${q.text}': القيمة '${rawStr}' غير صالحة.`);
          answers[q.id] = "";
        }
      }
    });

    forms.push({
      formIndex: forms.length,
      answers,
      isComplete: true,
      startedAt: now,
      completedAt: now,
      durationSeconds: 0
    });
  });

  return { forms, warnings };
}
