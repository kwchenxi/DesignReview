// ============================================================
// Figma 设计稿提取器
// ============================================================

import {
  FigmaDesignData,
  FigmaComponent,
  NormalizedStyles,
  BoundingBox,
} from '../types';
import { FigmaRenderer } from './renderer';

// ---- Figma API 响应类型 (简化版) ----

interface FigmaFileResponse {
  name: string;
  document: FigmaNode;
}

interface FigmaImageResponse {
  images: Record<string, string>;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  absoluteRenderBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  opacity?: number;
  effects?: FigmaEffect[];
  style?: FigmaTypeStyle;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  constraints?: { horizontal: string; vertical: string };
  componentPropertyDefinitions?: Record<string, any>;
}

interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
}

interface FigmaEffect {
  type: string;
  visible: boolean;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

interface FigmaTypeStyle {
  fontPostScriptName?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  letterSpacing?: number;
}

// ---- Figma URL 解析 ----

interface FigmaUrlInfo {
  fileKey: string;
  nodeId?: string;
  pageName?: string;
}

export function parseFigmaUrl(url: string): FigmaUrlInfo {
  // 支持格式:
  // https://www.figma.com/file/ABC123/Project-Name?node-id=1-2
  // https://www.figma.com/design/ABC123/Project-Name?node-id=1-2
  const patterns = [
    /figma\.com\/file\/([a-zA-Z0-9]+)/,
    /figma\.com\/design\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];

  let fileKey = '';
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      fileKey = match[1];
      break;
    }
  }

  if (!fileKey) {
    throw new Error(`无法解析 Figma URL: ${url}`);
  }

  // 解析 node-id
  const nodeIdMatch = url.match(/node-id=([0-9-]+)/);
  const nodeId = nodeIdMatch ? nodeIdMatch[1].replace('-', ':') : undefined;

  return { fileKey, nodeId };
}

// ---- Figma API 调用 ----

async function figmaApi<T>(
  endpoint: string,
  token: string
): Promise<T> {
  const baseUrl = 'https://api.figma.com/v1';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Figma API 错误 (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

// ---- 节点查找 ----

function findNodeById(root: FigmaNode, nodeId: string): FigmaNode | null {
  if (root.id === nodeId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

// ---- 颜色转换 ----

function figmaColorToCSS(color: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// ---- 提取节点填充色 ----

function extractFillColor(fills?: FigmaPaint[]): string | undefined {
  if (!fills || fills.length === 0) return undefined;
  const solidFill = fills.find(f => f.type === 'SOLID' && f.color);
  if (!solidFill || !solidFill.color) return undefined;
  const alpha = solidFill.opacity ?? solidFill.color.a;
  return figmaColorToCSS({ ...solidFill.color, a: alpha });
}

// ---- 提取阴影 ----

function extractShadow(effects?: FigmaEffect[]): string | undefined {
  if (!effects || effects.length === 0) return undefined;
  const shadows = effects
    .filter(e => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'))
    .map(e => {
      const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
      const color = e.color ? figmaColorToCSS(e.color) : 'rgba(0,0,0,0.25)';
      const x = e.offset?.x ?? 0;
      const y = e.offset?.y ?? 0;
      const blur = e.radius ?? 0;
      const spread = e.spread ?? 0;
      return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
    });
  return shadows.length > 0 ? shadows.join(', ') : undefined;
}

// ---- 样式标准化 ----

function normalizeStyles(node: FigmaNode): NormalizedStyles {
  const styles: NormalizedStyles = {};
  const bbox = node.absoluteBoundingBox || node.absoluteRenderBounds;

  if (bbox) {
    styles.width = bbox.width;
    styles.height = bbox.height;
  }

  // 颜色
  if (node.fills) {
    styles.backgroundColor = extractFillColor(node.fills);
  }
  if (node.strokes) {
    styles.borderColor = extractFillColor(node.strokes);
  }

  // 字体
  if (node.style) {
    styles.fontFamily = node.style.fontFamily;
    styles.fontSize = node.style.fontSize;
    styles.fontWeight = node.style.fontWeight;
    styles.lineHeight = node.style.lineHeightPx;
    styles.letterSpacing = node.style.letterSpacing;
  }

  // 文字颜色: 对于 TEXT 节点, fills 就是文字颜色
  if (node.type === 'TEXT' && node.fills) {
    styles.color = extractFillColor(node.fills);
  }

  // 间距
  if (node.paddingTop !== undefined) styles.paddingTop = node.paddingTop;
  if (node.paddingRight !== undefined) styles.paddingRight = node.paddingRight;
  if (node.paddingBottom !== undefined) styles.paddingBottom = node.paddingBottom;
  if (node.paddingLeft !== undefined) styles.paddingLeft = node.paddingLeft;
  if (node.itemSpacing !== undefined) styles.gap = node.itemSpacing;

  // 圆角
  if (node.cornerRadius !== undefined) {
    styles.borderRadius = node.cornerRadius;
  } else if (node.rectangleCornerRadii) {
    // 如果四个角不同, 取平均值
    const avg = node.rectangleCornerRadii.reduce((a, b) => a + b, 0) / 4;
    styles.borderRadius = avg;
  }

  // 边框
  if (node.strokeWeight !== undefined) {
    styles.borderWidth = node.strokeWeight;
  }

  // 阴影
  const shadow = extractShadow(node.effects);
  if (shadow) styles.boxShadow = shadow;

  // 透明度
  if (node.opacity !== undefined) styles.opacity = node.opacity;

  // 布局
  if (node.layoutMode) {
    styles.display = 'flex';
    styles.flexDirection = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    if (node.primaryAxisAlignItems) {
      const map: Record<string, string> = {
        MIN: 'flex-start',
        CENTER: 'center',
        MAX: 'flex-end',
        SPACE_BETWEEN: 'space-between',
      };
      styles.justifyContent = map[node.primaryAxisAlignItems];
    }
    if (node.counterAxisAlignItems) {
      const map: Record<string, string> = {
        MIN: 'flex-start',
        CENTER: 'center',
        MAX: 'flex-end',
      };
      styles.alignItems = map[node.counterAxisAlignItems];
    }
  }

  return styles;
}

// ---- 判断是否为视觉节点 ----

const VISUAL_NODE_TYPES = new Set([
  'FRAME',
  'COMPONENT',
  'INSTANCE',
  'RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'VECTOR',
  'GROUP',
  'SECTION',
]);

function isVisualNode(node: FigmaNode): boolean {
  return VISUAL_NODE_TYPES.has(node.type);
}

// ---- 递归遍历提取 ----

function traverseAndExtract(node: FigmaNode, path = ''): FigmaComponent[] {
  const results: FigmaComponent[] = [];

  if (isVisualNode(node)) {
    const bbox: BoundingBox = node.absoluteBoundingBox
      ? {
          x: node.absoluteBoundingBox.x,
          y: node.absoluteBoundingBox.y,
          width: node.absoluteBoundingBox.width,
          height: node.absoluteBoundingBox.height,
        }
      : { x: 0, y: 0, width: 0, height: 0 };

    results.push({
      id: node.id,
      name: node.name,
      path: path ? `${path} > ${node.name}` : node.name,
      type: node.type,
      bbox,
      styles: normalizeStyles(node),
      children: node.children?.map(c => c.id),
    });
  }

  if (node.children) {
    for (const child of node.children) {
      results.push(...traverseAndExtract(child, path ? `${path} > ${node.name}` : node.name));
    }
  }

  return results;
}

// ============================================================
// 主导出: Figma 提取器
// ============================================================

export class FigmaExtractor {
  /**
   * 从 Figma URL 提取设计数据
   * @param targetWidth 目标渲染宽度 (CSS 像素)。设置后，Figma 截图会按此宽度对应的 scale 导出
   * @param outputDir 未使用（保留参数兼容性）
   */
  static async extract(
    figmaUrl: string,
    token?: string,
    targetWidth?: number,
    _outputDir?: string
  ): Promise<FigmaDesignData> {
    const accessToken = token || process.env.FIGMA_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('请设置 FIGMA_ACCESS_TOKEN 环境变量或传入 figmaToken 参数');
    }

    const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);
    console.log(`📐 正在获取 Figma 文件: ${fileKey}${nodeId ? ` (节点: ${nodeId})` : ''}`);

    // 1. 获取文件名 (用极浅深度, 只拿文件元信息)
    let fileName = 'Figma Design';
    try {
      const fileInfo = await figmaApi<{ name: string }>(
        `/files/${fileKey}?depth=1`,
        accessToken
      );
      fileName = fileInfo.name;
    } catch {
      console.warn('⚠️ 获取文件名失败, 使用默认名称');
    }
    console.log(`📄 文件名: ${fileName}`);

    // 2. 获取目标节点数据
    let targetNode: FigmaNode;
    if (nodeId) {
      const nodesResp = await figmaApi<{ nodes: { [key: string]: { document: FigmaNode } } }>(
        `/files/${fileKey}/nodes?ids=${nodeId}&depth=3`,
        accessToken
      );
      const nodeData = nodesResp.nodes[nodeId];
      if (!nodeData?.document) {
        throw new Error(`找不到节点: ${nodeId}`);
      }
      targetNode = nodeData.document;
    } else {
      const file = await figmaApi<FigmaFileResponse>(
        `/files/${fileKey}?depth=2`,
        accessToken
      );
      fileName = file.name;
      targetNode = file.document;
    }

    if (!targetNode) {
      throw new Error(`找不到节点: ${nodeId}`);
    }

    // 3. 提取组件
    const components = traverseAndExtract(targetNode);
    console.log(`✅ 提取到 ${components.length} 个视觉节点`);

    // 4. 导出截图 — 根据 targetWidth 计算 scale
    // 注意：Figma API 只支持 scale 参数（等比缩放），不支持按宽度重排 Auto Layout
    // 详见 src/figma/renderer.ts 中的说明
    const topNodes = nodeId ? [nodeId] : (targetNode.children || []).slice(0, 20).map(c => c.id);
    console.log(`📸 正在导出 ${topNodes.length} 张截图...`);

    let exportScale = 2; // 默认 2x
    const designWidth = targetNode.absoluteBoundingBox?.width;
    if (targetWidth && designWidth && designWidth > 0) {
      exportScale = targetWidth / designWidth;
      console.log(`📏 设计稿原始宽度: ${designWidth}px, 目标宽度: ${targetWidth}px, 导出 scale: ${exportScale.toFixed(2)}x`);
    } else if (targetWidth) {
      exportScale = 1;
      console.log(`📏 未获取到设计稿宽度，使用 scale=1 导出`);
    }

    let screenshots: Record<string, string> = {};
    try {
      const imageResp = await figmaApi<FigmaImageResponse>(
        `/images/${fileKey}?ids=${topNodes.join(',')}&format=png&scale=${exportScale}`,
        accessToken
      );
      screenshots = imageResp.images;
    } catch (err) {
      console.warn('⚠️ 截图导出失败:', err);
    }

    // 降级: 如果 Figma 截图导出失败，尝试本地渲染
    if (Object.keys(screenshots).length === 0 && _outputDir && targetWidth) {
      console.log('🎨 尝试本地渲染降级方案...');
      const renderedPath = await FigmaRenderer.tryRender({ fileName, pageName: targetNode.name, components, screenshots, designWidth }, {
        width: targetWidth,
        outputDir: _outputDir,
      });
      if (renderedPath) {
        screenshots = { 'root': renderedPath };
      }
    }

    return {
      fileName: fileName,
      pageName: targetNode.name,
      components,
      screenshots,
      designWidth,
    };
  }
}
