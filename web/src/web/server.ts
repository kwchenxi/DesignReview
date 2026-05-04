// ============================================================
// Web 服务器 - Vercel 兼容版
// ============================================================

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { designReview } from '../index';
import { AIAnalyzer } from '../diff/ai-analyzer';
import { ReportGenerator } from '../report/generator';
import { DiffEngine } from '../diff/engine';
import { DesignSpecFetcher } from '../design-spec/fetcher';

const app = express();

const IS_VERCEL = !!process.env.VERCEL;

// Vercel 用 /tmp，本地用项目目录
const BASE_DIR = IS_VERCEL ? '/tmp/design-review' : path.resolve(process.cwd());
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// multer 配置
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, UPLOAD_DIR),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB (Vercel body limit)
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// 静态文件
app.use(express.static('public'));
app.use(express.json());

// ============================================================
// AI 配置与状态
// ============================================================

const aiAnalyzer = new AIAnalyzer();
const designSpecFetcher = IS_VERCEL ? null : new DesignSpecFetcher();

app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: aiAnalyzer.isConfigured,
    model: aiAnalyzer.isConfigured ? (process.env.AI_MODEL || 'gpt-4o') : '',
  });
});

app.post('/api/ai/config', express.json(), (req, res) => {
  try {
    const { apiKey, apiBase, model, provider } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: '请提供 API Key' });
    }
    const resolvedProvider = provider || (model?.startsWith('claude') ? 'claude' : 'openai');
    const resolvedBase = apiBase || (resolvedProvider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1');

    process.env.AI_API_KEY = apiKey;
    process.env.AI_API_BASE = resolvedBase;
    process.env.AI_MODEL = model || 'gpt-4o';
    process.env.AI_PROVIDER = resolvedProvider;

    aiAnalyzer.updateConfig({
      provider: resolvedProvider,
      apiKey,
      apiBase: resolvedBase,
      model: model || 'gpt-4o',
    });
    res.json({ success: true, message: 'AI 配置已更新' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 设计规范 API（仅非 Vercel 环境可用）
// ============================================================

if (!IS_VERCEL && designSpecFetcher) {
  app.get('/api/design-spec/status', async (_req, res) => {
    try {
      const spec = await designSpecFetcher.fetch();
      res.json({
        configured: true,
        packageName: spec.source.packageName,
        registry: spec.source.registry,
        tokensCount: spec.tokens.length,
        componentsCount: spec.components.length,
        fetchedAt: spec.fetchedAt,
      });
    } catch (err: any) {
      res.json({ configured: false, error: err.message });
    }
  });

  app.get('/api/design-spec/detail', async (_req, res) => {
    try {
      const spec = await designSpecFetcher.fetch();
      res.json({
        source: spec.source,
        tokens: spec.tokens,
        components: spec.components.map(c => ({
          name: c.name,
          path: c.path,
          tokens: c.tokens,
          styles: c.styles,
        })),
        fetchedAt: spec.fetchedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/design-spec/refresh', async (_req, res) => {
    try {
      const spec = await designSpecFetcher.fetch(true);
      res.json({
        success: true,
        tokensCount: spec.tokens.length,
        componentsCount: spec.components.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================
// 算法模式审查
// ============================================================

app.post('/api/compare', upload.fields([
  { name: 'pageScreenshot', maxCount: 1 },
  { name: 'figmaScreenshot', maxCount: 1 },
]), async (req: any, res: any) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pageScreenshot = files?.pageScreenshot?.[0]?.path;
    const figmaScreenshot = files?.figmaScreenshot?.[0]?.path;

    if (!pageScreenshot) {
      return res.status(400).json({ error: '请上传页面截图' });
    }
    if (!figmaScreenshot) {
      return res.status(400).json({ error: '请上传设计稿截图' });
    }

    const jobId = Date.now().toString(36);
    const jobOutputDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    const report = await designReview({
      pageScreenshot,
      figmaScreenshot,
      options: {
        ai: false,
        output: {
          dir: jobOutputDir,
          formats: ['html'],
          screenshotScale: 2,
        },
      },
    });

    // 读取 HTML 报告内容
    const htmlFile = report.outputFiles.find(f => f.endsWith('.html'));
    let reportHtml = '';
    if (htmlFile && fs.existsSync(htmlFile)) {
      reportHtml = fs.readFileSync(htmlFile, 'utf-8');
    }

    res.json({
      success: true,
      score: report.meta.overallScore,
      totalIssues: report.meta.totalIssues,
      criticalCount: report.meta.criticalCount,
      majorCount: report.meta.majorCount,
      minorCount: report.meta.minorCount,
      suggestionCount: report.meta.suggestionCount,
      reportHtml: Buffer.from(reportHtml).toString('base64'),
    });
  } catch (err: any) {
    console.error('对比失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI 模式审查
// ============================================================

app.post('/api/ai/compare', upload.fields([
  { name: 'pageScreenshot', maxCount: 1 },
  { name: 'figmaScreenshot', maxCount: 1 },
]), async (req: any, res: any) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let pageScreenshot = files?.pageScreenshot?.[0]?.path;
    let figmaScreenshot = files?.figmaScreenshot?.[0]?.path;

    if (!pageScreenshot) {
      return res.status(400).json({ error: '请上传页面截图' });
    }
    if (!figmaScreenshot) {
      return res.status(400).json({ error: '请上传设计稿截图' });
    }
    if (!aiAnalyzer.isConfigured) {
      return res.status(400).json({ error: 'AI API Key 未配置，请在设置中配置后再使用 AI 分析' });
    }

    const jobId = Date.now().toString(36);
    const jobOutputDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    // 像素对比
    const diffImagePath = path.join(jobOutputDir, 'visual-diff.png');
    let pixelResult: any = null;
    try {
      const { pixelDiff } = require('../diff/engine');
      pixelResult = await pixelDiff(figmaScreenshot, pageScreenshot, diffImagePath);
    } catch {
      // 像素对比失败不影响 AI 分析
    }

    console.log('🤖 正在进行 AI 视觉分析...');

    const result = await aiAnalyzer.analyze(figmaScreenshot, pageScreenshot, jobOutputDir);
    console.log(`✅ AI 分析完成: 发现 ${result.issues.length} 个问题`);

    const moduleDiffs = aiAnalyzer.convertToModuleDiffs(result, figmaScreenshot, pageScreenshot);

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

    const diffResult = {
      pixelDiff: { similarity: result.pixelSimilarity || result.overallScore, diffImagePath: result.diffImagePath || '', mismatchedPixels: 0, totalPixels: 0 },
      propertyDiffs: moduleDiffs,
      overallScore: result.overallScore,
      totalIssues: result.issues.length,
      criticalCount,
      majorCount,
      minorCount,
      suggestionCount,
    };

    const report = ReportGenerator.generate(
      diffResult,
      pageScreenshot,
      figmaScreenshot,
      ['html'],
      jobOutputDir
    );

    const htmlFile = report.outputFiles.find(f => f.endsWith('.html'));
    let reportHtml = '';
    if (htmlFile && fs.existsSync(htmlFile)) {
      reportHtml = fs.readFileSync(htmlFile, 'utf-8');
    }

    res.json({
      success: true,
      score: result.overallScore,
      totalIssues: result.issues.length,
      criticalCount,
      majorCount,
      minorCount,
      suggestionCount,
      summary: result.summary,
      reportHtml: Buffer.from(reportHtml).toString('base64'),
    });
  } catch (err: any) {
    console.error('AI 分析失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 主页 - 返回 public/index.html
// ============================================================

app.get('/', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 仅非 Vercel 环境启动监听
if (!IS_VERCEL) {
  const PORT = parseInt(process.env.PORT || '3457', 10);
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`🌐 Design Review Web UI 已启动`);
    console.log(`   本机访问: http://localhost:${PORT}`);
    console.log(`   局域网访问: http://<你的IP>:${PORT}\n`);
  });
}

export default app;
