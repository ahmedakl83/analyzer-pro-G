const fs = require('fs');
const JSZip = require('jszip');

async function getParagraphs(path) {
  const data = fs.readFileSync(path);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml').async('string');
  const text = docXml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return text.split('\n').map(l => l.trim()).filter(l => l.startsWith('Ì ÷Õ „‰'));
}

async function compare() {
  const p1 = await getParagraphs('D:/MyProjects/Accomplished/analyzer-pro-G/example/Report.docx');
  const p2 = await getParagraphs('D:/MyProjects/Accomplished/analyzer-pro-G/example/Report_Modified.docx');
  const len = Math.max(p1.length, p2.length);
  let out = '';
  for(let i=0; i<Math.min(21, len); i++) {
    out += 'Q' + (i+1) + ':\nOLD: ' + (p1[i] || 'N/A') + '\nNEW: ' + (p2[i] || 'N/A') + '\n\n';
  }
  fs.writeFileSync('compare.txt', out);
  console.log('Saved to compare.txt');
}

compare().catch(console.error);
