#!/usr/bin/env node
// ============================================================
// Design Review MVP - CLI 入口
// ============================================================

import { config } from 'dotenv';
config(); // 加载 .env 文件

import { Command } from 'commander';
import { designReview } from './index';

const program = new Command();

program
  .name('design-review')
  .description('自动化设计还原度检查工具 - 对比线上页面与 Figma 设计稿')
  .version('0.1.0');

program
  .command('check')
  .description('执行设计还原度检查')
  .option('-u, --url <pageUrl>', '线上页面 URL (与 --page-screenshot 二选一)')
  .option('-p, --page-screenshot <path>', '页面截图本地路径 (与 --url 二选一)')
  .option('-f, --figma <figmaUrl>', 'Figma 文件链接 (与 --figma-screenshot 二选一)')
  .option('-g, --figma-screenshot <path>', 'Figma 设计稿截图本地路径 (与 --figma 二选一)')
  .option('-t, --token <figmaToken>', 'Figma Access Token (也可通过 FIGMA_ACCESS_TOKEN 环境变量设置)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--format <formats>', '输出格式, 逗号分隔 (html,markdown,csv)', 'html,markdown')
  .option('--viewport-width <width>', '视口宽度', '1440')
  .option('--viewport-height <height>', '视口高度', '900')
  .option('--ai', '启用 AI 视觉分析 (需设置 AI_API_KEY 环境变量)')
  .option('--ai-key <apiKey>', 'AI API Key')
  .option('--ai-base <apiBase>', 'AI API Base URL')
  .option('--ai-model <model>', 'AI 模型名称')
  .addHelpText('after', `
示例:
  # 完整模式 (URL + Figma)
  $ design-review check -u https://example.com -f https://figma.com/file/xxx

  # 页面截图 + Figma
  $ design-review check -p ./page.png -f https://figma.com/file/xxx

  # URL + Figma 截图
  $ design-review check -u https://example.com -g ./design.png

  # 纯截图对比
  $ design-review check -p ./page.png -g ./design.png

  # 启用 AI 分析
  $ design-review check -p ./page.png -g ./design.png --ai
  $ design-review check -p ./page.png -g ./design.png --ai --ai-key sk-xxx --ai-model gpt-4o
`)
  .action(async (opts) => {
    try {
      // 校验: 至少需要页面输入 + Figma 输入各一个
      if (!opts.url && !opts.pageScreenshot) {
        console.error('❌ 请提供页面输入: --url <页面URL> 或 --page-screenshot <截图路径>');
        process.exit(1);
      }
      if (!opts.figma && !opts.figmaScreenshot) {
        console.error('❌ 请提供 Figma 输入: --figma <Figma链接> 或 --figma-screenshot <截图路径>');
        process.exit(1);
      }

      const formats = opts.format.split(',').map((f: string) => f.trim());

      // AI 配置: CLI 参数 > 环境变量
      if (opts.aiKey) process.env.AI_API_KEY = opts.aiKey;
      if (opts.aiBase) process.env.AI_API_BASE = opts.aiBase;
      if (opts.aiModel) process.env.AI_MODEL = opts.aiModel;

      await designReview({
        pageUrl: opts.url,
        pageScreenshot: opts.pageScreenshot,
        figmaUrl: opts.figma,
        figmaScreenshot: opts.figmaScreenshot,
        figmaToken: opts.token,
        options: {
          output: {
            dir: opts.output,
            formats,
            screenshotScale: 2,
          },
          capture: opts.url ? {
            viewportWidth: parseInt(opts.viewportWidth),
            viewportHeight: parseInt(opts.viewportHeight),
            waitBeforeCapture: 2000,
            interactionStates: ['hover', 'focus'],
          } : undefined,
          ai: opts.ai,
        },
      });
    } catch (err: any) {
      console.error('\n❌ 执行失败:', err.message);
      process.exit(1);
    }
  });

program.parse();
