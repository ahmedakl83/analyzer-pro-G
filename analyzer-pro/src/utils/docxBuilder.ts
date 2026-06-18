/**
 * docxBuilder.ts
 * بناء ملف DOCX بـ XML خام مطابق للملف المرجعي
 * الخط: Calibri | RTL | Pie Chart حقيقي
 */

import type { DemographicResult, LikertGroupResult, PairedDemographicResult } from '../types/survey';
import { generateDemographicCommentary, generatePairedCommentary, generateLikertCommentary, generateIntelligentSummary } from './commentaryUtils';

// ─── أرقام هندية ─────────────────────────────────────────────────────────────
function toIndic(n: string | number): string {
  const map: Record<string, string> = {
    '0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩',
  };
  return String(n).replace(/[0-9]/g, d => map[d] ?? d);
}

// ─── XML escape ───────────────────────────────────────────────────────────────
function xe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Namespaces ───────────────────────────────────────────────────────────────
const NS_W   = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const NS_R   = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS_WP  = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
const NS_A   = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const NS_C   = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"';
const NS_MC  = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const NS_W14 = 'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';
const NS_W15 = 'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"';

// ─── Run properties مشتركة ────────────────────────────────────────────────────
function rPrArabic(sz = 28, bold = false, color?: string, rtl = true): string {
  return `<w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
    ${bold ? '<w:b/><w:bCs/>' : ''}
    ${color ? `<w:color w:val="${color}"/>` : ''}
    <w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>
    ${rtl ? '<w:rtl/>' : ''}
  </w:rPr>`;
}

// ─── Paragraph properties مشتركة ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pPrRtl = (jc = 'both', spacingBefore = 60, spacingAfter = 60): string =>
  `<w:pPr><w:bidi/><w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}"/><w:jc w:val="${jc}"/></w:pPr>`;
void _pPrRtl; // سيُستخدم لاحقاً

// ─── فقرة فاصل صفحة ──────────────────────────────────────────────────────────
function pageBreak(): string {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

// ─── عنوان السؤال (مرقّم) ────────────────────────────────────────────────────
function headingPara(text: string, _num: number): string {
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="a4"/>
      <w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>
      <w:bidi/>
      <w:spacing w:before="60" w:after="60"/>
      <w:ind w:left="567" w:hanging="567"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:r>${rPrArabic(32, true, '1F3864')}<w:t>${xe(text)}</w:t></w:r>
  </w:p>`;
}

// ─── تسمية الجدول ─────────────────────────────────────────────────────────────
function formatDemographicTitle(question: string, isMultipleChoice?: boolean): string {
  let q = question.trim();
  if (q.startsWith('ال')) {
    q = 'ل' + q.slice(1);
  } else {
    q = 'ل' + q;
  }
  const prefix = isMultipleChoice ? 'التوزيع التكراري' : 'التوزيع النسبي';
  return `${prefix} لأفراد عينة البحث وفقا ${q}`;
}

function formatLikertTitle(groupName: string): string {
  const cleaned = groupName.replace(/^(?:[أ-ي]+اً|[\d]+)\s*[-:]\s*/, '').trim();
  return `التوزيع النسبي لأفراد عينة البحث وفقا لاستجاباتهم لاستبيان ${cleaned}`;
}

function tableLabelPara(num: number, additionalText?: string): string {
  const text = additionalText ? `جدول (${toIndic(num)}) ${additionalText}` : `جدول (${toIndic(num)})`;
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="60"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>${rPrArabic(30, true, undefined, true)}<w:t>${xe(text)}</w:t></w:r>
  </w:p>`;
}

// ─── خلية جدول ───────────────────────────────────────────────────────────────
function tcBorders(): string {
  return `<w:tcBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
  </w:tcBorders>`;
}

function headerCell(text: string, w: number, bgColor = '1F3864'): string {
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${w}" w:type="dxa"/>
      ${tcBorders()}
      <w:shd w:val="solid" w:color="${bgColor}" w:fill="${bgColor}"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
      <w:r>${rPrArabic(22, true, 'FFFFFF')}<w:t>${xe(text)}</w:t></w:r>
    </w:p>
  </w:tc>`;
}

function dataCell(text: string, w: number, bold = false, bgColor?: string, align = 'center'): string {
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${w}" w:type="dxa"/>
      ${tcBorders()}
      ${bgColor ? `<w:shd w:val="solid" w:color="${bgColor}" w:fill="${bgColor}"/>` : ''}
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="${align}"/></w:pPr>
      <w:r>${rPrArabic(22, bold)}<w:t>${xe(text)}</w:t></w:r>
    </w:p>
  </w:tc>`;
}

// ─── جدول ديموغرافي (3 أعمدة) ────────────────────────────────────────────────
// الترتيب في RTL: الإجابة (يمين) | التكرار | النسبة% (يسار)
// في XML: الخلية الأولى = يمين → الإجابة أولاً
function buildDemographicTableXml(result: DemographicResult): string {
  const col1 = 2768; // الإجابة
  const col2 = 2767; // التكرار
  const col3 = 2767; // النسبة%

  const headerRow = `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="400"/><w:tblHeader/></w:trPr>
    ${headerCell('الإجابة', col1)}
    ${headerCell(result.isMultipleChoice ? 'التكرار' : 'العدد', col2)}
    ${headerCell('النسبة %', col3)}
  </w:tr>`;

  const dataRows = result.responses.map(r => `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="360"/></w:trPr>
    ${dataCell(r.answer, col1)}
    ${dataCell(toIndic(r.count), col2)}
    ${dataCell(`${toIndic(r.percentage)}%`, col3)}
  </w:tr>`).join('');

  const total = result.responses.reduce((s, r) => s + r.count, 0);
  const totalRow = `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="360"/></w:trPr>
    ${dataCell('الإجمالي', col1, true, 'F2F2F2')}
    ${dataCell(toIndic(total), col2, true, 'F2F2F2')}
    ${dataCell('100%', col3, true, 'F2F2F2')}
  </w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:bidiVisual/>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:left w:w="10" w:type="dxa"/>
        <w:right w:w="10" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="${col1}"/>
      <w:gridCol w:w="${col2}"/>
      <w:gridCol w:w="${col3}"/>
    </w:tblGrid>
    ${headerRow}
    ${dataRows}
    ${totalRow}
  </w:tbl>`;
}

// ─── Pie Chart XML ────────────────────────────────────────────────────────────
function buildPieChartXml(
  chartRelId: string,
  _title: string,
  _categories: string[],
  _values: number[],
  cx = 5278120,
  cy = 3079115
): string {
  return `<w:p>
    <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
    <w:r>
      <w:rPr><w:noProof/></w:rPr>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="17780" b="6985"/>
          <wp:docPr id="1" name="${xe(_title)}"/>
          <wp:cNvGraphicFramePr/>
          <a:graphic ${NS_A}>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
              <c:chart ${NS_C} ${NS_R} r:id="${chartRelId}"/>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

// ─── chart1.xml content ───────────────────────────────────────────────────────
function buildChartXml(
  title: string,
  categories: string[],
  values: number[],
  excelRelId = 'rId3'
): string {
  const catPts = categories.map((c, i) =>
    `<c:pt idx="${i}"><c:v>${xe(c)}</c:v></c:pt>`).join('');
  const valPts = values.map((v, i) =>
    `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  const dPts = categories.map((_, i) =>
    `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/>
      <c:spPr>
        <a:solidFill><a:schemeClr val="accent${(i % 6) + 1}"/></a:solidFill>
        <a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln>
      </c:spPr>
    </c:dPt>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
  <c:date1904 val="0"/>
  <c:lang val="ar-SA"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx>
            <c:strRef>
              <c:f>ورقة1!$B$1</c:f>
              <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${xe(title)}</c:v></c:pt></c:strCache>
            </c:strRef>
          </c:tx>
          ${dPts}
          <c:dLbls>
            <c:dLblPos val="inEnd"/>
            <c:showLegendKey val="0"/>
            <c:showVal val="1"/>
            <c:showCatName val="0"/>
            <c:showSerName val="0"/>
            <c:showPercent val="0"/>
            <c:showBubbleSize val="0"/>
            <c:showLeaderLines val="1"/>
          </c:dLbls>
          <c:cat>
            <c:strRef>
              <c:f>ورقة1!$A$2:$A$${categories.length + 1}</c:f>
              <c:strCache><c:ptCount val="${categories.length}"/>${catPts}</c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>ورقة1!$B$2:$B$${values.length + 1}</c:f>
              <c:numCache>
                <c:formatCode>0.00%</c:formatCode>
                <c:ptCount val="${values.length}"/>
                ${valPts}
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:firstSliceAng val="0"/>
      </c:pieChart>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
  <c:externalData r:id="${excelRelId}"><c:autoUpdate val="0"/></c:externalData>
</c:chartSpace>`;
}

// ─── Excel worksheet مضمّن (بيانات الرسم البياني) ────────────────────────────
async function buildExcelForChart(
  title: string,
  categories: string[],
  values: number[]
): Promise<Uint8Array> {
  // نبني xlsx بسيط بـ ExcelJS
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ورقة1');
  ws.addRow([title, title]);
  categories.forEach((cat, i) => ws.addRow([cat, values[i]]));
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ─── فقرة التعقيب ─────────────────────────────────────────────────────────────
function commentaryPara(text: string): string {
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="60"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="28"/><w:szCs w:val="28"/>
        <w:rtl/>
      </w:rPr>
      <w:t>${xe(text)}</w:t>
    </w:r>
  </w:p>`;
}

// ─── جدول مقارن (متعدد الأعمدة) — رأس مزدوج مع vMerge ──────────────────────
function buildPairedTableXml(result: PairedDemographicResult): string {
  const varColors = ['1F3864', 'C00000', '375623', '7030A0', 'C55A11'];
  const varCount  = result.variants.length;

  // عرض الأعمدة مطابق للمرجع
  const answerW = 2906;
  const colW    = 1349; // عرض كل عمود ت أو %

  // tblGrid
  const gridCols = [`<w:gridCol w:w="${answerW}"/>`];
  for (let v = 0; v < varCount; v++) {
    gridCols.push(`<w:gridCol w:w="${colW}"/>`);
    gridCols.push(`<w:gridCol w:w="${colW}"/>`);
  }

  // ─── الصف الأول من الرأس: الإجابات (vMerge restart) + اسم كل بيان (gridSpan=2) ───
  const hRow1Cells: string[] = [];
  // خلية "الإجابات" — مدمجة عمودياً (صفّان)
  hRow1Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${answerW}" w:type="dxa"/>
      <w:vMerge w:val="restart"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/>
        <w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
      </w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
        <w:t>الإجابات</w:t>
      </w:r>
    </w:p>
  </w:tc>`);

  // خلية اسم كل بيان — مدمجة أفقياً (gridSpan=2)
  for (let v = 0; v < varCount; v++) {
    const color = varColors[v % varColors.length];
    const label = result.variants[v].label;
    hRow1Cells.push(`<w:tc>
      <w:tcPr>
        <w:tcW w:w="${colW * 2}" w:type="dxa"/>
        <w:gridSpan w:val="2"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        </w:tcBorders>
        <w:shd w:val="solid" w:color="${color}" w:fill="${color}"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/>
          <w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
          <w:t>${xe(label)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`);
  }

  const headerRow1 = `<w:tr>
    <w:trPr><w:trHeight w:val="420"/><w:tblHeader/></w:trPr>
    ${hRow1Cells.join('')}
  </w:tr>`;

  // ─── الصف الثاني من الرأس: خلية فارغة (vMerge) + التكرار/% لكل بيان ───────
  const hRow2Cells: string[] = [];
  // خلية "الإجابات" المستمرة (vMerge بدون restart)
  hRow2Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${answerW}" w:type="dxa"/>
      <w:vMerge/>
      <w:tcBorders>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr></w:p>
  </w:tc>`);

  // التكرار + % لكل بيان
  for (let v = 0; v < varCount; v++) {
    const color = varColors[v % varColors.length];
    for (const label of ['العدد', '%']) {
      hRow2Cells.push(`<w:tc>
        <w:tcPr>
          <w:tcW w:w="${colW}" w:type="dxa"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          </w:tcBorders>
          <w:shd w:val="solid" w:color="${color}" w:fill="${color}"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
          <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
            <w:t>${xe(label)}</w:t>
          </w:r>
        </w:p>
      </w:tc>`);
    }
  }

  const headerRow2 = `<w:tr>
    <w:trPr><w:trHeight w:val="420"/><w:tblHeader/></w:trPr>
    ${hRow2Cells.join('')}
  </w:tr>`;

  // ─── جمع الإجابات الكلية مرتبة ───────────────────────────────────────────
  const allAnswers = Array.from(
    new Set(result.variants.flatMap(v => v.responses.map(r => r.answer)))
  );
  const totalPerAnswer: Record<string, number> = {};
  for (const ans of allAnswers) {
    totalPerAnswer[ans] = result.variants.reduce((sum, v) => {
      const r = v.responses.find(r => r.answer === ans);
      return sum + (r?.count ?? 0);
    }, 0);
  }
  allAnswers.sort((a, b) => (totalPerAnswer[b] ?? 0) - (totalPerAnswer[a] ?? 0));

  // ─── صفوف البيانات ────────────────────────────────────────────────────────
  const dataRows = allAnswers.map(answer => {
    const cells = [dataCell(answer, answerW)];
    for (const v of result.variants) {
      const r = v.responses.find(r => r.answer === answer);
      cells.push(dataCell(toIndic(r?.count ?? 0), colW));
      cells.push(dataCell(r ? `${toIndic(r.percentage)}%` : '٠%', colW));
    }
    return `<w:tr>
      <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
      <w:trPr><w:trHeight w:val="360"/></w:trPr>
      ${cells.join('')}
    </w:tr>`;
  }).join('');

  // ─── صف الإجمالي ─────────────────────────────────────────────────────────
  const totCells = [dataCell('الإجمالي', answerW, true, 'F2F2F2')];
  for (const v of result.variants) {
    const total = v.responses.reduce((s, r) => s + r.count, 0);
    totCells.push(dataCell(toIndic(total), colW, true, 'F2F2F2'));
    totCells.push(dataCell('١٠٠%', colW, true, 'F2F2F2'));
  }
  const totalRow = `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="360"/></w:trPr>
    ${totCells.join('')}
  </w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:bidiVisual/>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:left w:w="10" w:type="dxa"/>
        <w:right w:w="10" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${gridCols.join('')}</w:tblGrid>
    ${headerRow1}
    ${headerRow2}
    ${dataRows}
    ${totalRow}
  </w:tbl>`;
}

// ─── تنظيف نص عبارة ليكرت: إزالة المقطع الثابت قبل القوسين والقوسين أنفسهما ──
// مثال: "أولاً: دعم اتخاذ القرار [تساعد تقنيات (الذكاء الاصطناعي)...]" → "تساعد تقنيات (الذكاء الاصطناعي)..."
function cleanQuestionText(text: string): string {
  const m = text.match(/^(.+?)\s*[\[\(](.+)[\]\)]\s*$/);
  if (m) {
    const prefix = m[1].trim();
    const content = m[2].trim();
    if (prefix.length > 0 && !prefix.includes('؟')) {
      return content;
    }
  }
  return text;
}

// ─── جدول ليكرت ──────────────────────────────────────────────────────────────
function buildLikertTableXml(group: LikertGroupResult): string {
  const labels   = group.scale.labels;
  const numLabels = labels.length;

  // عرض الأعمدة كما في الملف النهائي:
  const numW    = 338;   // عمود م
  const countW  = 450;   // عمود ت
  const percW   = 620;   // عمود %
  const textW   = 8302 - numW - numLabels * (countW + percW); // عمود العبارة

  const gridCols = [
    `<w:gridCol w:w="${numW}"/>`,
    `<w:gridCol w:w="${textW}"/>`,
    ...labels.flatMap(() => [`<w:gridCol w:w="${countW}"/>`, `<w:gridCol w:w="${percW}"/>`]),
  ];

  // ─── الصف الأول من الرأس: م + العبارة (vMerge) + اسم كل تسمية (gridSpan=2) ──
  const hRow1Cells: string[] = [];

  // م — مدمج عمودياً
  hRow1Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${numW}" w:type="dxa"/>
      <w:vMerge w:val="restart"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
        <w:t>م</w:t>
      </w:r>
    </w:p>
  </w:tc>`);

  // العبارة — مدمجة عمودياً
  hRow1Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${textW}" w:type="dxa"/>
      <w:vMerge w:val="restart"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
        <w:t>العبارة</w:t>
      </w:r>
    </w:p>
  </w:tc>`);

  // اسم كل تسمية — مدمجة أفقياً (gridSpan=2)
  for (const label of labels) {
    hRow1Cells.push(`<w:tc>
      <w:tcPr>
        <w:tcW w:w="${countW + percW}" w:type="dxa"/>
        <w:gridSpan w:val="2"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        </w:tcBorders>
        <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
          <w:t>${xe(label)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`);
  }

  const headerRow1 = `<w:tr>
    <w:trPr><w:trHeight w:val="420"/><w:tblHeader/></w:trPr>
    ${hRow1Cells.join('')}
  </w:tr>`;

  // ─── الصف الثاني من الرأس: م (vMerge) + العبارة (vMerge) + ت/% لكل تسمية ──
  const hRow2Cells: string[] = [];

  // م — مستمرة
  hRow2Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${numW}" w:type="dxa"/>
      <w:vMerge/>
      <w:tcBorders>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr></w:p>
  </w:tc>`);

  // العبارة — مستمرة
  hRow2Cells.push(`<w:tc>
    <w:tcPr>
      <w:tcW w:w="${textW}" w:type="dxa"/>
      <w:vMerge/>
      <w:tcBorders>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      </w:tcBorders>
      <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr></w:p>
  </w:tc>`);

  // ت + % لكل تسمية
  for (let i = 0; i < numLabels; i++) {
    hRow2Cells.push(`<w:tc>
      <w:tcPr>
        <w:tcW w:w="${countW}" w:type="dxa"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        </w:tcBorders>
        <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
          <w:t>عدد</w:t>
        </w:r>
      </w:p>
    </w:tc>`);
    hRow2Cells.push(`<w:tc>
      <w:tcPr>
        <w:tcW w:w="${percW}" w:type="dxa"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        </w:tcBorders>
        <w:shd w:val="solid" w:color="1F3864" w:fill="1F3864"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>
          <w:t>%</w:t>
        </w:r>
      </w:p>
    </w:tc>`);
  }

  const headerRow2 = `<w:tr>
    <w:trPr><w:trHeight w:val="420"/><w:tblHeader/></w:trPr>
    ${hRow2Cells.join('')}
  </w:tr>`;

  // ─── صفوف البيانات ────────────────────────────────────────────────────────
  const dataRows = group.questions.map(q => {
    const cells = [
      dataCell(toIndic(q.index), numW),
      dataCell(cleanQuestionText(q.text), textW, false, undefined, 'both'),
    ];
    for (const resp of q.responses) {
      cells.push(dataCell(toIndic(resp.count), countW));
      cells.push(dataCell(`${toIndic(resp.percentage)}%`, percW));
    }
    return `<w:tr>
      <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
      <w:trPr><w:trHeight w:val="500"/></w:trPr>
      ${cells.join('')}
    </w:tr>`;
  }).join('');

  return `<w:tbl>
    <w:tblPr>
      <w:bidiVisual/>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:left w:w="10" w:type="dxa"/>
        <w:right w:w="10" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${gridCols.join('')}</w:tblGrid>
    ${headerRow1}
    ${headerRow2}
    ${dataRows}
  </w:tbl>`;
}

function getLevelArabic(level: string): string {
  if (level === 'High') return 'مرتفع';
  if (level === 'Moderate') return 'متوسط';
  return 'منخفض';
}

function buildStatisticalTableXml(group: LikertGroupResult): string {
  const col1 = 3000;
  const col2 = 1500;
  const col3 = 1500;
  const col4 = 1500;

  const headerRow = `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="400"/><w:tblHeader/></w:trPr>
    ${headerCell('المتغير / البعد', col1)}
    ${headerCell('المتوسط', col2)}
    ${headerCell('الانحراف المعياري', col3)}
    ${headerCell('المستوى', col4)}
  </w:tr>`;

  const groupRow = `<w:tr>
    <w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>
    <w:trPr><w:trHeight w:val="360"/></w:trPr>
    ${dataCell(cleanQuestionText(group.groupName), col1, true, 'F2F2F2')}
    ${dataCell(toIndic(group.mean.toFixed(2)), col2, true, 'F2F2F2')}
    ${dataCell(toIndic(group.stdDev.toFixed(2)), col3, true, 'F2F2F2')}
    ${dataCell(getLevelArabic(group.level), col4, true, 'F2F2F2')}
  </w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:bidiVisual/>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:left w:w="10" w:type="dxa"/>
        <w:right w:w="10" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="${col1}"/>
      <w:gridCol w:w="${col2}"/>
      <w:gridCol w:w="${col3}"/>
      <w:gridCol w:w="${col4}"/>
    </w:tblGrid>
    ${headerRow}
    ${groupRow}
  </w:tbl>`;
}

// ─── Clustered Bar Chart للجدول المقارن ──────────────────────────────────────
function buildClusteredBarChartXml(
  title: string,
  categories: string[],
  variants: PairedDemographicResult['variants'],
  excelRelId = 'rId3'
): string {
  const catPts = categories.map((c, i) =>
    `<c:pt idx="${i}"><c:v>${xe(c)}</c:v></c:pt>`).join('');
  const catCount = categories.length;

  const series = variants.map((v, vIdx) => {
    const valPts = categories.map((cat, i) => {
      const r = v.responses.find(r => r.answer === cat);
      return `<c:pt idx="${i}"><c:v>${r ? r.percentage / 100 : 0}</c:v></c:pt>`;
    }).join('');

    return `<c:ser>
      <c:idx val="${vIdx}"/>
      <c:order val="${vIdx}"/>
      <c:tx>
        <c:strRef>
          <c:f>ورقة1!$${String.fromCharCode(66 + vIdx)}$1</c:f>
          <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${xe(v.label)}</c:v></c:pt></c:strCache>
        </c:strRef>
      </c:tx>
      <c:spPr>
        <a:solidFill><a:schemeClr val="accent${vIdx + 1}"/></a:solidFill>
        <a:ln><a:noFill/></a:ln>
      </c:spPr>
      <c:invertIfNegative val="0"/>
      <c:dLbls>
        <c:dLblPos val="outEnd"/>
        <c:showLegendKey val="0"/>
        <c:showVal val="1"/>
        <c:showCatName val="0"/>
        <c:showSerName val="0"/>
        <c:showPercent val="0"/>
        <c:showBubbleSize val="0"/>
        <c:showLeaderLines val="0"/>
      </c:dLbls>
      <c:cat>
        <c:strRef>
          <c:f>ورقة1!$A$2:$A$${catCount + 1}</c:f>
          <c:strCache><c:ptCount val="${catCount}"/>${catPts}</c:strCache>
        </c:strRef>
      </c:cat>
      <c:val>
        <c:numRef>
          <c:f>ورقة1!$${String.fromCharCode(66 + vIdx)}$2:$${String.fromCharCode(66 + vIdx)}$${catCount + 1}</c:f>
          <c:numCache>
            <c:formatCode>[$-2000401]0.00%</c:formatCode>
            <c:ptCount val="${catCount}"/>
            ${valPts}
          </c:numCache>
        </c:numRef>
      </c:val>
    </c:ser>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="ar-SA"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich>
        <a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:rPr lang="ar-EG"/><a:t>${xe(title)}</a:t></a:r></a:p>
      </c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${series}
        <c:dLbls>
          <c:dLblPos val="outEnd"/>
          <c:showLegendKey val="0"/>
          <c:showVal val="1"/>
          <c:showCatName val="0"/>
          <c:showSerName val="0"/>
          <c:showPercent val="0"/>
          <c:showBubbleSize val="0"/>
        </c:dLbls>
        <c:gapWidth val="219"/>
        <c:overlap val="-27"/>
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="1"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="2"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="2"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="[$-2000401]0.00%" sourceLinked="1"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
  <c:externalData r:id="${excelRelId}"><c:autoUpdate val="0"/></c:externalData>
</c:chartSpace>`;
}

async function buildExcelForPairedChart(
  _title: string,
  categories: string[],
  variants: PairedDemographicResult['variants']
): Promise<Uint8Array> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ورقة1');
  // رأس: الإجابات | بيان1 | بيان2 | ...
  ws.addRow(['الإجابات', ...variants.map(v => v.label)]);
  // بيانات
  for (const cat of categories) {
    const row = [cat, ...variants.map(v => {
      const r = v.responses.find(r => r.answer === cat);
      return r ? r.percentage / 100 : 0;
    })];
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ─── بناء document.xml ────────────────────────────────────────────────────────
interface ChartEntry {
  relId: string;
  chartXml: string;
  excelData: Uint8Array;
  chartRelsXml: string;
}

interface BuildResult {
  documentXml: string;
  charts: ChartEntry[];
}

export async function buildDocumentXml(
  demographicResults: DemographicResult[],
  pairedDemographicResults: PairedDemographicResult[],
  likertResults: LikertGroupResult[],
  includeLevelTables: boolean = true
): Promise<BuildResult> {
  const charts: ChartEntry[] = [];
  let chartCounter = 1;
  let tableCounter = 1;

  type DemoItem =
    | { kind: 'regular'; data: DemographicResult; idx: number }
    | { kind: 'paired';  data: PairedDemographicResult; idx: number };

  const demoItems: DemoItem[] = [
    ...demographicResults.map(d => ({ kind: 'regular' as const, data: d, idx: d.questionIndex })),
    ...pairedDemographicResults.map(p => ({ kind: 'paired' as const, data: p, idx: p.firstQuestionIndex })),
  ].sort((a, b) => a.idx - b.idx);

  const bodyParts: string[] = [];
  let isFirst = true;

  for (const item of demoItems) {
    if (!isFirst) bodyParts.push(pageBreak());
    isFirst = false;

    if (item.kind === 'regular') {
      const result = item.data;
      const chartRelId = `rId${10 + chartCounter}`;

      // عنوان السؤال
      bodyParts.push(headingPara(result.question, tableCounter));

      // تسمية الجدول
      bodyParts.push(tableLabelPara(tableCounter, formatDemographicTitle(result.question, result.isMultipleChoice)));

      // الجدول
      bodyParts.push(buildDemographicTableXml(result));

      // الرسم البياني
      const cats = result.responses.map(r => r.answer);
      const vals = result.responses.map(r => r.percentage / 100);
      bodyParts.push(buildPieChartXml(chartRelId, result.question, cats, vals));

      // التعقيب
      const commentary = generateDemographicCommentary(result);
      const chartRef = `وشكل (${toIndic(tableCounter)}) `;
      const PREFIXES = ['يتضح من الجدول أن ', 'يتضح من الجدول أنه ', 'أظهرت النتائج ', 'يستحوذ '];
      let body = commentary.trim();
      for (const p of PREFIXES) { if (body.startsWith(p)) { body = body.slice(p.length); break; } }
      if (body.startsWith('أن ')) body = body.slice(3);
      const fullCommentary = `يتضح من جدول (${toIndic(tableCounter)}) ${chartRef}أن ${body}`.replace(/\s{2,}/g, ' ');
      bodyParts.push(commentaryPara(fullCommentary));

      // بناء chart XML
      const chartXml = buildChartXml(result.question, cats, vals);
      const excelData = await buildExcelForChart(result.question, cats, vals);
      const chartRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet${chartCounter}.xlsx"/>
</Relationships>`;

      charts.push({ relId: chartRelId, chartXml, excelData, chartRelsXml });
      chartCounter++;
    }

    if (item.kind === 'paired') {
      const result = item.data;

      // عنوان السؤال
      bodyParts.push(headingPara(result.baseLabel, tableCounter));

      // تسمية الجدول
      bodyParts.push(tableLabelPara(tableCounter, formatDemographicTitle(result.baseLabel)));

      // الجدول المقارن
      bodyParts.push(buildPairedTableXml(result));

      // الرسم البياني المجمّع (Clustered Bar)
      const allAnswers = Array.from(
        new Set(result.variants.flatMap(v => v.responses.map(r => r.answer)))
      );
      const totalPerAnswer: Record<string, number> = {};
      for (const ans of allAnswers) {
        totalPerAnswer[ans] = result.variants.reduce((sum, v) => {
          const r = v.responses.find(r => r.answer === ans);
          return sum + (r?.count ?? 0);
        }, 0);
      }
      allAnswers.sort((a, b) => (totalPerAnswer[b] ?? 0) - (totalPerAnswer[a] ?? 0));

      const chartRelId = `rId${10 + chartCounter}`;
      bodyParts.push(buildPieChartXml(chartRelId, result.baseLabel, [], []));

      const chartXml = buildClusteredBarChartXml(result.baseLabel, allAnswers, result.variants);
      const excelData = await buildExcelForPairedChart(result.baseLabel, allAnswers, result.variants);
      const chartRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet${chartCounter}.xlsx"/>
</Relationships>`;
      charts.push({ relId: chartRelId, chartXml, excelData, chartRelsXml });
      chartCounter++;

      // التعقيب — قسم لكل بيان
      const commentary = generatePairedCommentary(result, tableCounter, true);
      for (const part of commentary.split('\n').filter(p => p.trim())) {
        bodyParts.push(commentaryPara(part.trim()));
      }
    }

    tableCounter++;
  }

  // ─── ليكرت ────────────────────────────────────────────────────────────────
  for (const group of likertResults) {
    if (!isFirst) bodyParts.push(pageBreak());
    isFirst = false;

    bodyParts.push(headingPara(group.groupName, tableCounter));
    bodyParts.push(tableLabelPara(tableCounter, formatLikertTitle(group.groupName)));
    bodyParts.push(buildLikertTableXml(group));

    // تعقيب تحليلي على جدول ليكرت
    const likertCommentary = generateLikertCommentary(group);
    const PREFIXES = ['يتضح من الجدول أن ', 'يتضح من الجدول أنه ', 'أظهرت النتائج ', 'يستحوذ '];
    let body = likertCommentary.trim();
    for (const p of PREFIXES) { if (body.startsWith(p)) { body = body.slice(p.length); break; } }
    if (body.startsWith('أن ')) body = body.slice(3);
    const fullCommentary = `يتضح من الجدول (${toIndic(tableCounter)}): أن ${body}`.replace(/\s{2,}/g, ' ');
    bodyParts.push(commentaryPara(fullCommentary));

    if (includeLevelTables) {
      // جدول المتوسطات (تابع للجدول السابق، لا يحتاج رقم جديد)
      bodyParts.push(buildStatisticalTableXml(group));

      // تعقيب ذكي على المتوسطات
      const intelligentCommentary = generateIntelligentSummary(group);
      const intelligentParts = intelligentCommentary.split('\n').filter(p => p.trim());
      for (const part of intelligentParts) {
        bodyParts.push(commentaryPara(part.trim()));
      }
    }

    tableCounter++;
  }

  // sectPr
  const sectPr = `<w:sectPr>
    <w:footerReference w:type="default" r:id="rId8"/>
    <w:pgSz w:w="11906" w:h="16838" w:code="9"/>
    <w:pgMar w:top="1440" w:right="1797" w:bottom="1440" w:left="1797" w:header="709" w:footer="709" w:gutter="0"/>
    <w:pgNumType w:start="1"/>
    <w:cols w:space="720"/>
    <w:bidi/>
    <w:docGrid w:linePitch="360"/>
  </w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS_W} ${NS_R} ${NS_WP} ${NS_A} ${NS_MC} ${NS_W14} ${NS_W15}
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  mc:Ignorable="w14 w15">
  <w:body>
    ${bodyParts.join('\n')}
    ${sectPr}
  </w:body>
</w:document>`;

  return { documentXml, charts };
}
