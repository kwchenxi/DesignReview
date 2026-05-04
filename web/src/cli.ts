#!/usr/bin/env node

import { Command } from 'commander';
import { designReview } from './index';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('design-review-public')
  .description('公开版设计还原度检查工具')
  .version('1.0.0');

program
  .command('review')
  .description('执行设计审查')
  .option('-u, --url <url>', '线上页面 URL')
  .option('-p, --page-screenshot <path>', '页面截图路径')
  .option('-f, --figma <url>', 'Figma 设计稿 URL')
  .option('-g, --figma-screenshot <path>', 'Figma 设计稿截图路径')
  .option('-t, --token <token>', 'Figma API Token')
  .option('-o, --output <path>', '输出目录', './output')
  .option('--format <formats>', '输出格式 (html,markdown)', 'html,markdown')
  .option('--ai', '启用 AI 视觉分析')
  .option('--ai-key <key>', 'AI API Key')
  .option('--ai-base <url>', 'AI API Base URL')
  .option('--ai-model <model>', 'AI 模型', 'claude-sonnet-4-20250514')
  .option('--viewport-width <width>', '视口宽度', '1440')
  .option('--viewport-height <height>', '视口高度', '900')
  .action(async (options) => {
    try {
      // 校验
      if (!options.url && !options.pageScreenshot) {
        throw new Error('请提供 --url 或 --page-screenshot');
      }
      if (!options.figma && !options.figmaScreenshot) {
        throw new Error('请提供 --figma 或 --figma-screenshot');
      }

      // AI 配置
      if (options.aiKey) {
        process.env.AI_API_KEY = options.aiKey;
      }
      if (options.aiBase) {
        process.env.AI_API_BASE = options.aiBase;
      }
      if (options.aiModel) {
        process.env.AI_MODEL = options.aiModel;
      }

      const outputDir = options.output;
      fs.mkdirSync(outputDir, { recursive: true });

      const report = await designReview({
        pageUrl: options.url,
        pageScreenshot: options.pageScreenshot,
        figmaUrl: options.figma,
        figmaScreenshot: options.figmaScreenshot,
        figmaToken: options.token,
        options: {
          ai: options.ai || !!options.aiKey,
          output: {
            dir: outputDir,
            formats: options.format.split(','),
            screenshotScale: 2,
          },
          capture: {
            viewportWidth: parseInt(options.viewportWidth),
            viewportHeight: parseInt(options.viewportHeight),
            waitBeforeCapture: 2000,
            interactionStates: ['hover', 'focus'],
          },
        },
      });

      console.log(`\n✅ 审查完成!`);
      console.log(`   评分: ${report.meta.overallScore} / 100`);
      console.log(`   问题: ${report.meta.totalIssues} 个`);
      for (const file of report.outputFiles) {
        console.log(`   📁 ${file}`);
      }
    } catch (error: any) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

program
  .command('web')
  .description('启动 Web 服务')
  .option('-p, --port <port>', '端口号', '3457')
  .action(async (options) => {
    if (options.port) {
      process.env.PORT = options.port;
    }
    await import('./web/server');
  });

program.parse();
