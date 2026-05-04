// ============================================================
// Design Review Public - 主入口（Vercel 兼容版）
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

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

  console.log('🚀 Design Review 启动');

  // ---- Step 1: 获取 Figma 数据（仅截图模式） ----
  let figmaData: FigmaDesignData;
  if (input.figmaScreenshot) {
    const screenshotPath = path.resolve(input.figmaScreenshot);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Figma 截图文件不存在: ${screenshotPath}`);
    }
    const destPath = path.join(outputDir, 'figma-screenshot.png');
    fs.copyFileSync(screenshotPath, destPath);

    figmaData = {
      fileName: path.basename(screenshotPath),
      pageName: 'Figma 截图',
      components: [],
      screenshots: { 'root': destPath },
      fullScreenshot: destPath,
    };
    console.log('📐 使用 Figma 截图模式');
  } else {
    throw new Error('请提供 figmaScreenshot（设计稿截图）。在线版本不支持 URL 自动截图，请手动上传截图。');
  }

  // ---- Step 2: 获取页面数据（仅截图模式） ----
  let pageData: PageCaptureData;
  if (input.pageScreenshot) {
    const screenshotPath = path.resolve(input.pageScreenshot);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`页面截图文件不存在: ${screenshotPath}`);
    }
    const destPath = path.join(outputDir, 'page-full.png');
    fs.copyFileSync(screenshotPath, destPath);

    pageData = {
      url: input.pageScreenshot,
      title: '页面截图',
      fullScreenshot: destPath,
      viewportScreenshot: destPath,
      elements: [],
    };
    console.log('🌐 使用页面截图模式');
  } else {
    throw new Error('请提供 pageScreenshot（页面截图）。在线版本不支持 URL 自动截图，请手动上传截图。');
  }

  // ---- Step 3: 执行对比 ----
  const diffResult = await DiffEngine.compare(figmaData, pageData, opts.tolerance, outputDir);

  // ---- Step 3.5: AI 分析 (可选) ----
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
          console.log('🤖 正在进行 AI 视觉分析...');
          const aiResult = await aiAnalyzer.analyze(figmaScreenshotForAI, pageScreenshotForAI, outputDir);
          console.log(`   AI 发现 ${aiResult.issues.length} 个问题, 评分: ${aiResult.overallScore}`);

          const aiModuleDiffs = aiAnalyzer.convertToModuleDiffs(aiResult, figmaScreenshotForAI, pageScreenshotForAI);
          diffResult.propertyDiffs.push(...aiModuleDiffs);

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

          const algoScore = diffResult.overallScore;
          const blendedScore = Math.round(algoScore * 0.6 + aiResult.overallScore * 0.4);
          diffResult.overallScore = blendedScore;
          console.log(`   综合评分: ${blendedScore} (算法 ${algoScore} + AI ${aiResult.overallScore})`);
        }
      } catch (err) {
        console.warn('⚠️ AI 分析失败 (不影响基础对比):', (err as Error).message);
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

  console.log(`✅ 检查完成! 评分: ${report.meta.overallScore}, 问题: ${report.meta.totalIssues}`);
  return report;
}

export { DiffEngine } from './diff/engine';
export { ReportGenerator } from './report/generator';
export * from './types';
export * from './config';
