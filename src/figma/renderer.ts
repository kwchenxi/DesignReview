// ============================================================
// Figma 本地渲染器 - 将提取的 Figma 组件样式渲染为 HTML 并截图
// ============================================================
// 用途:
//   1. Figma 截图导出失败时的降级方案
//   2. 按指定宽度渲染，弥补 Figma API 无法触发 Auto Layout 重排的限制
//   3. 逐组件渲染，用于模块级对比
//
// 限制:
//   - 基于 CSS 的近似渲染，无法 100% 还原 Figma 效果
//   - 复杂矢量、混合模式等不完全支持
//   - 主要用于尺寸/间距/颜色/字体的快速视觉校验
// ============================================================

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { FigmaDesignData, FigmaComponent, NormalizedStyles } from '../types';

interface RenderOptions {
  /** 渲染宽度 (CSS 像素) */
  width: number;
  /** 输出目录 */
  outputDir: string;
  /** 设备像素比 */
  deviceScaleFactor?: number;
}

/**
 * 将单个组件的 NormalizedStyles 转为 CSS 声明
 */
function stylesToCSS(styles: NormalizedStyles): string {
  const decls: string[] = [];

  if (styles.width) decls.push(`width: ${styles.width}px`);
  if (styles.height) decls.push(`height: ${styles.height}px`);

  if (styles.color) decls.push(`color: ${styles.color}`);
  if (styles.backgroundColor) decls.push(`background-color: ${styles.backgroundColor}`);
  if (styles.borderColor) decls.push(`border-color: ${styles.borderColor}`);

  if (styles.fontFamily) decls.push(`font-family: ${styles.fontFamily}`);
  if (styles.fontSize) decls.push(`font-size: ${styles.fontSize}px`);
  if (styles.fontWeight) decls.push(`font-weight: ${styles.fontWeight}`);
  if (styles.lineHeight) decls.push(`line-height: ${styles.lineHeight}px`);
  if (styles.letterSpacing) decls.push(`letter-spacing: ${styles.letterSpacing}px`);

  if (styles.paddingTop != null) decls.push(`padding-top: ${styles.paddingTop}px`);
  if (styles.paddingRight != null) decls.push(`padding-right: ${styles.paddingRight}px`);
  if (styles.paddingBottom != null) decls.push(`padding-bottom: ${styles.paddingBottom}px`);
  if (styles.paddingLeft != null) decls.push(`padding-left: ${styles.paddingLeft}px`);
  if (styles.gap) decls.push(`gap: ${styles.gap}px`);

  if (styles.marginTop != null) decls.push(`margin-top: ${styles.marginTop}px`);
  if (styles.marginRight != null) decls.push(`margin-right: ${styles.marginRight}px`);
  if (styles.marginBottom != null) decls.push(`margin-bottom: ${styles.marginBottom}px`);
  if (styles.marginLeft != null) decls.push(`margin-left: ${styles.marginLeft}px`);

  if (styles.borderRadius) decls.push(`border-radius: ${styles.borderRadius}px`);
  if (styles.borderWidth) decls.push(`border-width: ${styles.borderWidth}px; border-style: solid`);
  if (styles.boxShadow) decls.push(`box-shadow: ${styles.boxShadow}`);
  if (styles.opacity != null) decls.push(`opacity: ${styles.opacity}`);

  if (styles.display) decls.push(`display: ${styles.display}`);
  if (styles.flexDirection) decls.push(`flex-direction: ${styles.flexDirection}`);
  if (styles.justifyContent) decls.push(`justify-content: ${styles.justifyContent}`);
  if (styles.alignItems) decls.push(`align-items: ${styles.alignItems}`);

  // position 基于 bbox
  decls.push(`position: relative`);

  return decls.join('; ');
}

/**
 * 从组件数据构建 HTML 树
 */
function buildComponentHTML(
  component: FigmaComponent,
  allComponents: FigmaComponent[]
): string {
  const css = stylesToCSS(component.styles);
  const isText = component.type === 'TEXT';
  const hasChildren = component.children && component.children.length > 0;

  let innerContent = '';
  if (hasChildren) {
    innerContent = component.children!
      .map(childId => {
        const child = allComponents.find(c => c.id === childId);
        if (!child) return '';
        return buildComponentHTML(child, allComponents);
      })
      .join('\n');
  } else if (isText) {
    innerContent = component.name;
  }

  const tag = isText ? 'span' : 'div';
  return `<${tag} style="${css}">${innerContent}</${tag}>`;
}

/**
 * 从 FigmaDesignData 生成完整 HTML 页面
 */
function generateRenderHTML(data: FigmaDesignData, renderWidth: number): string {
  // 找到顶层组件 (没有 parent 引用的)
  const childIds = new Set(data.components.flatMap(c => c.children || []));
  const topComponents = data.components.filter(c => !childIds.has(c.id));

  const bodyContent = topComponents
    .map(comp => buildComponentHTML(comp, data.components))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${renderWidth}px;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

export class FigmaRenderer {
  /**
   * 将 Figma 组件数据渲染为截图
   * @returns 截图文件路径
   */
  static async render(
    data: FigmaDesignData,
    options: RenderOptions
  ): Promise<string> {
    const { width, outputDir, deviceScaleFactor = 2 } = options;
    fs.mkdirSync(outputDir, { recursive: true });

    if (data.components.length === 0) {
      throw new Error('没有可渲染的组件数据');
    }

    const html = generateRenderHTML(data, width);
    const htmlPath = path.join(outputDir, 'figma-render.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    console.log(`🎨 正在本地渲染 Figma 组件 (${data.components.length} 个, 宽度: ${width}px)...`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 800, deviceScaleFactor });
      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 500));

      const screenshotPath = path.join(outputDir, 'figma-rendered.png');
      await page.screenshot({ path: screenshotPath, fullPage: true, type: 'png' });

      console.log(`✅ 本地渲染完成: ${screenshotPath}`);
      return screenshotPath;
    } finally {
      await browser.close();
    }
  }

  /**
   * 尝试本地渲染，失败时返回 null
   */
  static async tryRender(
    data: FigmaDesignData,
    options: RenderOptions
  ): Promise<string | null> {
    try {
      return await FigmaRenderer.render(data, options);
    } catch (err) {
      console.warn('⚠️ 本地渲染失败:', (err as Error).message);
      return null;
    }
  }
}
