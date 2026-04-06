/**
 * pdfExport.ts — PDF 导出工具
 * 支持：回测报告、个股分析报告
 * 使用 jsPDF + html2canvas + ECharts getDataURL
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ECharts } from 'echarts';

// ── 水印工具 ────────────────────────────────────────────────
function addWatermark(doc: jsPDF, text = '量化分析报告'): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(40);
  doc.setTextColor(200, 200, 200, 0.25);
  doc.text(text, pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
  });
  doc.setTextColor(0, 0, 0, 1);
}

// ── 页眉页脚 ────────────────────────────────────────────────
function addHeaderFooter(doc: jsPDF, pageNum: number, totalPages: number, genTime: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`第 ${pageNum} / ${totalPages} 页`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  doc.text(`生成时间: ${genTime}`, margin, pageHeight - 8);
  doc.text('本报告仅供参考，不构成投资建议', pageWidth - margin, pageHeight - 8, { align: 'right' });

  // Reset
  doc.setTextColor(0, 0, 0);
}

// ── 通用：div → canvas → imageDataURL ─────────────────────
export async function divToImageDataURL(elementId: string, scale = 2): Promise<string> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found`);
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#0f172a',
    logging: false,
  });
  return canvas.toDataURL('image/png', 1.0);
}

// ── ECharts 实例 → imageDataURL ───────────────────────────
export function echartsToImageDataURL(chart: ECharts, pixelRatio = 2): string {
  return chart.getDataURL({
    type: 'png',
    pixelRatio,
    backgroundColor: '#0f172a',
  });
}

// ── 核心导出函数 ────────────────────────────────────────────
export interface ExportPdfOptions {
  filename?: string;
  watermark?: string;
  scale?: number;
}

export async function exportToPdf(
  elementId: string,
  filename = 'report',
  options: ExportPdfOptions = {}
): Promise<void> {
  const { watermark = '量化分析报告', scale = 2 } = options;

  const imgDataURL = await divToImageDataURL(elementId, scale);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2 - 20; // leave room for header/footer

  // Add watermark to first page
  addWatermark(doc, watermark);

  const img = new Image();
  img.src = imgDataURL;
  const imgWidthPx = img.width || 800;
  const imgHeightPx = img.height || 600;

  // Calculate image dimensions to fit page
  const ratio = contentWidth / (imgWidthPx / scale * 0.264583); // px→mm
  const imgDisplayWidth = contentWidth;
  const imgDisplayHeight = Math.min((imgHeightPx / scale) * 0.264583 * ratio, contentHeight);

  let yOffset = margin;

  // Split into pages if image is tall
  let srcY = 0;
  while (srcY < imgHeightPx) {
    const srcH = Math.min(
      ((contentHeight - 8) / (imgDisplayWidth / imgWidthPx)) * scale,
      imgHeightPx - srcY
    );

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgWidthPx;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.drawImage(
      await loadImage(imgDataURL),
      0, srcY, imgWidthPx, srcH,
      0, 0, imgWidthPx, srcH
    );

    const pageImgData = pageCanvas.toDataURL('image/png', 1.0);

    if (srcY > 0) doc.addPage();

    // Watermark on every page
    addWatermark(doc, watermark);

    const genTime = new Date().toLocaleString('zh-CN');
    const pageNum = Math.floor(srcY / (srcH)) + 1;
    const totalPages = Math.ceil(imgHeightPx / srcH);

    // Header
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(watermark, margin, margin - 4);
    doc.text(genTime, pageWidth - margin, margin - 4, { align: 'right' });

    doc.addImage(pageImgData, 'PNG', margin, margin + 4, contentWidth, imgDisplayHeight * (srcH / imgHeightPx));

    // Footer
    addHeaderFooter(doc, Math.floor(srcY / srcH) + 1, totalPages, genTime);

    srcY += srcH;
  }

  doc.save(`${filename}.pdf`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── 回测报告专用导出 ────────────────────────────────────────
export interface BacktestReportData {
  strategyName: string;
  backtestPeriod: string;
  sharpeRatio: number;
  maxDrawdown: number;
  annualReturn: number;
  totalReturn: number;
  calmarRatio: number;
  winRate: number;
  totalTrades: number;
  profitLossRatio: number;
  excessReturn: number;
  initialCapital: number;
  endCapital: number;
  tsCode: string;
  strategyType: string;
  monthlyReturns?: Array<{ year: string; month: string; return: number }>;
  trades?: Array<{
    date: string;
    stock: string;
    direction: string;
    price: number;
    volume: number;
    pnl?: number;
  }>;
}

export async function exportBacktestReport(
  charts: {
    equityChart: ECharts | undefined;
    drawdownChart: ECharts | undefined;
    monthlyChart: ECharts | undefined;
  },
  data: BacktestReportData,
  filename = 'backtest_report'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const genTime = new Date().toLocaleString('zh-CN');
  const watermark = '量化分析报告';

  // ── Page 1: 封面 ───────────────────────────────────────
  addWatermark(doc, watermark);

  // Title
  doc.setFontSize(22);
  doc.setTextColor(59, 130, 246);
  doc.text('量化回测报告', pageWidth / 2, 50, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(150, 150, 150);
  doc.text('Quantitative Backtest Report', pageWidth / 2, 60, { align: 'center' });

  // Strategy info box
  doc.setFillColor(17, 24, 39);
  doc.roundedRect(margin, 72, contentWidth, 60, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`策略名称: ${data.strategyName}`, margin + 6, 82);
  doc.text(`回测区间: ${data.backtestPeriod}`, margin + 6, 90);
  doc.text(`标的代码: ${data.tsCode}`, margin + 6, 98);
  doc.text(`策略类型: ${data.strategyType}`, margin + 6, 106);

  // Key metrics
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  const metrics = [
    ['年化收益率', `${data.annualReturn >= 0 ? '+' : ''}${data.annualReturn.toFixed(2)}%`, data.annualReturn >= 0 ? '#3B82F6' : '#22C55E'],
    ['夏普比率', data.sharpeRatio.toFixed(2), '#3B82F6'],
    ['最大回撤', `${data.maxDrawdown.toFixed(2)}%`, '#EF4444'],
    ['卡玛比率', data.calmarRatio.toFixed(2), '#3B82F6'],
  ];
  const colW = contentWidth / 4;
  metrics.forEach(([label, value, color], i) => {
    const x = margin + i * colW;
    doc.setTextColor(150, 150, 150);
    doc.text(label, x + colW / 2, 120, { align: 'center' });
    doc.setFontSize(14);
    const hex = color === '#3B82F6' ? [59, 130, 246] : color === '#EF4444' ? [239, 68, 68] : [34, 197, 94];
    doc.setTextColor(hex[0], hex[1], hex[2]);
    doc.text(value, x + colW / 2, 128, { align: 'center' });
    doc.setFontSize(10);
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`生成时间: ${genTime}`, margin, pageHeight - 8);
  doc.text('本报告仅供参考，不构成投资建议', pageWidth - margin, pageHeight - 8, { align: 'right' });

  // ── Page 2+: 图表页 ─────────────────────────────────────
  const addChartPage = async (chart: ECharts | undefined, title: string) => {
    if (!chart) return;
    doc.addPage();
    addWatermark(doc, watermark);

    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin, margin + 2);

    const imgData = echartsToImageDataURL(chart, 2);
    const img = await loadImage(imgData);
    const ratio = contentWidth / (img.width * 0.264583);
    const imgH = img.height * 0.264583 * ratio;
    const displayH = Math.min(imgH, pageHeight - margin * 2 - 20);

    doc.addImage(imgData, 'PNG', margin, margin + 8, contentWidth, displayH);
    addHeaderFooter(doc, 1, 1, genTime);
  };

  await addChartPage(charts.equityChart, '收益率曲线');
  await addChartPage(charts.drawdownChart, '回撤分析');
  await addChartPage(charts.monthlyChart, '月度收益热力图');

  // ── 绩效指标表 ───────────────────────────────────────────
  doc.addPage();
  addWatermark(doc, watermark);
  addHeaderFooter(doc, 1, 1, genTime);

  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('绩效指标', margin, margin + 2);

  const metrics2 = [
    ['指标', '数值', '说明'],
    ['总收益率', `${data.totalReturn >= 0 ? '+' : ''}${data.totalReturn.toFixed(2)}%`, '期末相对期初总增长'],
    ['年化收益率', `${data.annualReturn >= 0 ? '+' : ''}${data.annualReturn.toFixed(2)}%`, '年化收益水平'],
    ['夏普比率', data.sharpeRatio.toFixed(2), '风险调整后收益'],
    ['卡玛比率', data.calmarRatio.toFixed(2), '年化收益/最大回撤'],
    ['最大回撤', `${data.maxDrawdown.toFixed(2)}%`, '历史最大亏损幅度'],
    ['超额收益', `${data.excessReturn >= 0 ? '+' : ''}${data.excessReturn.toFixed(2)}%`, '相对基准超额回报'],
    ['胜率', `${(data.winRate * 100).toFixed(1)}%`, '盈利交易占比'],
    ['总交易次数', String(data.totalTrades), '回测区间内交易总数'],
    ['盈亏比', data.profitLossRatio.toFixed(2), '平均盈利/平均亏损'],
    ['期初资金', `${data.initialCapital.toLocaleString()}`, '回测起始资金'],
    ['期末资金', `${data.endCapital.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, '回测结束资金'],
  ];

  const startY = margin + 10;
  const rowH = 8;
  const colWidths = [40, 35, contentWidth - 75];
  const cols = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1]];

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, startY, contentWidth, rowH, 'F');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  metrics2[0].forEach((h, i) => doc.text(h, cols[i] + 2, startY + 5.5));

  metrics2.slice(1).forEach((row, ri) => {
    const y = startY + (ri + 1) * rowH;
    if (ri % 2 === 0) {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(9);
    row.forEach((cell, ci) => {
      if (ci === 1) {
        const isPositive = parseFloat(cell) >= 0;
        doc.setTextColor(isPositive ? 59 : 239, isPositive ? 130 : 68, isPositive ? 246 : 68);
        doc.setFontSize(10);
      } else {
        doc.setTextColor(180, 180, 180);
        doc.setFontSize(9);
      }
      doc.text(cell, cols[ci] + 2, y + 5.5);
    });
  });

  // ── 交易明细表 ──────────────────────────────────────────
  if (data.trades && data.trades.length > 0) {
    doc.addPage();
    addWatermark(doc, watermark);
    addHeaderFooter(doc, 1, 1, genTime);

    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('交易明细', margin, margin + 2);

    const tradeHeaders = ['时间', '标的', '方向', '价格', '数量', '盈亏(P&L)'];
    const tradeColWidths = [30, 25, 15, 25, 25, contentWidth - 120];
    const tradeCols = [margin];
    tradeColWidths.slice(0, -1).reduce((acc, w) => {
      acc.push(acc[acc.length - 1] + w);
      return acc;
    }, tradeCols);

    const tradeStartY = margin + 10;
    const tradeRowH = 7;

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, tradeStartY, contentWidth, tradeRowH, 'F');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    tradeHeaders.forEach((h, i) => doc.text(h, tradeCols[i] + 2, tradeStartY + 5));

    data.trades.slice(0, 50).forEach((t, ri) => {
      const y = tradeStartY + (ri + 1) * tradeRowH;
      if (ri % 2 === 0) {
        doc.setFillColor(15, 23, 42);
        doc.rect(margin, y, contentWidth, tradeRowH, 'F');
      }
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(t.date, tradeCols[0] + 2, y + 5);
      doc.text(t.stock, tradeCols[1] + 2, y + 5);
      const isLong = t.direction === '买入' || t.direction === 'long';
      doc.setTextColor(isLong ? 239 : 34, isLong ? 68 : 68, isLong ? 68 : 68);
      doc.text(t.direction, tradeCols[2] + 2, y + 5);
      doc.setTextColor(180, 180, 180);
      doc.text(t.price.toFixed(2), tradeCols[3] + 2, y + 5);
      doc.text(String(t.volume), tradeCols[4] + 2, y + 5);
      if (t.pnl !== undefined) {
        doc.setTextColor(t.pnl >= 0 ? 59 : 239, t.pnl >= 0 ? 130 : 68, t.pnl >= 0 ? 246 : 68);
        doc.text(`${t.pnl >= 0 ? '+' : ''}${(t.pnl).toFixed(2)}`, tradeCols[5] + 2, y + 5);
      }
    });

    if (data.trades.length > 50) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text(`... 共 ${data.trades.length} 条记录，仅显示前50条`, margin, tradeStartY + (51) * tradeRowH + 5);
    }
  }

  doc.save(`${filename}.pdf`);
}

// ── ECharts 直接导出PDF ────────────────────────────────────
export async function exportEchartsToPdf(
  chart: ECharts,
  title: string,
  filename = 'chart',
  options: ExportPdfOptions = {}
): Promise<void> {
  const { watermark = '量化分析报告' } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const genTime = new Date().toLocaleString('zh-CN');

  addWatermark(doc, watermark);

  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin, margin + 2);

  const imgData = echartsToImageDataURL(chart, 2);
  const img = await loadImage(imgData);
  const ratio = contentWidth / (img.width * 0.264583);
  const imgH = img.height * 0.264583 * ratio;

  doc.addImage(imgData, 'PNG', margin, margin + 8, contentWidth, Math.min(imgH, contentHeight - 16));

  addHeaderFooter(doc, 1, 1, genTime);

  doc.save(`${filename}.pdf`);
}
