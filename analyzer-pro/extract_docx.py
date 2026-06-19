import zipfile
import xml.etree.ElementTree as ET
import sys
import io

# We need to make sure stdout is using utf-8 so Arabic renders properly
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def extract_text(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        # XML namespace for WordprocessingML
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text = []
        for paragraph in tree.findall('.//w:p', ns):
            para_text = []
            for run in paragraph.findall('.//w:r', ns):
                t = run.find('w:t', ns)
                if t is not None and t.text:
                    para_text.append(t.text)
            if para_text:
                text.append(''.join(para_text))
        return '\n'.join(text)
    except Exception as e:
        return str(e)

print('================================= ORIGINAL =================================')
print(extract_text(r'D:\MyProjects\Accomplished\analyzer-pro-G\example\Master_Analysis_Report.docx'))
print('\n================================= MODIFIED =================================')
print(extract_text(r'D:\MyProjects\Accomplished\analyzer-pro-G\example\Master_Analysis_Report_Modified.docx'))
