// ============================================================
// Design Review MVP - 类型定义
// ============================================================

/** 输入来源: URL 或本地截图路径 */
export interface InputSource {
  /** 线上页面 URL (与 pageScreenshot 二选一) */
  pageUrl?: string;
  /** 页面截图本地路径 (与 pageUrl 二选一) */
  pageScreenshot?: string;
  /** Figma 文件链接 (与 figmaScreenshot 二选一) */
  figmaUrl?: string;
  /** Figma 设计稿截图本地路径 (与 figmaUrl 二选一) */
  figmaScreenshot?: string;
  figmaToken?: string;
  options?: Partial<ReviewOptions>;
}

/** @deprecated 使用 InputSource 代替 */
export type ReviewInput = InputSource;

export interface ReviewOptions {
  tolerance: ToleranceConfig;
  output: OutputConfig;
  capture: CaptureConfig;
}

export interface ToleranceConfig {
  defaultNumeric: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  padding: number;
  gap: number;
  borderRadius: number;
  borderWidth: number;
  opacity: number;
  positionOffset: number;
  colorDeltaE: number;
  pixelMatchThreshold: number;
  antialiasingTolerance: number;
}

export interface OutputConfig {
  dir: string;
  formats: OutputFormat[];
  screenshotScale: number;
}

export type OutputFormat = 'markdown' | 'html' | 'pdf' | 'csv';

export interface CaptureConfig {
  viewportWidth: number;
  viewportHeight: number;
  waitBeforeCapture: number;
  interactionStates: InteractionState[];
}

export type InteractionState = 'hover' | 'focus' | 'active' | 'disabled';

// ============================================================
// Figma 数据类型
// ============================================================

export interface FigmaDesignData {
  fileName: string;
  pageName: string;
  components: FigmaComponent[];
  screenshots: Record<string, string>; // nodeId -> image URL
  fullScreenshot?: string;
}

export interface FigmaComponent {
  id: string;
  name: string;
  path: string;
  type: string;
  bbox: BoundingBox;
  styles: NormalizedStyles;
  children?: string[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedStyles {
  // 尺寸
  width?: number;
  height?: number;
  // 颜色
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  // 字体
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  // 间距
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  // 圆角 & 边框
  borderRadius?: number;
  borderWidth?: number;
  // 阴影
  boxShadow?: string;
  // 布局
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  // 层级
  opacity?: number;
  zIndex?: number;
}

// ============================================================
// 页面采集类型
// ============================================================

export interface PageCaptureData {
  url: string;
  title: string;
  fullScreenshot: string;
  viewportScreenshot: string;
  elements: CapturedElement[];
}

export interface CapturedElement {
  selector: string;
  tagName: string;
  text?: string;
  bbox: BoundingBox;
  styles: NormalizedStyles;
  screenshot?: string;
}

// ============================================================
// 对比结果类型
// ============================================================

export interface DiffResult {
  pixelDiff: PixelDiffResult;
  propertyDiffs: ModuleDiff[];
  overallScore: number;
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  suggestionCount: number;
}

export interface PixelDiffResult {
  similarity: number;
  diffImagePath: string;
  mismatchedPixels: number;
  totalPixels: number;
  /** 重叠区域高度 (px) */
  overlapHeight?: number;
  /** 图1缩放后高度 (px) */
  image1ScaledHeight?: number;
  /** 图2缩放后高度 (px) */
  image2ScaledHeight?: number;
  /** 非重叠区域高度 (px) */
  extraHeight?: number;
  /** 哪张图更长: 'design' | 'live' | 'same' */
  whichLonger?: string;
}

export interface ModuleDiff {
  name: string;
  selector: string;
  figmaNodeId: string;
  figmaScreenshot?: string;
  pageScreenshot?: string;
  score: number;
  issues: Issue[];
}

export type IssueLevel = 'critical' | 'major' | 'minor' | 'suggestion';

export type IssueCategory =
  | 'size'
  | 'color'
  | 'font'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'layout'
  | 'state';

export interface Issue {
  id: string;
  level: IssueLevel;
  category: IssueCategory;
  property: string;
  expected: string;
  actual: string;
  deviation: string;
  suggestion: string;
}

// ============================================================
// 报告类型
// ============================================================

export interface DesignReviewReport {
  meta: ReportMeta;
  modules: ModuleDiff[];
  visualDiff: PixelDiffResult;
  outputFiles: string[];
}

export interface ReportMeta {
  pageUrl: string;
  figmaUrl: string;
  timestamp: string;
  overallScore: number;
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  suggestionCount: number;
}
