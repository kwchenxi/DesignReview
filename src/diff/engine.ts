// ============================================================
// 对比引擎 - 像素对比 + 属性对比
// ============================================================

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import * as fs from 'fs';
import * as path from 'path';

import {
  DiffResult,
  PixelDiffResult,
  ModuleDiff,
  Issue,
  IssueLevel,
  IssueCategory,
  FigmaDesignData,
  PageCaptureData,
  NormalizedStyles,
  ToleranceConfig,
} from '../types';
import { DEFAULT_TOLERANCE } from '../config';
import { IssueEnhancer } from './issue-enhancer';

// ============================================================
// 像素级对比
// ============================================================

export async function pixelDiff(
  image1Path: string,
  image2Path: string,
  outputPath: string,
  threshold = 0.1,
  antialiasingTolerance = 0.1
): Promise<PixelDiffResult> {
  const img1 = PNG.sync.read(fs.readFileSync(image1Path));
  const img2 = PNG.sync.read(fs.readFileSync(image2Path));

  // 统一尺寸: 等比缩放到相同的宽度 (取较小宽度), 保持比例
  // 只比较高度重叠区域, 避免因内容长度不同导致误报
  const targetWidth = Math.min(img1.width, img2.width);
  const scale1 = targetWidth / img1.width;
  const scale2 = targetWidth / img2.width;
  const height1 = Math.round(img1.height * scale1);
  const height2 = Math.round(img2.height * scale2);

  // 只比较重叠高度, 避免因页面长短不同产生白色填充误报
  const overlapHeight = Math.min(height1, height2);

  // 缩放图片到相同宽度 (只取重叠高度部分)
  const scaled1 = resizePng(img1, targetWidth, height1, overlapHeight);
  const scaled2 = resizePng(img2, targetWidth, height2, overlapHeight);

  const diff = new PNG({ width: targetWidth, height: overlapHeight });
  const mismatchedPixels = pixelmatch(
    scaled1.data,
    scaled2.data,
    diff.data,
    targetWidth,
    overlapHeight,
    { threshold, includeAA: true, alpha: 0.5 }
  );

  const totalPixels = targetWidth * overlapHeight;
  const similarity = ((1 - mismatchedPixels / totalPixels) * 100);

  fs.writeFileSync(outputPath, PNG.sync.write(diff));

  // 计算非重叠区域信息
  const maxOriginalHeight = Math.max(height1, height2);
  const extraHeight = maxOriginalHeight - overlapHeight;
  const whichLonger = height1 > height2 ? 'live' : height2 > height1 ? 'design' : 'same';

  return {
    similarity: Math.round(similarity * 100) / 100,
    diffImagePath: outputPath,
    mismatchedPixels,
    totalPixels,
    overlapHeight,
    image1ScaledHeight: height1,
    image2ScaledHeight: height2,
    extraHeight,
    whichLonger,
  };
}

// ---- 简单 PNG 缩放 (最近邻插值) ----

function resizePng(src: PNG, targetWidth: number, scaledHeight: number, cropHeight: number): PNG {
  // cropHeight <= scaledHeight, 只输出重叠部分, 不填充白色
  const result = new PNG({ width: targetWidth, height: cropHeight });

  const scaleX = src.width / targetWidth;
  const scaleY = src.height / scaledHeight;

  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIdx = (srcY * src.width + srcX) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      result.data[dstIdx] = src.data[srcIdx];
      result.data[dstIdx + 1] = src.data[srcIdx + 1];
      result.data[dstIdx + 2] = src.data[srcIdx + 2];
      result.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return result;
}

// ============================================================
// 颜色差异计算 (简化版 ΔE)
// ============================================================

interface RGB { r: number; g: number; b: number; }

function parseCSSColor(css: string): RGB | null {
  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbaMatch = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
    };
  }

  // hex
  const hexMatch = css.match(/#([0-9a-fA-F]{3,8})/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function rgbToLab(rgb: RGB): { l: number; a: number; b: number } {
  // sRGB -> linear RGB
  const linearize = (c: number) => {
    c = c / 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };

  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);

  // linear RGB -> XYZ
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t) + 16 / 116;

  x = f(x);
  y = f(y);
  z = f(z);

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

function calculateDeltaE(color1: string, color2: string): number {
  const c1 = parseCSSColor(color1);
  const c2 = parseCSSColor(color2);
  if (!c1 || !c2) return 0;

  const lab1 = rgbToLab(c1);
  const lab2 = rgbToLab(c2);

  // 简化的 ΔE (CIE76)
  return Math.sqrt(
    Math.pow(lab2.l - lab1.l, 2) +
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
}

// ============================================================
// 属性级对比
// ============================================================

const NUMERIC_PROPERTIES: Array<{ key: keyof NormalizedStyles; toleranceKey?: string; category: IssueCategory; label: string }> = [
  { key: 'width', category: 'size', label: '宽度' },
  { key: 'height', category: 'size', label: '高度' },
  { key: 'fontSize', category: 'font', label: '字号' },
  { key: 'fontWeight', category: 'font', label: '字重' },
  { key: 'lineHeight', category: 'font', label: '行高' },
  { key: 'letterSpacing', category: 'font', label: '字间距' },
  { key: 'paddingTop', category: 'spacing', label: '上内边距' },
  { key: 'paddingRight', category: 'spacing', label: '右内边距' },
  { key: 'paddingBottom', category: 'spacing', label: '下内边距' },
  { key: 'paddingLeft', category: 'spacing', label: '左内边距' },
  { key: 'gap', category: 'spacing', label: '间距' },
  { key: 'marginTop', category: 'spacing', label: '上外边距' },
  { key: 'marginRight', category: 'spacing', label: '右外边距' },
  { key: 'marginBottom', category: 'spacing', label: '下外边距' },
  { key: 'marginLeft', category: 'spacing', label: '左外边距' },
  { key: 'borderRadius', category: 'radius', label: '圆角' },
  { key: 'borderWidth', category: 'radius', label: '边框宽度' },
];

const COLOR_PROPERTIES: Array<{ key: keyof NormalizedStyles; category: IssueCategory; label: string }> = [
  { key: 'color', category: 'color', label: '文字颜色' },
  { key: 'backgroundColor', category: 'color', label: '背景颜色' },
  { key: 'borderColor', category: 'color', label: '边框颜色' },
];

const STRING_PROPERTIES: Array<{ key: keyof NormalizedStyles; category: IssueCategory; label: string }> = [
  { key: 'fontFamily', category: 'font', label: '字体' },
];

function getTolerance(prop: string, tolerance: ToleranceConfig): number {
  const key = prop as keyof ToleranceConfig;
  if (key in tolerance && typeof tolerance[key] === 'number') {
    return tolerance[key] as number;
  }
  return tolerance.defaultNumeric;
}

function classifyNumericDiff(delta: number, threshold: number): IssueLevel {
  if (delta > threshold * 4) return 'critical';
  if (delta > threshold * 2) return 'major';
  return 'minor';
}

function compareProperties(
  figmaStyles: NormalizedStyles,
  pageStyles: NormalizedStyles,
  tolerance: ToleranceConfig,
  componentName: string
): Issue[] {
  const issues: Issue[] = [];
  let issueId = 0;

  // 数值属性对比
  for (const prop of NUMERIC_PROPERTIES) {
    const expected = figmaStyles[prop.key] as number | undefined;
    const actual = pageStyles[prop.key] as number | undefined;

    if (expected === undefined || actual === undefined) continue;

    const threshold = getTolerance(prop.key, tolerance);
    const delta = Math.abs(expected - actual);

    if (delta > threshold) {
      const level = classifyNumericDiff(delta, threshold);
      const pct = expected !== 0 ? ((delta / expected) * 100).toFixed(1) : '∞';

      issues.push({
        id: `${componentName}-${prop.key}-${issueId++}`,
        level,
        category: prop.category,
        property: prop.label,
        expected: `${Math.round(expected * 100) / 100}px`,
        actual: `${Math.round(actual * 100) / 100}px`,
        deviation: `${Math.round(delta * 100) / 100}px (${pct}%)`,
        suggestion: `将 ${prop.label} 从 ${Math.round(actual * 100) / 100}px 调整为 ${Math.round(expected * 100) / 100}px`,
      });
    }
  }

  // 颜色属性对比
  for (const prop of COLOR_PROPERTIES) {
    const expected = figmaStyles[prop.key] as string | undefined;
    const actual = pageStyles[prop.key] as string | undefined;

    if (!expected || !actual) continue;

    // 跳过透明色
    if (expected.includes('rgba(0, 0, 0, 0)') || actual.includes('rgba(0, 0, 0, 0)')) continue;

    const deltaE = calculateDeltaE(expected, actual);

    if (deltaE > tolerance.colorDeltaE) {
      const level: IssueLevel = deltaE > 10 ? 'critical' : deltaE > 5 ? 'major' : 'minor';

      issues.push({
        id: `${componentName}-${prop.key}-${issueId++}`,
        level,
        category: prop.category,
        property: prop.label,
        expected,
        actual,
        deviation: `ΔE=${deltaE.toFixed(2)}`,
        suggestion: `将 ${prop.label} 从 ${actual} 调整为 ${expected}`,
      });
    }
  }

  // 字符串属性对比
  for (const prop of STRING_PROPERTIES) {
    const expected = figmaStyles[prop.key] as string | undefined;
    const actual = pageStyles[prop.key] as string | undefined;

    if (!expected || !actual) continue;

    if (expected !== actual) {
      issues.push({
        id: `${componentName}-${prop.key}-${issueId++}`,
        level: 'major',
        category: prop.category,
        property: prop.label,
        expected,
        actual,
        deviation: '不匹配',
        suggestion: `将 ${prop.label} 从 "${actual}" 调整为 "${expected}"`,
      });
    }
  }

  // 阴影对比
  if (figmaStyles.boxShadow && pageStyles.boxShadow) {
    // 阴影的精确对比比较复杂, 这里做简化处理: 检查是否有阴影差异
    const figShadow = figmaStyles.boxShadow.replace(/\s+/g, ' ').trim();
    const pageShadow = pageStyles.boxShadow.replace(/\s+/g, ' ').trim();
    if (figShadow !== pageShadow) {
      issues.push({
        id: `${componentName}-boxShadow-${issueId++}`,
        level: 'minor',
        category: 'shadow',
        property: '阴影',
        expected: figmaStyles.boxShadow,
        actual: pageStyles.boxShadow,
        deviation: '不一致',
        suggestion: '检查阴影参数是否与设计稿一致',
      });
    }
  } else if (figmaStyles.boxShadow && !pageStyles.boxShadow) {
    issues.push({
      id: `${componentName}-boxShadow-${issueId++}`,
      level: 'major',
      category: 'shadow',
      property: '阴影',
      expected: figmaStyles.boxShadow,
      actual: '无阴影',
      deviation: '缺失阴影',
      suggestion: '添加阴影样式',
    });
  }

  return issues;
}

// ============================================================
// 自动匹配: Figma 组件 <-> 页面元素
// ============================================================

interface MatchPair {
  figmaIndex: number;
  pageIndex: number;
  score: number;
}

function matchComponents(
  figmaComponents: FigmaDesignData['components'],
  pageElements: PageCaptureData['elements']
): MatchPair[] {
  const matches: MatchPair[] = [];
  const usedPageIndices = new Set<number>();

  for (let fi = 0; fi < figmaComponents.length; fi++) {
    const figma = figmaComponents[fi];
    let bestMatch: MatchPair | null = null;

    for (let pi = 0; pi < pageElements.length; pi++) {
      if (usedPageIndices.has(pi)) continue;
      const page = pageElements[pi];

      // 综合匹配分数: 位置+尺寸+文字
      let score = 0;

      // 尺寸相似度
      const wDiff = Math.abs((figma.styles.width || 0) - (page.styles.width || 0));
      const hDiff = Math.abs((figma.styles.height || 0) - (page.styles.height || 0));
      if (wDiff < 5 && hDiff < 5) score += 40;
      else if (wDiff < 20 && hDiff < 20) score += 20;

      // 文字匹配
      if (figma.type === 'TEXT' && page.text) {
        const figmaText = figma.name.toLowerCase();
        const pageText = page.text.toLowerCase();
        if (figmaText === pageText) score += 30;
        else if (figmaText.includes(pageText) || pageText.includes(figmaText)) score += 15;
      }

      // 颜色匹配
      if (figma.styles.backgroundColor && page.styles.backgroundColor) {
        const deltaE = calculateDeltaE(figma.styles.backgroundColor, page.styles.backgroundColor);
        if (deltaE < 3) score += 20;
      }

      if (score > 30 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { figmaIndex: fi, pageIndex: pi, score };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      usedPageIndices.add(bestMatch.pageIndex);
    }
  }

  return matches;
}

// ============================================================
// 差异区域分析: 将差异图按垂直区域切分, 找出问题区域
// ============================================================

function analyzeDiffRegions(
  diffImagePath: string,
  pixelResult: PixelDiffResult
): Issue[] {
  const issues: Issue[] = [];
  const diffImg = PNG.sync.read(fs.readFileSync(diffImagePath));
  const width = diffImg.width;
  const height = diffImg.height;

  // 将页面垂直切分为若干区域
  const REGION_HEIGHT = 300;
  const regionCount = Math.ceil(height / REGION_HEIGHT);

  for (let i = 0; i < regionCount; i++) {
    const startY = i * REGION_HEIGHT;
    const endY = Math.min((i + 1) * REGION_HEIGHT, height);
    let diffPixels = 0;
    let totalRegionPixels = 0;

    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        totalRegionPixels++;
        // diff 图片中红色通道表示差异
        if (diffImg.data[idx] > 100 && diffImg.data[idx + 3] > 0) {
          diffPixels++;
        }
      }
    }

    const diffRate = diffPixels / totalRegionPixels;
    if (diffRate > 0.02) { // 超过 2% 差异才报告
      const level: IssueLevel = diffRate > 0.2 ? 'critical' : diffRate > 0.1 ? 'major' : 'minor';
      const regionLabel = startY === 0 ? '页面顶部' :
        endY >= height ? '页面底部' : `页面中部 (约 ${startY}px - ${endY}px)`;

      issues.push({
        id: `pixel-region-${i}`,
        level,
        category: 'layout',
        property: `${regionLabel}区域差异`,
        expected: '与设计稿一致',
        actual: `差异率 ${(diffRate * 100).toFixed(1)}%`,
        deviation: `${diffPixels} 个差异像素 / ${totalRegionPixels} 总像素`,
        suggestion: `重点检查 ${regionLabel}区域的视觉还原情况，可能存在颜色、间距或布局偏差`,
      });
    }
  }

  return issues;
}

// ============================================================
// 对比引擎主类
// ============================================================

export class DiffEngine {
  static async compare(
    figmaData: FigmaDesignData,
    pageData: PageCaptureData,
    tolerance: ToleranceConfig = DEFAULT_TOLERANCE,
    outputDir = './output'
  ): Promise<DiffResult> {
    console.log('🔄 正在执行设计对比...');
    const enhancer = new IssueEnhancer();

    // 1. 像素级对比
    let pixelResult: PixelDiffResult | null = null;
    const figmaScreenshots = Object.values(figmaData.screenshots);

    if (figmaScreenshots.length > 0 && fs.existsSync(pageData.fullScreenshot)) {
      try {
        // 下载 Figma 截图到本地
        const figmaScreenshotPath = path.join(outputDir, 'figma-screenshot.png');
        // 如果 screenshots 是 URL, 需要下载; 如果已是本地路径, 直接使用
        const screenshotSrc = figmaScreenshots[0];
        if (screenshotSrc.startsWith('http')) {
          const response = await fetch(screenshotSrc);
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(figmaScreenshotPath, buffer);
        } else if (fs.existsSync(screenshotSrc)) {
          fs.copyFileSync(screenshotSrc, figmaScreenshotPath);
        }

        if (fs.existsSync(figmaScreenshotPath)) {
          const diffImagePath = path.join(outputDir, 'visual-diff.png');
          pixelResult = await pixelDiff(
            figmaScreenshotPath,
            pageData.fullScreenshot,
            diffImagePath,
            tolerance.pixelMatchThreshold,
            tolerance.antialiasingTolerance
          );
          console.log(`📊 像素相似度: ${pixelResult.similarity}%`);
        }
      } catch (err) {
        console.warn('⚠️ 像素对比失败:', err);
      }
    }

    // 2. 像素差异 → 问题条目
    const moduleDiffs: ModuleDiff[] = [];

    if (pixelResult && pixelResult.similarity < 99.5) {
      const pixelIssues: Issue[] = [];
      const diffPct = (100 - pixelResult.similarity).toFixed(2);

      // 使用技能标准生成整体视觉差异问题
      const visualDiffIssue = enhancer.createVisualDiffIssue(pixelResult.similarity, '整体页面', '整体视觉');
      pixelIssues.push(visualDiffIssue);

      // 非重叠区域: 页面内容长度不同
      if (pixelResult.extraHeight && pixelResult.extraHeight > 10) {
        const longerLabel = pixelResult.whichLonger === 'live' ? '线上页面' : '设计稿';
        const shorterLabel = pixelResult.whichLonger === 'live' ? '设计稿' : '线上页面';
        const extraPx = Math.round(pixelResult.extraHeight);
        const heightIssue = {
          id: 'pixel-height-diff',
          level: 'minor' as IssueLevel,
          category: 'layout' as IssueCategory,
          property: '内容长度差异',
          expected: `设计稿 ${pixelResult.image1ScaledHeight}px`,
          actual: `线上页面 ${pixelResult.image2ScaledHeight}px`,
          deviation: `${longerLabel}多出约 ${extraPx}px 内容（${shorterLabel}未覆盖）`,
          suggestion: `仅对比了顶部重叠区域（${pixelResult.overlapHeight}px），${longerLabel}下方额外内容未纳入对比`,
        };
        pixelIssues.push(enhancer.enhanceIssue(heightIssue, '整体页面', '页面长度'));
      }

      // 分析差异区域, 按垂直位置切分为多个区域生成问题
      if (pixelResult.similarity < 95 && fs.existsSync(pixelResult.diffImagePath)) {
        try {
          const regionIssues = analyzeDiffRegions(pixelResult.diffImagePath, pixelResult);
          // 增强区域问题
          const enhancedRegionIssues = enhancer.enhanceIssues(regionIssues, '整体页面', '特定区域');
          pixelIssues.push(...enhancedRegionIssues);
        } catch (err) {
          console.warn('⚠️ 差异区域分析失败:', err);
        }
      }

      const pixelScore = Math.round(pixelResult.similarity);
      moduleDiffs.push({
        name: '整体视觉对比',
        selector: 'body',
        figmaNodeId: 'root',
        figmaScreenshot: figmaData.fullScreenshot,
        pageScreenshot: pageData.fullScreenshot,
        score: pixelScore,
        issues: pixelIssues,
      });
    }

    // 3. 属性级对比 (有组件数据时)
    if (figmaData.components.length > 0 && pageData.elements.length > 0) {
      const matches = matchComponents(figmaData.components, pageData.elements);
      console.log(`🔗 匹配到 ${matches.length} 对组件`);

      for (const match of matches) {
        const figma = figmaData.components[match.figmaIndex];
        const page = pageData.elements[match.pageIndex];

        const issues = compareProperties(
          figma.styles,
          page.styles,
          tolerance,
          figma.name
        );

        if (issues.length > 0) {
          // 增强问题，添加技能标准的详细信息
          const enhancedIssues = enhancer.enhanceIssues(issues, figma.name, page.selector);

          const score = Math.max(0, 100 - enhancedIssues.reduce((deduct, issue) => {
            switch (issue.level) {
              case 'critical': return deduct + 20;
              case 'major': return deduct + 10;
              case 'minor': return deduct + 3;
              case 'suggestion': return deduct + 1;
            }
          }, 0));

          moduleDiffs.push({
            name: figma.name,
            selector: page.selector,
            figmaNodeId: figma.id,
            figmaScreenshot: figmaData.screenshots[figma.id],
            pageScreenshot: page.screenshot,
            score,
            issues: enhancedIssues,
          });
        }
      }
    } else {
      console.log('ℹ️ 无组件属性数据, 跳过属性级对比 (仅像素对比模式)');
    }

    // 按问题严重程度排序
    moduleDiffs.sort((a, b) => a.score - b.score);

    // 4. 统计
    let criticalCount = 0, majorCount = 0, minorCount = 0, suggestionCount = 0;
    for (const mod of moduleDiffs) {
      for (const issue of mod.issues) {
        switch (issue.level) {
          case 'critical': criticalCount++; break;
          case 'major': majorCount++; break;
          case 'minor': minorCount++; break;
          case 'suggestion': suggestionCount++; break;
        }
      }
    }

    const totalIssues = criticalCount + majorCount + minorCount + suggestionCount;

    // 评分: 优先使用像素相似度, 否则根据问题扣分
    let overallScore: number;
    if (pixelResult && pixelResult.similarity > 0) {
      // 像素相似度作为基础分, 属性问题额外扣分
      const propertyDeduction = criticalCount * 5 + majorCount * 3 + minorCount * 1;
      overallScore = Math.max(0, Math.round(pixelResult.similarity) - propertyDeduction);
    } else {
      overallScore = Math.max(0, 100 - criticalCount * 15 - majorCount * 8 - minorCount * 3 - suggestionCount * 1);
    }

    console.log(`\n📋 对比结果: 总体还原度 ${overallScore}分, 发现 ${totalIssues} 个问题`);
    console.log(`   🔴 严重: ${criticalCount}  🟠 主要: ${majorCount}  🟡 次要: ${minorCount}  🟢 建议: ${suggestionCount}`);

    return {
      pixelDiff: pixelResult || {
        similarity: 0,
        diffImagePath: '',
        mismatchedPixels: 0,
        totalPixels: 0,
      },
      propertyDiffs: moduleDiffs,
      overallScore,
      totalIssues,
      criticalCount,
      majorCount,
      minorCount,
      suggestionCount,
    };
  }
}
