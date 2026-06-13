import { useState, useRef, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LabelList,
} from 'recharts';
import { toPng } from 'html-to-image';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// ─── Color Palettes (Excel-style) ───
const COLOR_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'كلاسيكي', colors: ['#6366F1','#06B6D4','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#3B82F6','#A855F7','#84CC16'] },
  { name: 'أزرق', colors: ['#1e3a5f','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'] },
  { name: 'أخضر', colors: ['#14532d','#15803d','#22c55e','#4ade80','#86efac','#bbf7d0','#166534','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0'] },
  { name: 'غروب', colors: ['#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#9a3412','#c2410c','#ea580c','#f97316','#fb923c','#fdba74'] },
  { name: 'بنفسجي', colors: ['#4c1d95','#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#5b21b6','#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd'] },
  { name: 'بحري', colors: ['#164e63','#0e7490','#06b6d4','#22d3ee','#67e8f9','#a5f3fc','#155e75','#0891b2','#06b6d4','#22d3ee','#67e8f9','#a5f3fc'] },
  { name: 'وردي', colors: ['#831843','#be185d','#ec4899','#f472b6','#f9a8d4','#fbcfe8','#9d174d','#db2777','#ec4899','#f472b6','#f9a8d4','#fbcfe8'] },
  { name: 'ترابي', colors: ['#78350f','#92400e','#b45309','#d97706','#f59e0b','#fbbf24','#a16207','#ca8a04','#eab308','#facc15','#fde047','#fef08a'] },
  { name: 'رمادي', colors: ['#18181b','#3f3f46','#52525b','#71717a','#a1a1aa','#d4d4d8','#27272a','#3f3f46','#52525b','#71717a','#a1a1aa','#d4d4d8'] },
  { name: 'متعدد', colors: ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#a855f7','#84cc16'] },
];

type ChartType = 'bar' | 'horizontal-bar' | 'stacked-bar' | 'pie' | 'donut' | 'line' | 'area' | 'radar';

interface ChartDataItem {
  name: string;
  value: number;
  percentage: number;
}

interface ChartWidgetProps {
  data: ChartDataItem[];
  title: string;
  id: string;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar', label: 'أعمدة', icon: '📊' },
  { value: 'horizontal-bar', label: 'أفقي', icon: '📶' },
  { value: 'pie', label: 'دائري', icon: '🥧' },
  { value: 'donut', label: 'حلقي', icon: '🍩' },
  { value: 'line', label: 'خطي', icon: '📈' },
  { value: 'area', label: 'مساحي', icon: '📉' },
  { value: 'radar', label: 'رادار', icon: '🕸️' },
];

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight ? {
    theme: 'light' as const, bg: '#FFFFFF',
    axisText: '#6b7280', axisTextBold: '#374151', labelText: '#374151',
    grid: 'rgba(0,0,0,0.06)', tooltipBg: '#ffffff', tooltipBorder: '1px solid rgba(0,0,0,0.1)',
    tooltipColor: '#111827', tooltipShadow: '0 8px 24px rgba(0,0,0,0.12)',
    cursor: 'rgba(99,102,241,0.06)', axisLine: 'rgba(0,0,0,0.08)',
    dotStroke: '#ffffff', cellStroke: 'rgba(255,255,255,0.8)', labelLineStroke: '#9ca3af',
  } : {
    theme: 'dark' as const, bg: '#1A2332',
    axisText: '#94A3B8', axisTextBold: '#CBD5E1', labelText: '#CBD5E1',
    grid: 'rgba(148,163,184,0.08)', tooltipBg: '#0F172A', tooltipBorder: '1px solid rgba(99,102,241,0.3)',
    tooltipColor: '#F1F5F9', tooltipShadow: '0 8px 32px rgba(0,0,0,0.4)',
    cursor: 'rgba(99,102,241,0.08)', axisLine: 'rgba(148,163,184,0.15)',
    dotStroke: '#1E293B', cellStroke: 'rgba(0,0,0,0.2)', labelLineStroke: '#64748B',
  };
}

export default function ChartWidget({ data, title, id }: ChartWidgetProps) {
  // ─── State ───
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showTitle, setShowTitle] = useState(true);
  const [chartTitle, setChartTitle] = useState(title);
  const [showAxisLabels, setShowAxisLabels] = useState(true);
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showPercentage, setShowPercentage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'type' | 'style' | 'elements' | 'format'>('none');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [barRadius, setBarRadius] = useState(8);
  const [lineWidth, setLineWidth] = useState(3);
  const [dotSize, setDotSize] = useState(6);
  const [fontSize, setFontSize] = useState(11);
  const [labelPosition, setLabelPosition] = useState<'top' | 'inside' | 'outside' | 'center'>('top');
  const [numberFormat, setNumberFormat] = useState<'plain' | 'comma' | 'decimal1' | 'decimal2'>('plain');
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [maxItems, setMaxItems] = useState(0); // 0 = all

  const [, setThemeTick] = useState(0);
  useState(() => {
    const obs = new MutationObserver(() => setThemeTick(t => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  const chartRef = useRef<HTMLDivElement>(null);
  const c = getThemeColors();
  const currentPalette = COLOR_PALETTES[paletteIndex].colors;

  const tooltipStyle = {
    background: c.tooltipBg, border: c.tooltipBorder, borderRadius: 10,
    color: c.tooltipColor, direction: 'rtl' as const, fontFamily: 'Cairo',
    boxShadow: c.tooltipShadow, fontSize: fontSize,
  };

  // ─── Format number ───
  const fmtNum = useCallback((val: any): string => {
    const n = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(n)) return String(val);
    switch (numberFormat) {
      case 'comma': return n.toLocaleString('en-US');
      case 'decimal1': return n.toFixed(1);
      case 'decimal2': return n.toFixed(2);
      default: return String(n);
    }
  }, [numberFormat]);

  const fmtDisplay = useCallback((val: any): string => {
    return showPercentage ? `${fmtNum(val)}%` : fmtNum(val);
  }, [showPercentage, fmtNum]);

  // ─── Process data ───
  const chartData = useMemo(() => {
    let processed = data.map(item => ({
      name: item.name.length > 20 ? item.name.slice(0, 20) + '…' : item.name,
      fullName: item.name,
      القيمة: item.value,
      النسبة: item.percentage,
    }));

    if (sortOrder === 'asc') {
      processed = [...processed].sort((a, b) => (showPercentage ? a.النسبة - b.النسبة : a.القيمة - b.القيمة));
    } else if (sortOrder === 'desc') {
      processed = [...processed].sort((a, b) => (showPercentage ? b.النسبة - a.النسبة : b.القيمة - a.القيمة));
    }

    if (maxItems > 0 && processed.length > maxItems) {
      processed = processed.slice(0, maxItems);
    }

    return processed;
  }, [data, sortOrder, showPercentage, maxItems]);

  const displayKey = showPercentage ? 'النسبة' : 'القيمة';

  // ─── Export ───
  const handleExport = useCallback(async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      // Wait enough for chart animations (600ms) + render buffer
      await new Promise(r => setTimeout(r, 800));
      const colors = getThemeColors();

      const dataUrl = await toPng(chartRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: colors.bg,
        cacheBust: true,
        skipFonts: false,
        filter: (node: HTMLElement) => {
          // Only exclude toolbar
          if (node.dataset && node.dataset.excludeExport === 'true') return false;
          return true;
        },
      });

      const resp = await fetch(dataUrl);
      const buf = await resp.arrayBuffer();
      const filePath = await save({ defaultPath: `chart_${id}.png`, filters: [{ name: 'صور PNG', extensions: ['png'] }] });
      if (filePath) await writeFile(filePath, new Uint8Array(buf));
    } catch (e) { console.error('Export error:', e); }
    finally { setIsExporting(false); }
  }, [id]);

  // ─── Render charts ───
  const renderChart = () => {
    const labelListProps = {
      dataKey: displayKey,
      position: labelPosition as any,
      style: { fill: c.labelText, fontSize, fontFamily: 'Cairo', fontWeight: 600 },
      formatter: fmtDisplay,
    };

    const xAxisProps = {
      dataKey: 'name' as const,
      tick: showAxisLabels ? { fill: c.axisText, fontSize, fontFamily: 'Cairo' } : false as const,
      angle: -35, textAnchor: 'end' as const,
      height: showAxisLabels ? 80 : 20,
      axisLine: { stroke: c.axisLine }, tickLine: false,
      label: (xAxisTitle ? { value: xAxisTitle, fill: c.axisTextBold, fontSize: fontSize + 1, fontFamily: 'Cairo', position: 'insideBottom', offset: -5 } : undefined) as any,
    };

    const yAxisProps = {
      tick: showAxisLabels ? { fill: c.axisText, fontSize, fontFamily: 'Cairo' } : false as const,
      axisLine: false, tickLine: false,
      label: (yAxisTitle ? { value: yAxisTitle, fill: c.axisTextBold, fontSize: fontSize + 1, fontFamily: 'Cairo', angle: -90, position: 'insideLeft' } : undefined) as any,
    };

    const tooltipFormatter = (value: any, _: any, props: any) => [fmtDisplay(value), props?.payload?.fullName || 'القيمة'];
    const simpleFormatter = (value: any) => [fmtDisplay(value), displayKey];

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: showAxisLabels ? 70 : 20 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} cursor={{ fill: c.cursor }} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize }} />}
              <Bar dataKey={displayKey} radius={[barRadius, barRadius, 0, 0]} maxBarSize={60} animationDuration={600}>
                {chartData.map((_, i) => <Cell key={i} fill={currentPalette[i % currentPalette.length]} />)}
                {(showDataLabels || showValues) && <LabelList {...labelListProps} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal-bar':
        return (
          <ResponsiveContainer width="100%" height={Math.max(340, chartData.length * 45)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 40, left: showAxisLabels ? 120 : 20, bottom: 10 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />}
              <XAxis type="number" tick={showAxisLabels ? { fill: c.axisText, fontSize, fontFamily: 'Cairo' } : false} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={showAxisLabels ? { fill: c.axisTextBold, fontSize, fontFamily: 'Cairo' } : false} width={showAxisLabels ? 110 : 10} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize }} />}
              <Bar dataKey={displayKey} radius={[0, barRadius, barRadius, 0]} maxBarSize={35} animationDuration={600}>
                {chartData.map((_, i) => <Cell key={i} fill={currentPalette[i % currentPalette.length]} />)}
                {(showDataLabels || showValues) && <LabelList {...labelListProps} position="right" />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
              <Pie
                data={chartData.map(d => ({ ...d, value: d[displayKey] }))}
                cx="50%" cy="50%"
                innerRadius={chartType === 'donut' ? 55 : 0}
                outerRadius={100}
                paddingAngle={chartType === 'donut' ? 4 : 2}
                dataKey="value"
                animationDuration={600}
                label={showDataLabels ? (props: any) => {
                  const dn = (props.fullName || props.name || '');
                  const sn = dn.length > 12 ? dn.slice(0, 12) + '..' : dn;
                  return showValues ? `${sn} (${(props.percent * 100).toFixed(1)}%)` : sn;
                } : showValues ? (props: any) => `${(props.percent * 100).toFixed(1)}%` : false}
                labelLine={showDataLabels || showValues ? { stroke: c.labelLineStroke, strokeWidth: 1 } : false}
              >
                {chartData.map((_, i) => <Cell key={i} fill={currentPalette[i % currentPalette.length]} stroke={c.cellStroke} strokeWidth={1} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize, paddingTop: 10 }} iconType="circle" />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: showAxisLabels ? 70 : 20 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} formatter={simpleFormatter} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize }} />}
              <Line type="monotone" dataKey={displayKey} stroke={currentPalette[0]} strokeWidth={lineWidth} dot={{ fill: currentPalette[0], strokeWidth: 2, r: dotSize, stroke: c.dotStroke }} activeDot={{ r: dotSize + 2, fill: currentPalette[1] || currentPalette[0], stroke: c.dotStroke, strokeWidth: 2 }} animationDuration={600}>
                {showValues && <LabelList {...labelListProps} offset={12} />}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: showAxisLabels ? 70 : 20 }}>
              <defs>
                <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentPalette[0]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={currentPalette[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} formatter={simpleFormatter} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize }} />}
              <Area type="monotone" dataKey={displayKey} stroke={currentPalette[0]} strokeWidth={lineWidth} fill={`url(#grad-${id})`} dot={{ fill: currentPalette[0], strokeWidth: 2, r: dotSize, stroke: c.dotStroke }} animationDuration={600}>
                {showValues && <LabelList {...labelListProps} offset={12} />}
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={370}>
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke={c.grid} />
              <PolarAngleAxis dataKey="name" tick={showAxisLabels ? { fill: c.axisTextBold, fontSize, fontFamily: 'Cairo' } : false} />
              <PolarRadiusAxis tick={showAxisLabels ? { fill: c.axisText, fontSize: fontSize - 1 } : false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              {showLegend && <Legend wrapperStyle={{ direction: 'rtl', fontFamily: 'Cairo', fontSize }} />}
              <Radar dataKey={displayKey} stroke={currentPalette[0]} fill={currentPalette[0]} fillOpacity={0.25} strokeWidth={lineWidth} dot={{ fill: currentPalette[1] || currentPalette[0], r: dotSize - 2 }} animationDuration={600} />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // ─── Panel toggle ───
  const togglePanel = (panel: typeof activePanel) => {
    setActivePanel(prev => prev === panel ? 'none' : panel);
  };

  return (
    <div id={id} className="chart-widget">
      <div ref={chartRef} className="chart-widget-canvas">
        {showTitle && (
          <div className="chart-widget-title">{chartTitle}</div>
        )}
        <div className="chart-widget-body">{renderChart()}</div>

        {/* ─── Toolbar ─── */}
        <div data-exclude-export="true" className="chart-widget-toolbar">
          {/* Panel Tabs */}
          <div className="chart-panel-tabs">
            <button className={`chart-panel-tab ${activePanel === 'type' ? 'active' : ''}`} onClick={() => togglePanel('type')}>📊 نوع الشكل</button>
            <button className={`chart-panel-tab ${activePanel === 'style' ? 'active' : ''}`} onClick={() => togglePanel('style')}>🎨 الألوان</button>
            <button className={`chart-panel-tab ${activePanel === 'elements' ? 'active' : ''}`} onClick={() => togglePanel('elements')}>⚙️ العناصر</button>
            <button className={`chart-panel-tab ${activePanel === 'format' ? 'active' : ''}`} onClick={() => togglePanel('format')}>🔧 التنسيق</button>

            <button className="chart-export-btn" onClick={handleExport} disabled={isExporting} style={{ marginRight: 'auto', marginLeft: 0 }}>
              {isExporting ? <><span className="chart-export-spinner"></span> تصدير...</> : <>📷 حفظ كصورة</>}
            </button>
          </div>

          {/* ─── Type Panel ─── */}
          {activePanel === 'type' && (
            <div className="chart-panel-content">
              <div className="chart-type-selector">
                {CHART_TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} className={`chart-type-btn ${chartType === opt.value ? 'active' : ''}`} onClick={() => setChartType(opt.value)} title={opt.label}>
                    <span className="chart-type-icon">{opt.icon}</span>
                    <span className="chart-type-label">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="chart-option-row">
                <label className="chart-option-label">ترتيب البيانات</label>
                <select className="chart-option-select" value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}>
                  <option value="none">بدون ترتيب</option>
                  <option value="asc">تصاعدي ↑</option>
                  <option value="desc">تنازلي ↓</option>
                </select>
              </div>

              <div className="chart-option-row">
                <label className="chart-option-label">عدد العناصر المعروضة</label>
                <select className="chart-option-select" value={maxItems} onChange={e => setMaxItems(Number(e.target.value))}>
                  <option value={0}>الكل</option>
                  <option value={3}>أفضل 3</option>
                  <option value={5}>أفضل 5</option>
                  <option value={7}>أفضل 7</option>
                  <option value={10}>أفضل 10</option>
                </select>
              </div>
            </div>
          )}

          {/* ─── Style Panel ─── */}
          {activePanel === 'style' && (
            <div className="chart-panel-content">
              <div className="chart-option-label" style={{ marginBottom: 8 }}>لوحة الألوان</div>
              <div className="chart-palette-grid">
                {COLOR_PALETTES.map((pal, idx) => (
                  <button key={idx} className={`chart-palette-item ${idx === paletteIndex ? 'active' : ''}`} onClick={() => setPaletteIndex(idx)} title={pal.name}>
                    <div className="chart-palette-preview">
                      {pal.colors.slice(0, 6).map((col, ci) => (
                        <div key={ci} className="chart-palette-swatch" style={{ background: col }} />
                      ))}
                    </div>
                    <span className="chart-palette-name">{pal.name}</span>
                  </button>
                ))}
              </div>

              {(chartType === 'bar' || chartType === 'horizontal-bar') && (
                <div className="chart-option-row">
                  <label className="chart-option-label">استدارة الأعمدة</label>
                  <input type="range" min="0" max="20" value={barRadius} onChange={e => setBarRadius(Number(e.target.value))} className="chart-range" />
                  <span className="chart-range-val">{barRadius}px</span>
                </div>
              )}

              {(chartType === 'line' || chartType === 'area' || chartType === 'radar') && (
                <>
                  <div className="chart-option-row">
                    <label className="chart-option-label">سُمك الخط</label>
                    <input type="range" min="1" max="6" step="0.5" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="chart-range" />
                    <span className="chart-range-val">{lineWidth}px</span>
                  </div>
                  <div className="chart-option-row">
                    <label className="chart-option-label">حجم النقاط</label>
                    <input type="range" min="2" max="10" value={dotSize} onChange={e => setDotSize(Number(e.target.value))} className="chart-range" />
                    <span className="chart-range-val">{dotSize}px</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Elements Panel ─── */}
          {activePanel === 'elements' && (
            <div className="chart-panel-content">
              <div className="chart-toggles-grid">
                <label className="chart-toggle"><input type="checkbox" checked={showTitle} onChange={e => setShowTitle(e.target.checked)} /><span className="chart-toggle-slider"></span>العنوان</label>
                <label className="chart-toggle"><input type="checkbox" checked={showAxisLabels} onChange={e => setShowAxisLabels(e.target.checked)} /><span className="chart-toggle-slider"></span>تسميات المحاور</label>
                <label className="chart-toggle"><input type="checkbox" checked={showDataLabels} onChange={e => setShowDataLabels(e.target.checked)} /><span className="chart-toggle-slider"></span>أسماء البيانات</label>
                <label className="chart-toggle"><input type="checkbox" checked={showValues} onChange={e => setShowValues(e.target.checked)} /><span className="chart-toggle-slider"></span>القيم</label>
                <label className="chart-toggle"><input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} /><span className="chart-toggle-slider"></span>وسيلة الإيضاح</label>
                <label className="chart-toggle"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /><span className="chart-toggle-slider"></span>خطوط الشبكة</label>
                <label className="chart-toggle"><input type="checkbox" checked={showPercentage} onChange={e => setShowPercentage(e.target.checked)} /><span className="chart-toggle-slider"></span>النسبة المئوية</label>
              </div>

              {showTitle && (
                <div className="chart-option-row">
                  <label className="chart-option-label">نص العنوان</label>
                  <input type="text" className="chart-option-input" value={chartTitle} onChange={e => setChartTitle(e.target.value)} placeholder="عنوان الشكل" />
                </div>
              )}

              <div className="chart-option-row">
                <label className="chart-option-label">عنوان المحور الأفقي</label>
                <input type="text" className="chart-option-input" value={xAxisTitle} onChange={e => setXAxisTitle(e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
              </div>
              <div className="chart-option-row">
                <label className="chart-option-label">عنوان المحور الرأسي</label>
                <input type="text" className="chart-option-input" value={yAxisTitle} onChange={e => setYAxisTitle(e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
              </div>
            </div>
          )}

          {/* ─── Format Panel ─── */}
          {activePanel === 'format' && (
            <div className="chart-panel-content">
              <div className="chart-option-row">
                <label className="chart-option-label">حجم الخط</label>
                <input type="range" min="8" max="16" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="chart-range" />
                <span className="chart-range-val">{fontSize}px</span>
              </div>

              <div className="chart-option-row">
                <label className="chart-option-label">تنسيق الأرقام</label>
                <select className="chart-option-select" value={numberFormat} onChange={e => setNumberFormat(e.target.value as any)}>
                  <option value="plain">عادي (123)</option>
                  <option value="comma">فواصل (1,234)</option>
                  <option value="decimal1">عشري واحد (1.2)</option>
                  <option value="decimal2">عشري اثنين (1.23)</option>
                </select>
              </div>

              {(chartType === 'bar' || chartType === 'line' || chartType === 'area') && (showDataLabels || showValues) && (
                <div className="chart-option-row">
                  <label className="chart-option-label">موضع القيم</label>
                  <select className="chart-option-select" value={labelPosition} onChange={e => setLabelPosition(e.target.value as any)}>
                    <option value="top">أعلى</option>
                    <option value="inside">داخل</option>
                    <option value="center">وسط</option>
                    <option value="outside">خارج</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
