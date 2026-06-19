const fs = require('fs');
const JSZip = require('jszip');

async function getParagraphs(path) {
  const data = fs.readFileSync(path);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml').async('string');
  const text = docXml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return text.split('\n').map(l => l.trim()).filter(l => l.includes('يتضح من'));
}

async function compare() {
  const p1 = await getParagraphs('D:/MyProjects/Accomplished/analyzer-pro-G/example/Report.docx');
  const p2 = await getParagraphs('D:/MyProjects/Accomplished/analyzer-pro-G/example/Report_Modified.docx');
  const len = Math.max(p1.length, p2.length);
  let out = '';
  for(let i=0; i<len; i++) {
    out += 'Q' + (i+1) + ':\nOLD: ' + (p1[i] || 'N/A') + '\nNEW: ' + (p2[i] || 'N/A') + '\n\n';
  }
  fs.writeFileSync('compare2.txt', out, 'utf8');
  console.log('Saved to compare2.txt');
}

compare().catch(console.error);
