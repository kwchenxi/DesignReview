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
  /** 目标渲染宽度 (CSS 像素)。设置后，Figma 截图会按此宽度导出，使 Auto Layout 按此宽度渲染 */
  targetWidth?: number;
  options?: Partial<ReviewOptions>;
}

/** @deprecated 使用 InputSource 代替 */
export type ReviewInput = InputSource;

export interface ReviewOptions {
  tolerance: ToleranceConfig;
  output: OutputConfig;
  capture: CaptureConfig;
  /** 启用 AI 视觉分析 (默认根据环境变量自动判断) */
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
  screenshots: Record<string, string>; // nodeId -> image URL
  fullScreenshot?: string;
  /** 设计稿原始宽度 (CSS 像素), 从 Figma 节点 absoluteBoundingBox 获取 */
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
  
  // 增强字段 (基于 design-implementation-review-main skill)
  title?: string;           // 问题标题，如"导航栏布局错位"
  location?: string;        // 问题位置，如"页面头部导航栏"
  observed?: string;        // 观察到的实现细节（比actual更详细）
  impact?: string;         // 问题影响分析
  recommendation?: string;  // 修复建议（与suggestion类似，但更具体）
  
  // 元数据
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; // 优先级级别
  componentName?: string;   // 组件名称
  confidence?: number;      // 检测置信度 (0-100)
  /** 设计规范引用 (如 "yzj-ui: @dumi-primary = #4d90fe") */
  specReference?: string;
}

// ============================================================
// 设计规范数据源类型
// ============================================================

export interface DesignSpecSource {
  /** npm registry 地址 */
  registry: string;
  /** 包名 */
  packageName: string;
  /** 版本 (默认 latest) */
  version?: string;
}

export interface DesignToken {
  /** token 名称 */
  name: string;
  /** 值 */
  value: string;
  /** 类别: color / spacing / font / radius / shadow */
  category: 'color' | 'spacing' | 'font' | 'radius' | 'shadow' | 'other';
  /** 原始来源文件 */
  source?: string;
}

export interface ComponentSpec {
  /** 组件名 */
  name: string;
  /** 组件文件路径 */
  path: string;
  /** 提取的样式规则 */
  styles: string;
  /** 提取的设计 token */
  tokens: DesignToken[];
}

export interface DesignSpecData {
  /** 数据源信息 */
  source: DesignSpecSource;
  /** 提取的设计 token */
  tokens: DesignToken[];
  /** 提取的组件规范 */
  components: ComponentSpec[];
  /** 原始样式文本 (用于 AI prompt) */
  rawStyleText: string;
  /** 获取时间 */
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
  /** 页面截图文件路径 */
  pageScreenshot?: string;
  /** 设计稿截图文件路径 */
  figmaScreenshot?: string;
}
