// ============================================================
// Design Review Public - 类型定义
// ============================================================

/** 输入来源: URL 或本地截图路径 */
export interface InputSource {
  pageUrl?: string;
  pageScreenshot?: string;
  figmaUrl?: string;
  figmaScreenshot?: string;
  figmaToken?: string;
  targetWidth?: number;
  options?: Partial<ReviewOptions>;
}

export interface ReviewOptions {
  tolerance: ToleranceConfig;
  output: OutputConfig;
  capture: CaptureConfig;
  ai?: boolean;
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
  screenshots: Record<string, string>;
  fullScreenshot?: string;
  designWidth?: number;
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
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
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
  overlapHeight?: number;
  image1ScaledHeight?: number;
  image2ScaledHeight?: number;
  extraHeight?: number;
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
  title?: string;
  location?: string;
  observed?: string;
  impact?: string;
  recommendation?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  componentName?: string;
  confidence?: number;
  specReference?: string;
}

// ============================================================
// 设计规范数据源类型
// ============================================================

export interface DesignSpecSource {
  registry: string;
  packageName: string;
  version?: string;
}

export interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'font' | 'radius' | 'shadow' | 'other';
  source?: string;
}

export interface ComponentSpec {
  name: string;
  path: string;
  styles: string;
  tokens: DesignToken[];
}

export interface DesignSpecData {
  source: DesignSpecSource;
  tokens: DesignToken[];
  components: ComponentSpec[];
  rawStyleText: string;
  fetchedAt: string;
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
  pageScreenshot?: string;
  figmaScreenshot?: string;
}
