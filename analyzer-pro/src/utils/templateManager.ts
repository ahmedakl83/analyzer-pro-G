import type { AnalysisTemplate } from '../types/survey';

const STORAGE_KEY = 'analyzer_pro_templates';

export function getTemplates(): AnalysisTemplate[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to parse templates from local storage', err);
    return [];
  }
}

export function saveTemplate(template: AnalysisTemplate): void {
  const templates = getTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Checks if two string arrays are exactly the same.
 */
function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function findMatchingTemplates(headers: string[]): AnalysisTemplate[] {
  const templates = getTemplates();
  return templates.filter(t => arraysEqual(t.headers, headers));
}

export function exportTemplatesToFile(): void {
  const templates = getTemplates();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templates, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `survey_analyzer_templates_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function importTemplatesFromFile(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedTemplates: AnalysisTemplate[] = JSON.parse(content);
        
        if (!Array.isArray(importedTemplates)) {
          throw new Error('Invalid template file format. Expected an array.');
        }

        const existingTemplates = getTemplates();
        let addedCount = 0;

        for (const template of importedTemplates) {
          // simple validation
          if (template.id && template.name && template.headers && template.demographicRange) {
            const exists = existingTemplates.some(t => t.id === template.id);
            if (!exists) {
              existingTemplates.push(template);
              addedCount++;
            }
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(existingTemplates));
        resolve(addedCount);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
