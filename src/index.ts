// ============================================================
// Design Review MVP - 主入口
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

import { FigmaExtractor } from './figma/extractor';
import { PageCapture } from './capture/browser';
import { DiffEngine } from './diff/engine';
import { ReportGenerator } from './report/generator';

import {
  InputSource,
  ReviewOptions,
  DesignReviewReport,
  FigmaDesignData,
  PageCaptureData,
} from './types';
import { DEFAULT_OPTIONS } from './config';
import { AIAnalyzer } from './diff/ai-analyzer';

function determineMode(input: InputSource): 'full' | 'url-screenshot' | 'screenshot-url' | 'visual-only' {
  const hasPageUrl = !!input.pageUrl;
  const hasPageScreenshot = !!input.pageScreenshot;
  const hasFigmaUrl = !!input.figmaUrl;
  const hasFigmaScreenshot = !!input.figmaScreenshot;

  if (hasPageUrl && hasFigmaUrl) return 'full';
  if (hasPageUrl && hasFigmaScreenshot) return 'url-screenshot';
  if (hasPageScreenshot && hasFigmaUrl) return 'screenshot-url';
  return 'visual-only';
}

/** 读取 PNG 图片的宽度 */
function readImageWidth(imagePath: string): number | null {
  try {
    const data = fs.readFileSync(imagePath);
    const png = PNG.sync.read(data);
    return png.width;
  } catch {
    return null;
  }
}

export async function designReview(input: InputSource): Promise<DesignReviewReport> {
  const opts: ReviewOptions = {
    tolerance: { ...DEFAULT_OPTIONS.tolerance, ...input.options?.tolerance },
    output: { ...DEFAULT_OPTIONS.output, ...input.options?.output },
    capture: { ...DEFAULT_OPTIONS.capture, ...input.options?.capture },
  };

  const outputDir = opts.output.dir;
  fs.mkdirSync(outputDir, { recursive: true });

  const mode = determineMode(input);
  const pageLabel = input.pageUrl || input.pageScreenshot || '未知';
  const figmaLabel = input.figmaUrl || input.figmaScreenshot || '未知';

  console.log('🚀 Design Review 启动\n');
  console.log(`   模式: ${mode}`);
  console.log(`   页面: ${pageLabel}`);
  console.log(`   Figma: ${figmaLabel}\n`);

  // ---- Step 1: 获取 Figma 数据 ----
  // 先获取页面截图宽度（如果有的话），用于 Figma 导出时按目标宽度渲染
  let pageScreenshotWidth: number | undefined;
  if (input.pageScreenshot) {
    const w = readImageWidth(path.resolve(input.pageScreenshot));
    if (w) {
      pageScreenshotWidth = w;
      console.log(`📐 检测到页面截图宽度: ${w}px`);
    }
  }
  // 如果用户手动指定了目标宽度，优先使用
  const targetWidth = input.targetWidth || pageScreenshotWidth;

  let figmaData: FigmaDesignData;
  if (input.figmaUrl) {
    figmaData = await FigmaExtractor.extract(input.figmaUrl, input.figmaToken, targetWidth, outputDir);
  } else if (input.figmaScreenshot) {
    // 截图模式: 只有截图, 没有属性数据
    const screenshotPath = path.resolve(input.figmaScreenshot);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Figma 截图文件不存在: ${screenshotPath}`);
    }
    // 复制截图到输出目录
    const destPath = path.join(outputDir, 'figma-screenshot.png');
    fs.copyFileSync(screenshotPath, destPath);

    figmaData = {
      fileName: path.basename(screenshotPath),
      pageName: 'Figma 截图',
      components: [], // 截图模式无法提取属性
      screenshots: { 'root': destPath },
      fullScreenshot: destPath,
    };
    console.log('📐 使用 Figma 截图模式 (仅支持像素对比)');
  } else {
    throw new Error('请提供 figmaUrl 或 figmaScreenshot');
  }

  // ---- Step 2: 获取页面数据 ----
  let pageData: PageCaptureData;
  if (input.pageUrl) {
    pageData = await PageCapture.capture(input.pageUrl, opts.capture, outputDir);
  } else if (input.pageScreenshot) {
    // 截图模式: 只有截图, 没有属性数据
    const screenshotPath = path.resolve(input.pageScreenshot);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`页面截图文件不存在: ${screenshotPath}`);
    }
    // 复制截图到输出目录
    const destPath = path.join(outputDir, 'page-full.png');
    fs.copyFileSync(screenshotPath, destPath);

    pageData = {
      url: input.pageScreenshot,
      title: '页面截图',
      fullScreenshot: destPath,
      viewportScreenshot: destPath,
      elements: [], // 截图模式无法提取 DOM 属性
    };
    console.log('🌐 使用页面截图模式 (仅支持像素对比)');
  } else {
    throw new Error('请提供 pageUrl 或 pageScreenshot');
  }

  // ---- Step 3: 执行对比 ----
  const diffResult = await DiffEngine.compare(figmaData, pageData, opts.tolerance, outputDir);

  // ---- Step 3.5: AI 视觉分析 (可选) ----
  const aiEnabled = input.options?.ai ?? (
    !!process.env.AI_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY
  );

  if (aiEnabled) {
    const aiAnalyzer = new AIAnalyzer();
    if (aiAnalyzer.isConfigured) {
      try {
        const figmaScreenshotForAI = figmaData.fullScreenshot || Object.values(figmaData.screenshots)[0];
        const pageScreenshotForAI = pageData.fullScreenshot;

        if (figmaScreenshotForAI && pageScreenshotForAI) {
          console.log('\n🤖 正在进行 AI 视觉分析...');
          const aiResult = await aiAnalyzer.analyze(figmaScreenshotForAI, pageScreenshotForAI, outputDir);
          console.log(`   AI 发现 ${aiResult.issues.length} 个问题, 评分: ${aiResult.overallScore}`);
          console.log(`   摘要: ${aiResult.summary}`);

          // 将 AI 发现的问题合并到结果中
          const aiModuleDiffs = aiAnalyzer.convertToModuleDiffs(aiResult, figmaScreenshotForAI, pageScreenshotForAI);
          diffResult.propertyDiffs.push(...aiModuleDiffs);

          // 重新统计
          for (const mod of aiModuleDiffs) {
            for (const issue of mod.issues) {
              switch (issue.level) {
                case 'critical': diffResult.criticalCount++; break;
                case 'major': diffResult.majorCount++; break;
                case 'minor': diffResult.minorCount++; break;
                case 'suggestion': diffResult.suggestionCount++; break;
              }
            }
          }
          diffResult.totalIssues += aiResult.issues.length;

          // 综合评分: 算法分 (权重 60%) + AI 分 (权重 40%)
          const algoScore = diffResult.overallScore;
          const blendedScore = Math.round(algoScore * 0.6 + aiResult.overallScore * 0.4);
          diffResult.overallScore = blendedScore;
          console.log(`   综合评分: ${blendedScore} (算法 ${algoScore} + AI ${aiResult.overallScore})`);
        }
      } catch (err) {
        console.warn('⚠️ AI 分析失败 (不影响基础对比结果):', (err as Error).message);
      }
    }
  }

  // ---- Step 4: 生成报告 ----
  const report = ReportGenerator.generate(
    diffResult,
    input.pageUrl || input.pageScreenshot || '',
    input.figmaUrl || input.figmaScreenshot || '',
    opts.output.formats,
    outputDir
  );

  console.log('\n✅ 设计还原度检查完成!');
  console.log(`   总体评分: ${report.meta.overallScore} / 100`);
  console.log(`   问题数量: ${report.meta.totalIssues}`);
  for (const file of report.outputFiles) {
    console.log(`   📁 ${file}`);
  }

  return report;
}

export { FigmaExtractor } from './figma/extractor';
export { PageCapture } from './capture/browser';
export { DiffEngine } from './diff/engine';
export { ReportGenerator } from './report/generator';
export * from './types';
