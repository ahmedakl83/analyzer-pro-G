// ─── Bar Chart Helper ────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * يرسم Bar Chart على Canvas ويُعيد base64 PNG.
 * يعمل فقط في بيئة المتصفح حيث يتوفر HTMLCanvasElement.
 */
export function renderBarChartToPng(data: ChartDataPoint[], title: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const W = 480;
    const H = 280;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // خلفية بيضاء
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const PAD_LEFT = 60;
    const PAD_RIGHT = 20;
    const PAD_TOP = 40;
    const PAD_BOTTOM = 60;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOTTOM;

    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const barCount = data.length;
    const barGap = 8;
    const barW = barCount > 0 ? Math.max(10, (chartW - barGap * (barCount + 1)) / barCount) : 20;

    // عنوان
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title.substring(0, 40), W / 2, 22);

    // محور Y
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD_TOP + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#666666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round((i / 4) * maxVal)}%`, PAD_LEFT - 4, y + 4);
    }

    // الأعمدة
    const colors = ['#4472C4', '#ED7D31', '#A9D18E', '#FF0000', '#7030A0', '#00B0F0'];
    data.forEach((d, i) => {
      const barH = (d.value / maxVal) * chartH;
      const x = PAD_LEFT + barGap + i * (barW + barGap);
      const y = PAD_TOP + chartH - barH;

      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, barW, barH);

      // قيمة فوق العمود
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${d.value}%`, x + barW / 2, y - 3);

      // تسمية أسفل
      ctx.fillStyle = '#444444';
      ctx.font = '9px Arial';
      const lbl = d.label.length > 8 ? d.label.substring(0, 7) + '…' : d.label;
      ctx.fillText(lbl, x + barW / 2, PAD_TOP + chartH + 14);
    });

    // محور X
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP + chartH);
    ctx.lineTo(PAD_LEFT + chartW, PAD_TOP + chartH);
    ctx.stroke();

    return canvas.toDataURL('image/png').split(',')[1]; // base64 فقط
  } catch {
    return null;
  }
}

/**
 * يرسم Grouped Bar Chart للأسئلة المقارنة على Canvas ويُعيد base64 PNG.
 * كل مجموعة أعمدة تمثل إجابة، وكل عمود داخلها يمثل بيانًا (الأم/الأب/...).
 */
export function renderGroupedBarChartToPng(
  answers: string[],
  variantLabels: string[],
  variantData: number[][], // variantData[variantIdx][answerIdx] = percentage
  title: string
): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const W = 560;
    const H = 320;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const PAD_LEFT = 55;
    const PAD_RIGHT = 20;
    const PAD_TOP = 45;
    const PAD_BOTTOM = 70;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOTTOM;

    const allValues = variantData.flat();
    const maxVal = Math.max(...allValues, 1);

    const groupCount = answers.length;
    const varCount = variantLabels.length;
    const groupGap = 12;
    const barGap = 2;
    const groupW = groupCount > 0
      ? Math.max(varCount * 10, (chartW - groupGap * (groupCount + 1)) / groupCount)
      : 40;
    const barW = Math.max(8, (groupW - barGap * (varCount - 1)) / varCount);

    const variantColors = ['#4472C4', '#ED7D31', '#A9D18E', '#FF0000', '#7030A0'];

    // عنوان
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title.substring(0, 45), W / 2, 22);

    // خطوط محور Y
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD_TOP + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#666666';
      ctx.font = '9px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round((i / 4) * maxVal)}%`, PAD_LEFT - 4, y + 3);
    }

    // الأعمدة المجمعة
    answers.forEach((answer, aIdx) => {
      const groupX = PAD_LEFT + groupGap + aIdx * (groupW + groupGap);

      variantLabels.forEach((_, vIdx) => {
        const val = variantData[vIdx]?.[aIdx] ?? 0;
        const barH = (val / maxVal) * chartH;
        const x = groupX + vIdx * (barW + barGap);
        const y = PAD_TOP + chartH - barH;

        ctx.fillStyle = variantColors[vIdx % variantColors.length];
        ctx.fillRect(x, y, barW, barH);

        if (val > 0) {
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 8px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${val}%`, x + barW / 2, y - 2);
        }
      });

      // تسمية الإجابة أسفل المجموعة
      ctx.fillStyle = '#444444';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      const lbl = answer.length > 8 ? answer.substring(0, 7) + '…' : answer;
      ctx.fillText(lbl, groupX + (groupW / 2), PAD_TOP + chartH + 14);
    });

    // محور X
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP + chartH);
    ctx.lineTo(PAD_LEFT + chartW, PAD_TOP + chartH);
    ctx.stroke();

    // Legend
    const legendY = PAD_TOP + chartH + 30;
    variantLabels.forEach((lbl, vIdx) => {
      const legendX = PAD_LEFT + vIdx * 100;
      ctx.fillStyle = variantColors[vIdx % variantColors.length];
      ctx.fillRect(legendX, legendY, 14, 10);
      ctx.fillStyle = '#333333';
      ctx.font = '9px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(lbl.substring(0, 10), legendX + 18, legendY + 9);
    });

    return canvas.toDataURL('image/png').split(',')[1];
  } catch {
    return null;
  }
}

export function cleanQuestionText(text: string): string {
  // نمط يبحث عن: (أي نص) ثم (قوس فتح) ثم (محتوى - طماع) ثم (قوس إغلاق في نهاية السلسلة)
  const m = text.match(/^(.+?)\s*[\[\(](.+)[\]\)]\s*$/);
  if (m) {
    const prefix = m[1].trim();
    const content = m[2].trim();

    // إذا كان القوس في بداية النص تقريباً أو لا يوجد نص حقيقي قبله، لا نحذفه
    // أو إذا كان النص قبل القوس يبدو كأنه جزء من سؤال (مثلاً ينتهي بعلامة استفهام)
    if (prefix.length > 0 && !prefix.includes('؟')) {
      return content;
    }
  }
  return text;
}

