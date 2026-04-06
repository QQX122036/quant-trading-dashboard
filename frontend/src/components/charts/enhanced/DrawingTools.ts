/**
 * DrawingTools.ts — 绘图工具类型与工具类
 * 支持：趋势线、斐波那契回调、矩形、圆形、文字标注、预警线
 */
import { Time } from 'lightweight-charts';

export type DrawingToolType = 'trendline' | 'fibonacci' | 'rectangle' | 'circle' | 'text' | 'alertline';

export interface DrawPoint { x: number; y: number; time: Time; price: number; }

export interface DrawingBase {
  id: string;
  type: DrawingToolType;
  color: string;
  visible: boolean;
  locked?: boolean;
}

export interface TrendLine extends DrawingBase {
  type: 'trendline';
  points: [DrawPoint, DrawPoint];
  extended?: boolean;
}

export interface FibonacciLine extends DrawingBase {
  type: 'fibonacci';
  points: [DrawPoint, DrawPoint]; // 0% (high) → 100% (low)
  levels: number[]; // [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
  showLabels?: boolean;
}

export interface RectangleAnnotation extends DrawingBase {
  type: 'rectangle';
  points: [DrawPoint, DrawPoint]; // topLeft, bottomRight
  fillColor?: string;
  fillOpacity?: number;
}

export interface CircleAnnotation extends DrawingBase {
  type: 'circle';
  center: DrawPoint;
  radius: number; // in price units
  fillColor?: string;
  fillOpacity?: number;
}

export interface TextAnnotation extends DrawingBase {
  type: 'text';
  point: DrawPoint;
  text: string;
  fontSize?: number;
  backgroundColor?: string;
}

export interface AlertLine extends DrawingBase {
  type: 'alertline';
  price: number;
  triggered?: boolean;
  soundAlert?: boolean;
}

export type Drawing = TrendLine | FibonacciLine | RectangleAnnotation | CircleAnnotation | TextAnnotation | AlertLine;

// Fibonacci levels
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
export const FIB_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];

// Predefined colors for stock comparison
export const COMPARISON_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

let _drawingIdCounter = 0;
export function newDrawingId() {
  return `draw_${Date.now()}_${++_drawingIdCounter}`;
}

export function createTrendLine(p1: DrawPoint, p2: DrawPoint, color = '#3B82F6'): TrendLine {
  return { id: newDrawingId(), type: 'trendline', points: [p1, p2], color, visible: true };
}

export function createFibonacci(p1: DrawPoint, p2: DrawPoint, color = '#F59E0B'): FibonacciLine {
  return {
    id: newDrawingId(), type: 'fibonacci', points: [p1, p2],
    levels: FIB_LEVELS, color, visible: true, showLabels: true,
  };
}

export function createRectangle(p1: DrawPoint, p2: DrawPoint, color = '#3B82F6'): RectangleAnnotation {
  return {
    id: newDrawingId(), type: 'rectangle', points: [p1, p2],
    color, visible: true, fillColor: color, fillOpacity: 0.1,
  };
}

export function createCircle(center: DrawPoint, radius: number, color = '#8B5CF6'): CircleAnnotation {
  return {
    id: newDrawingId(), type: 'circle', center, radius,
    color, visible: true, fillColor: color, fillOpacity: 0.1,
  };
}

export function createTextAnnotation(point: DrawPoint, text: string, color = '#FFFFFF'): TextAnnotation {
  return {
    id: newDrawingId(), type: 'text', point, text,
    color, visible: true, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)',
  };
}

export function createAlertLine(price: number, color = '#EF4444'): AlertLine {
  return {
    id: newDrawingId(), type: 'alertline', price,
    color, visible: true, triggered: false,
  };
}

// Compute Fibonacci price levels between high and low
export function getFibPrices(high: number, low: number, levels = FIB_LEVELS): Array<{ level: number; price: number }> {
  return levels.map((l) => ({ level: l, price: high - (high - low) * l }));
}

// Check if alert line is triggered by current price
export function isAlertTriggered(alert: AlertLine, currentPrice: number, tolerance = 0.001): boolean {
  return Math.abs(currentPrice - alert.price) / alert.price <= tolerance;
}
