/**
 * docxExporter.ts
 * تصدير نتائج تحليل الاستبيان إلى ملف Word (.docx)
 * يستخدم XML خام مطابق للملف المرجعي
 */

import type { DemographicResult, LikertGroupResult, PairedDemographicResult } from '../types/survey';
import { buildDocumentXml } from './docxBuilder';

// ─── بناء ZIP (docx) ──────────────────────────────────────────────────────────

// [Content_Types].xml
function buildContentTypes(chartCount: number): string {
  const chartOverrides = Array.from({ length: chartCount }, (_, i) =>
    `<Override PartName="/word/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
  ).join('\n');
  const excelOverrides = Array.from({ length: chartCount }, (_, i) =>
    `<Override PartName="/word/embeddings/Microsoft_Excel_Worksheet${i + 1}.xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
  <Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${chartOverrides}
  ${excelOverrides}
</Types>`;
}

// _rels/.rels
const RELS_ROOT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

// word/_rels/document.xml.rels
function buildDocRels(chartCount: number): string {
  const chartRels = Array.from({ length: chartCount }, (_, i) =>
    `<Relationship Id="rId${10 + i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart${i + 1}.xml"/>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  ${chartRels}
</Relationships>`;
}

// word/styles.xml — مطابق للملف المرجعي (Calibri، RTL)
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="28"/><w:szCs w:val="28"/>
        <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:jc w:val="right"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <!-- Normal style -->
  <w:style w:type="paragraph" w:default="1" w:styleId="a">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:bidi/></w:pPr>
  </w:style>
  <!-- Heading style a4 — مستخدم لعناوين الأسئلة -->
  <w:style w:type="paragraph" w:styleId="a4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="a"/>
    <w:pPr>
      <w:bidi/>
      <w:spacing w:before="60" w:after="60"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:b/><w:bCs/>
      <w:color w:val="1F3864"/>
      <w:sz w:val="32"/><w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <!-- Footer style aa -->
  <w:style w:type="paragraph" w:styleId="aa">
    <w:name w:val="footer"/>
    <w:basedOn w:val="a"/>
    <w:pPr>
      <w:bidi/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
</w:styles>`;

// word/numbering.xml — قائمة مرقمة للعناوين
const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:nsid w:val="23C856CB"/>
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:tmpl w:val="0A0CD48C"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="567" w:hanging="567"/></w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:b/><w:bCs/>
        <w:color w:val="1F3864"/>
        <w:sz w:val="32"/><w:szCs w:val="32"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="2">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

// word/settings.xml
const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
  <w:themeFontLang w:val="en-US" w:bidi="ar-SA"/>
  <w:decimalSymbol w:val="."/>
  <w:listSeparator w:val=";"/>
</w:settings>`;

// word/footer1.xml — ترقيم الصفحات في المنتصف
const FOOTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:sdt>
    <w:sdtPr>
      <w:rPr><w:rtl/></w:rPr>
      <w:docPartObj>
        <w:docPartGallery w:val="Page Numbers (Bottom of Page)"/>
        <w:docPartUnique/>
      </w:docPartObj>
    </w:sdtPr>
    <w:sdtContent>
      <w:p>
        <w:pPr>
          <w:pStyle w:val="aa"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText>PAGE   \* MERGEFORMAT</w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r>
          <w:rPr><w:rtl/><w:lang w:val="ar-SA"/></w:rPr>
          <w:t>1</w:t>
        </w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
    </w:sdtContent>
  </w:sdt>
</w:ftr>`;

// word/webSettings.xml
const WEB_SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:optimizeForBrowser/>
</w:webSettings>`;

// word/fontTable.xml
const FONT_TABLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Calibri">
    <w:charset w:val="B2"/>
    <w:family w:val="roman"/>
    <w:pitch w:val="variable"/>
  </w:font>
</w:fonts>`;

// word/footnotes.xml
const FOOTNOTES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
</w:footnotes>`;

// word/endnotes.xml
const ENDNOTES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:endnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:endnote>
  <w:endnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:endnote>
</w:endnotes>`;

// docProps/core.xml
const CORE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:creator>Survey Analyzer Pro</dc:creator>
  <cp:lastModifiedBy>Survey Analyzer Pro</cp:lastModifiedBy>
</cp:coreProperties>`;

// docProps/app.xml
const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Survey Analyzer Pro</Application>
</Properties>`;

// ─── ZIP builder ──────────────────────────────────────────────────────────────
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// CRC32
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of data) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xFF, (v >> 8) & 0xFF]);
}
function writeUint32LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    offsets.push(offset);

    // Local file header
    const local = concat(
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // signature
      writeUint16LE(20),   // version needed
      writeUint16LE(0),    // flags
      writeUint16LE(0),    // compression (stored)
      writeUint16LE(0),    // mod time
      writeUint16LE(0),    // mod date
      writeUint32LE(crc),
      writeUint32LE(size),
      writeUint32LE(size),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),    // extra length
      nameBytes,
      entry.data
    );
    localHeaders.push(local);
    offset += local.length;

    // Central directory header
    const central = concat(
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]), // signature
      writeUint16LE(20),   // version made by
      writeUint16LE(20),   // version needed
      writeUint16LE(0),    // flags
      writeUint16LE(0),    // compression
      writeUint16LE(0),    // mod time
      writeUint16LE(0),    // mod date
      writeUint32LE(crc),
      writeUint32LE(size),
      writeUint32LE(size),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),    // extra length
      writeUint16LE(0),    // comment length
      writeUint16LE(0),    // disk start
      writeUint16LE(0),    // internal attr
      writeUint32LE(0),    // external attr
      writeUint32LE(offsets[offsets.length - 1]),
      nameBytes
    );
    centralHeaders.push(central);
  }

  const centralDir = concat(...centralHeaders);
  const centralOffset = offset;
  const centralSize = centralDir.length;
  const count = entries.length;

  // End of central directory
  const eocd = concat(
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
    writeUint16LE(0),
    writeUint16LE(0),
    writeUint16LE(count),
    writeUint16LE(count),
    writeUint32LE(centralSize),
    writeUint32LE(centralOffset),
    writeUint16LE(0)
  );

  return concat(...localHeaders, centralDir, eocd);
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function generateDocxBuffer(
  demographicResults: DemographicResult[],
  pairedDemographicResults: PairedDemographicResult[],
  likertResults: LikertGroupResult[],
  includeLevelTables: boolean = true
): Promise<Uint8Array> {
  const { documentXml, charts } = await buildDocumentXml(
    demographicResults,
    pairedDemographicResults,
    likertResults,
    includeLevelTables
  );

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: strToBytes(buildContentTypes(charts.length)) },
    { name: '_rels/.rels',         data: strToBytes(RELS_ROOT) },
    { name: 'word/document.xml',   data: strToBytes(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: strToBytes(buildDocRels(charts.length)) },
    { name: 'word/styles.xml',     data: strToBytes(STYLES_XML) },
    { name: 'word/numbering.xml',  data: strToBytes(NUMBERING_XML) },
    { name: 'word/settings.xml',   data: strToBytes(SETTINGS_XML) },
    { name: 'word/footer1.xml',    data: strToBytes(FOOTER_XML) },
    { name: 'word/webSettings.xml',data: strToBytes(WEB_SETTINGS_XML) },
    { name: 'word/fontTable.xml',  data: strToBytes(FONT_TABLE_XML) },
    { name: 'word/footnotes.xml',  data: strToBytes(FOOTNOTES_XML) },
    { name: 'word/endnotes.xml',   data: strToBytes(ENDNOTES_XML) },
    { name: 'docProps/core.xml',   data: strToBytes(CORE_XML) },
    { name: 'docProps/app.xml',    data: strToBytes(APP_XML) },
  ];

  // إضافة ملفات الرسوم البيانية
  for (let i = 0; i < charts.length; i++) {
    const n = i + 1;
    entries.push({ name: `word/charts/chart${n}.xml`, data: strToBytes(charts[i].chartXml) });
    entries.push({ name: `word/charts/_rels/chart${n}.xml.rels`, data: strToBytes(charts[i].chartRelsXml) });
    entries.push({ name: `word/embeddings/Microsoft_Excel_Worksheet${n}.xlsx`, data: charts[i].excelData });
  }

  return buildZip(entries);
}

export async function exportToDocx(
  demographicResults: DemographicResult[],
  pairedDemographicResults: PairedDemographicResult[],
  likertResults: LikertGroupResult[],
  includeLevelTables: boolean = true,
  fileName = 'survey_analysis'
): Promise<void> {
  const zipBytes = await generateDocxBuffer(demographicResults, pairedDemographicResults, likertResults, includeLevelTables);
  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  if (isTauri) {
    await saveTauriDocx(blob, `${fileName}.docx`);
  } else {
    saveBrowserDocx(blob, fileName);
  }
}

// ─── Save helpers ─────────────────────────────────────────────────────────────

function saveBrowserDocx(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function saveTauriDocx(blob: Blob, defaultName: string): Promise<void> {
  const { save }      = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (!filePath) return;

  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(arrayBuffer));
}
