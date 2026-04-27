import { config } from 'dotenv';
config();

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { designReview } from '../index';
import { AIAnalyzer } from '../diff/ai-analyzer';
import { ReportGenerator } from '../report/generator';
import { DiffEngine } from '../diff/engine';

const app = express();
const PORT = 3456;

// 使用绝对路径
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 自动清理超过 7 天的旧报告
const MAX_AGE_DAYS = 7;
const now = Date.now();
try {
  for (const entry of fs.readdirSync(OUTPUT_DIR)) {
    const entryPath = path.join(OUTPUT_DIR, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      const ageMs = now - stat.mtimeMs;
      if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
        fs.rmSync(entryPath, { recursive: true, force: true });
        console.log(`🗑️  清理旧报告: ${entry}`);
      }
    }
  }
} catch { /* 忽略清理失败 */ }

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// 静态文件 - 输出目录
app.use('/output', express.static(OUTPUT_DIR));
app.use(express.json());

// 主页
app.get('/', (_req, res) => {
  res.send(getHomePage());
});

// 上传对比接口
app.post('/api/compare', upload.fields([
  { name: 'pageScreenshot', maxCount: 1 },
  { name: 'figmaScreenshot', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pageUrl = req.body.pageUrl as string | undefined;
    const figmaUrl = req.body.figmaUrl as string | undefined;
    const targetWidthStr = req.body.targetWidth as string | undefined;
    const targetWidth = targetWidthStr ? parseInt(targetWidthStr, 10) : undefined;

    const pageScreenshot = files?.pageScreenshot?.[0]?.path;
    const figmaScreenshot = files?.figmaScreenshot?.[0]?.path;

    // 校验
    if (!pageUrl && !pageScreenshot) {
      return res.status(400).json({ error: '请提供线上页面 URL 或上传页面截图' });
    }
    if (!figmaUrl && !figmaScreenshot) {
      return res.status(400).json({ error: '请提供 Figma 链接或上传设计稿截图' });
    }

    // 生成唯一输出目录
    const jobId = Date.now().toString(36);
    const jobOutputDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    const report = await designReview({
      pageUrl: pageUrl || undefined,
      pageScreenshot: pageScreenshot || undefined,
      figmaUrl: figmaUrl || undefined,
      figmaScreenshot: figmaScreenshot || undefined,
      targetWidth: targetWidth && !isNaN(targetWidth) ? targetWidth : undefined,
      options: {
        output: {
          dir: jobOutputDir,
          formats: ['html', 'markdown'],
          screenshotScale: 2,
        },
      },
    });

    // 找到 HTML 报告的相对路径
    const htmlFile = report.outputFiles.find(f => f.endsWith('.html'));
    const htmlUrl = htmlFile ? `/output/${jobId}/${path.basename(htmlFile)}` : null;

    res.json({
      success: true,
      score: report.meta.overallScore,
      totalIssues: report.meta.totalIssues,
      criticalCount: report.meta.criticalCount,
      majorCount: report.meta.majorCount,
      minorCount: report.meta.minorCount,
      suggestionCount: report.meta.suggestionCount,
      reportUrl: htmlUrl,
    });
  } catch (err: any) {
    console.error('对比失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI 视觉分析接口
// ============================================================

const aiAnalyzer = new AIAnalyzer();

// 检查 AI 配置状态
app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: aiAnalyzer.isConfigured,
    model: aiAnalyzer.isConfigured ? (process.env.AI_MODEL || 'gpt-4o') : '',
  });
});

// 保存 AI 配置（仅在当次运行中生效）
app.post('/api/ai/config', express.json(), (req, res) => {
  try {
    const { apiKey, apiBase, model, provider } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: '请提供 API Key' });
    }
    // 根据 model 自动推断 provider（如果未显式指定）
    const resolvedProvider = provider || (model?.startsWith('claude') ? 'claude' : 'openai');
    // 更新环境变量（当次运行生效）
    process.env.AI_API_KEY = apiKey;
    process.env.AI_API_BASE = apiBase || (resolvedProvider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1');
    process.env.AI_MODEL = model || 'gpt-4o';
    process.env.AI_PROVIDER = resolvedProvider;
    // 重新初始化
    aiAnalyzer.updateConfig({
      provider: resolvedProvider,
      apiKey,
      apiBase: apiBase || (resolvedProvider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'),
      model: model || 'gpt-4o',
    });
    res.json({ success: true, message: 'AI 配置已更新' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI 分析接口
app.post('/api/ai/compare', upload.fields([
  { name: 'pageScreenshot', maxCount: 1 },
  { name: 'figmaScreenshot', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pageUrl = req.body.pageUrl as string | undefined;
    const figmaUrl = req.body.figmaUrl as string | undefined;
    let pageScreenshot = files?.pageScreenshot?.[0]?.path;
    let figmaScreenshot = files?.figmaScreenshot?.[0]?.path;

    // 校验：至少要有截图或 URL
    if (!pageUrl && !pageScreenshot) {
      return res.status(400).json({ error: '请提供线上页面 URL 或上传页面截图' });
    }
    if (!figmaUrl && !figmaScreenshot) {
      return res.status(400).json({ error: '请提供 Figma 链接或上传设计稿截图' });
    }

    if (!aiAnalyzer.isConfigured) {
      return res.status(400).json({ error: 'AI API Key 未配置，请在设置中配置后再使用 AI 分析' });
    }

    const jobId = Date.now().toString(36);
    const jobOutputDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    // 如果有 URL 但没有截图，先通过 designReview 截图
    if (!pageScreenshot || !figmaScreenshot) {
      console.log('📸 AI 模式：先从 URL 获取截图...');
      try {
        await designReview({
          pageUrl: !pageScreenshot ? pageUrl : undefined,
          pageScreenshot: pageScreenshot || undefined,
          figmaUrl: !figmaScreenshot ? figmaUrl : undefined,
          figmaScreenshot: figmaScreenshot || undefined,
          options: {
            output: {
              dir: jobOutputDir,
              formats: ['markdown'],
              screenshotScale: 2,
            },
          },
        });
        // designReview 会把截图保存到输出目录
        const pageScreenshotPath = path.join(jobOutputDir, 'page-full.png');
        const figmaScreenshotPath = path.join(jobOutputDir, 'figma-screenshot.png');
        if (!pageScreenshot && fs.existsSync(pageScreenshotPath)) {
          pageScreenshot = pageScreenshotPath;
        }
        if (!figmaScreenshot && fs.existsSync(figmaScreenshotPath)) {
          figmaScreenshot = figmaScreenshotPath;
        }
      } catch (captureErr: any) {
        console.error('截图失败:', captureErr.message);
      }
    }

    if (!pageScreenshot) {
      return res.status(400).json({ error: '无法获取页面截图，请直接上传截图' });
    }
    if (!figmaScreenshot) {
      return res.status(400).json({ error: '无法获取设计稿截图，请直接上传截图' });
    }

    console.log('🤖 正在进行 AI 视觉分析...');
    const result = await aiAnalyzer.analyze(figmaScreenshot, pageScreenshot, jobOutputDir);
    console.log(`✅ AI 分析完成: 发现 ${result.issues.length} 个问题`);

    // 将 AI 结果转换为 ModuleDiff 格式并生成报告
    const moduleDiffs = aiAnalyzer.convertToModuleDiffs(result, figmaScreenshot, pageScreenshot);

    // 统计
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

    // 生成报告
    const diffResult = {
      pixelDiff: { similarity: result.overallScore, diffImagePath: '', mismatchedPixels: 0, totalPixels: 0 },
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
      ['html', 'markdown'],
      jobOutputDir
    );

    const htmlFile = report.outputFiles.find(f => f.endsWith('.html'));
    const htmlUrl = htmlFile ? `/output/${jobId}/${path.basename(htmlFile)}` : null;

    res.json({
      success: true,
      score: result.overallScore,
      totalIssues: result.issues.length,
      criticalCount,
      majorCount,
      minorCount,
      suggestionCount,
      summary: result.summary,
      reportUrl: htmlUrl,
    });
  } catch (err: any) {
    console.error('AI 分析失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 启动 - 监听所有网络接口，支持局域网访问
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Design Review Web UI 已启动`);
  console.log(`   本机访问: http://localhost:${PORT}`);
  console.log(`   局域网访问: http://<你的IP>:${PORT}\n`);
});

// ============================================================
// 主页 HTML
// ============================================================

function getHomePage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Review - 设计还原度检查</title>
  <style>
    :root {
      --bg: #F0F4F8;
      --surface: #ffffff;
      --surface-hover: #f8fafc;
      --border: #E2E8F0;
      --text: #0F172A;
      --text-secondary: #64748b;
      --accent: #2563EB;
      --accent-hover: #1d4ed8;
      --accent-light: #eff6ff;
      --critical: #dc2626;
      --critical-bg: #fef2f2;
      --major: #ea580c;
      --major-bg: #fff7ed;
      --minor: #ca8a04;
      --minor-bg: #fefce8;
      --suggestion: #16a34a;
      --suggestion-bg: #f0fdf4;
      --success: #16a34a;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .page-header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 20px 0;
    }
    .page-header .container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-mark {
      width: 36px; height: 36px;
      background: var(--accent);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 18px;
    }
    .logo-text {
      font-size: 20px; font-weight: 700; color: var(--text);
    }
    .logo-text span { color: var(--accent); }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .main-content {
      padding: 40px 24px 64px;
      max-width: 960px;
      margin: 0 auto;
    }
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
    }
    .page-desc {
      color: var(--text-secondary);
      font-size: 15px;
      margin-bottom: 32px;
    }
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 640px) {
      .upload-grid { grid-template-columns: 1fr; }
    }
    .upload-card {
      background: var(--surface);
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 28px 24px;
      text-align: center;
      transition: border-color 0.2s, box-shadow 0.2s;
      cursor: pointer;
      position: relative;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .upload-card:hover, .upload-card.dragover {
      border-color: var(--accent);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 0 0 3px rgba(37,99,235,0.1);
    }
    .upload-card.has-file {
      border-style: solid;
      border-color: var(--success);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 0 0 3px rgba(22,163,74,0.1);
    }
    .upload-icon {
      width: 48px; height: 48px;
      margin: 0 auto 12px;
      background: var(--accent-light);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .upload-icon svg { width: 24px; height: 24px; color: var(--accent); }
    .upload-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: var(--text); }
    .upload-card p { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .upload-card input[type="file"] { display: none; }
    .upload-card input[type="text"] {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      margin-top: 8px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .upload-card input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .file-name {
      margin-top: 8px;
      font-size: 13px;
      color: var(--success);
      font-weight: 500;
      word-break: break-all;
    }
    .or-divider {
      color: var(--text-secondary);
      font-size: 12px;
      margin: 12px 0;
      display: flex; align-items: center; gap: 8px;
    }
    .or-divider::before, .or-divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }
    .preview-img {
      max-width: 100%;
      max-height: 180px;
      border-radius: 6px;
      margin-top: 12px;
      object-fit: contain;
      display: none;
      border: 1px solid var(--border);
    }
    .btn-select {
      padding: 8px 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }
    .btn-select:hover {
      background: var(--accent-light);
      border-color: var(--accent);
      color: var(--accent);
    }
    .btn-primary {
      display: block;
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, box-shadow 0.2s;
      letter-spacing: 0.02em;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
      box-shadow: 0 2px 8px rgba(37,99,235,0.3);
    }
    .btn-primary:active { transform: translateY(1px); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    .result-section {
      margin-top: 36px;
      display: none;
    }
    .result-section.visible { display: block; }
    .result-header {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 24px;
      background: var(--surface);
      padding: 24px 32px;
      border-radius: 8px;
      border: 1px solid var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .score-wrapper {
      width: 88px; height: 88px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 3px solid var(--border);
      flex-shrink: 0;
    }
    .score-wrapper.score-high { border-color: var(--success); background: var(--suggestion-bg); }
    .score-wrapper.score-mid { border-color: var(--minor); background: var(--minor-bg); }
    .score-wrapper.score-low { border-color: var(--critical); background: var(--critical-bg); }
    .score-big {
      font-size: 32px;
      font-weight: 800;
      color: var(--text);
    }
    .score-wrapper.score-high .score-big { color: var(--success); }
    .score-wrapper.score-mid .score-big { color: var(--minor); }
    .score-wrapper.score-low .score-big { color: var(--critical); }
    .result-meta h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .result-meta p { color: var(--text-secondary); font-size: 14px; }
    .stats-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .stat-chip {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      background: var(--surface);
      border: 1px solid var(--border);
      display: flex; align-items: center; gap: 6px;
    }
    .stat-dot {
      width: 8px; height: 8px; border-radius: 50%; display: inline-block;
    }
    .stat-chip.critical { color: var(--critical); border-color: #fecaca; background: var(--critical-bg); }
    .stat-chip.critical .stat-dot { background: var(--critical); }
    .stat-chip.major { color: var(--major); border-color: #fed7aa; background: var(--major-bg); }
    .stat-chip.major .stat-dot { background: var(--major); }
    .stat-chip.minor { color: var(--minor); border-color: #fde68a; background: var(--minor-bg); }
    .stat-chip.minor .stat-dot { background: var(--minor); }
    .stat-chip.suggestion { color: var(--suggestion); border-color: #bbf7d0; background: var(--suggestion-bg); }
    .stat-chip.suggestion .stat-dot { background: var(--suggestion); }
    .open-report-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 24px;
      background: var(--accent);
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.2s;
    }
    .open-report-btn:hover { background: var(--accent-hover); }
    .loading {
      display: none;
      text-align: center;
      padding: 40px;
    }
    .loading.visible { display: block; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading p { color: var(--text-secondary); font-size: 14px; }
    .error-msg {
      display: none;
      background: var(--critical-bg);
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 14px 20px;
      margin-top: 20px;
      color: var(--critical);
      font-size: 14px;
      font-weight: 500;
    }
    .error-msg.visible { display: flex; align-items: center; gap: 8px; }
    .device-select {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .device-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .device-select select {
      flex: 1;
      min-width: 200px;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 36px;
    }
    .device-select select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .device-select input[type="number"] {
      flex: 1;
      min-width: 200px;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .device-select input[type="number"]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .device-hint {
      width: 100%;
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    /* 分析模式胶囊切换 */
    .mode-segment {
      display: flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .mode-option {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .mode-option:hover { color: var(--text); background: var(--bg); }
    .mode-option.active {
      background: var(--accent);
      color: white;
      box-shadow: 0 2px 8px rgba(37,99,235,0.3);
    }
    .mode-option .mode-icon { font-size: 18px; }
    .mode-option .mode-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .mode-option.active .mode-tag { background: rgba(255,255,255,0.2); }
    .mode-option:not(.active) .mode-tag { background: var(--bg); color: var(--text-secondary); }
    /* AI 设置面板 */
    .ai-settings {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
      display: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .ai-settings.visible { display: block; }
    .ai-settings-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-field { margin-bottom: 14px; }
    .ai-field:last-child { margin-bottom: 0; }
    .ai-field label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    .ai-field input, .ai-field select {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .ai-field input:focus, .ai-field select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .ai-field .hint { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    .ai-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 500;
    }
    .ai-status.ok { background: var(--suggestion-bg); color: var(--suggestion); }
    .ai-status.no { background: var(--critical-bg); color: var(--critical); }
    .ai-status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .ai-status.ok .ai-status-dot { background: var(--suggestion); }
    .ai-status.no .ai-status-dot { background: var(--critical); }
  </style>
</head>
<body>
  <header class="page-header">
    <div class="container" style="display:flex;align-items:center;gap:12px;">
      <div class="logo-mark">D</div>
      <div class="logo-text">Design<span>Review</span><span style="color:var(--text-secondary);font-weight:400;margin-left:4px;">/ 设计还原度检查</span></div>
    </div>
  </header>

  <div class="main-content">

    <!-- 分析模式切换 -->
    <div class="mode-segment" id="modeSegment">
      <button type="button" class="mode-option active" data-mode="ai" onclick="switchMode('ai')">
        <span class="mode-icon">🤖</span>
        <span>AI 分析</span>
        <span class="mode-tag">消耗 Token</span>
      </button>
      <button type="button" class="mode-option" data-mode="algorithm" onclick="switchMode('algorithm')">
        <span class="mode-icon">⚡</span>
        <span>算法分析</span>
        <span class="mode-tag">免费</span>
      </button>
    </div>

    <!-- AI 设置面板 -->
    <div class="ai-settings" id="aiSettings">
      <div class="ai-settings-title" onclick="toggleAISettings()" style="cursor: pointer; user-select: none;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:18px;height:18px;color:var(--accent)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        AI 分析配置
        <span class="ai-status" id="aiStatus"><span class="ai-status-dot"></span><span id="aiStatusText">检测中...</span></span>
        <span id="aiToggleArrow" style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">▶</span>
      </div>
      <div id="aiFieldsBody">
      <div class="ai-field">
        <label>API Key</label>
        <input type="password" id="aiApiKey" placeholder="sk-..." />
        <div class="hint">支持 OpenAI、DeepSeek、Claude 等</div>
      </div>
      <div class="ai-field">
        <label>API Base URL</label>
        <input type="text" id="aiApiBase" value="https://api.openai.com/v1" placeholder="https://api.openai.com/v1" />
        <div class="hint">OpenAI: https://api.openai.com/v1 | Claude: https://api.anthropic.com | DeepSeek: https://api.deepseek.com/v1</div>
      </div>
      <div class="ai-field">
        <label>模型</label>
        <select id="aiModel">
          <option value="claude-sonnet-4-20250514" selected>Claude Sonnet 4 (推荐)</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (更快)</option>
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
        </select>
      </div>
      </div>
    </div>

    <form id="compareForm" enctype="multipart/form-data">
      <div class="upload-grid">
        <div class="upload-card" id="pageCard">
          <div class="upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.466.733-3.558" /></svg>
          </div>
          <h3>线上页面</h3>
          <p>提供 URL 或上传截图</p>
          <input type="text" name="pageUrl" placeholder="粘贴页面 URL..." />
          <div class="or-divider">或</div>
          <input type="file" id="pageFile" name="pageScreenshot" accept="image/*" />
          <button type="button" class="btn-select" onclick="document.getElementById('pageFile').click()">选择截图</button>
          <div class="file-name" id="pageFileName"></div>
          <img class="preview-img" id="pagePreview" />
        </div>

        <div class="upload-card" id="figmaCard">
          <div class="upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
          </div>
          <h3>设计稿</h3>
          <p>提供 Figma 链接或上传截图</p>
          <input type="text" name="figmaUrl" placeholder="粘贴 Figma 链接..." />
          <div class="or-divider">或</div>
          <input type="file" id="figmaFile" name="figmaScreenshot" accept="image/*" />
          <button type="button" class="btn-select" onclick="document.getElementById('figmaFile').click()">选择截图</button>
          <div class="file-name" id="figmaFileName"></div>
          <img class="preview-img" id="figmaPreview" />
        </div>
      </div>

      <div class="device-select" id="deviceSection">
        <label class="device-label">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:18px;height:18px;color:var(--accent)"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
          渲染宽度
        </label>
        <select name="targetWidth" id="targetWidthSelect">
          <option value="">自动（按截图宽度）</option>
          <optgroup label="移动端">
            <option value="360">360px (Android 常见)</option>
            <option value="375">375px (iPhone SE / 6/7/8)</option>
            <option value="390">390px (iPhone 14/15)</option>
            <option value="393">393px (Pixel 7)</option>
            <option value="412">412px (Android 大屏)</option>
            <option value="414">414px (iPhone Plus)</option>
            <option value="428">428px (iPhone Pro Max)</option>
          </optgroup>
          <optgroup label="平板">
            <option value="768">768px (iPad Mini)</option>
            <option value="810">810px (iPad)</option>
            <option value="1024">1024px (iPad Pro)</option>
          </optgroup>
          <optgroup label="桌面端">
            <option value="1024">1024px</option>
            <option value="1280">1280px</option>
            <option value="1366">1366px</option>
            <option value="1440">1440px</option>
            <option value="1536">1536px</option>
            <option value="1920">1920px</option>
          </optgroup>
          <option value="custom">自定义宽度...</option>
        </select>
        <input type="number" name="targetWidthCustom" id="targetWidthCustom" placeholder="输入自定义宽度 (px)" style="display:none" min="200" max="3840" />
      </div>

      <button type="submit" class="btn-primary" id="submitBtn">开始检查</button>
    </form>

    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>正在对比分析中，请稍候...</p>
    </div>

    <div class="error-msg" id="errorMsg"></div>

    <div class="result-section" id="resultSection">
      <div class="result-header">
        <div class="score-wrapper" id="scoreWrapper">
          <div class="score-big" id="resultScore">--</div>
        </div>
        <div class="result-meta">
          <h2>还原度评分</h2>
          <p id="resultSummary"></p>
        </div>
      </div>
      <div class="stats-row" id="resultStats"></div>
      <a class="open-report-btn" id="reportLink" href="#" target="_blank">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        查看完整报告
      </a>
    </div>
  </div>

  <script>
    let currentMode = 'ai'; // 'algorithm' | 'ai'

    // 模式切换
    function switchMode(mode) {
      currentMode = mode;
      document.querySelectorAll('.mode-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      document.getElementById('aiSettings').classList.toggle('visible', mode === 'ai');

      // AI 模式下设备宽度选择仍可用
      // URL 输入框在两种模式下都可用

      // 更新提交按钮文案
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.textContent = '开始检查';
    }

    // 检查 AI 配置状态
    async function checkAIStatus() {
      try {
        const resp = await fetch('/api/ai/status');
        const data = await resp.json();
        const statusEl = document.getElementById('aiStatus');
        const statusText = document.getElementById('aiStatusText');
        if (data.configured) {
          statusEl.className = 'ai-status ok';
          statusText.textContent = '已配置 (' + data.model + ')';
          // 已配置则折叠
          aiSettingsExpanded = false;
          document.getElementById('aiFieldsBody').style.display = 'none';
          document.getElementById('aiToggleArrow').textContent = '▶';
        } else {
          statusEl.className = 'ai-status no';
          statusText.textContent = '未配置';
          // 未配置则展开引导用户填写
          aiSettingsExpanded = true;
          document.getElementById('aiFieldsBody').style.display = 'block';
          document.getElementById('aiToggleArrow').textContent = '▼';
        }
      } catch {
        document.getElementById('aiStatusText').textContent = '检测失败';
      }
    }
    let aiSettingsExpanded = false;

    function toggleAISettings() {
      aiSettingsExpanded = !aiSettingsExpanded;
      document.getElementById('aiFieldsBody').style.display = aiSettingsExpanded ? 'block' : 'none';
      document.getElementById('aiToggleArrow').textContent = aiSettingsExpanded ? '▼' : '▶';
    }

    checkAIStatus();
    // 初始化 AI 面板状态（默认 tab 为 ai 时需要显式触发）
    switchMode(currentMode);

    // 保存 AI 配置
    async function saveAIConfig() {
      const apiKey = document.getElementById('aiApiKey').value.trim();
      const apiBase = document.getElementById('aiApiBase').value.trim();
      const model = document.getElementById('aiModel').value;
      if (!apiKey) return;
      const provider = model.startsWith('claude') ? 'claude' : 'openai';
      try {
        const resp = await fetch('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, apiBase, model, provider }),
        });
        const data = await resp.json();
        if (data.success) {
          await checkAIStatus();
        }
      } catch {}
    }

    // 选择 Claude 模型时自动切换 API Base
    document.getElementById('aiModel').addEventListener('change', () => {
      const model = document.getElementById('aiModel').value;
      const apiBaseInput = document.getElementById('aiApiBase');
      if (model.startsWith('claude') && apiBaseInput.value.includes('openai')) {
        apiBaseInput.value = 'https://api.anthropic.com';
      } else if (!model.startsWith('claude') && apiBaseInput.value.includes('anthropic')) {
        apiBaseInput.value = 'https://api.openai.com/v1';
      }
      saveAIConfig();
    });
    document.getElementById('aiApiKey').addEventListener('change', saveAIConfig);
    document.getElementById('aiApiBase').addEventListener('change', saveAIConfig);

    const form = document.getElementById('compareForm');
    const pageFile = document.getElementById('pageFile');
    const figmaFile = document.getElementById('figmaFile');
    const pageCard = document.getElementById('pageCard');
    const figmaCard = document.getElementById('figmaCard');

    // 拖拽上传
    [pageCard, figmaCard].forEach(card => {
      const fileInput = card.querySelector('input[type="file"]');
      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('dragover'); });
      card.addEventListener('dragleave', () => card.classList.remove('dragover'));
      card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      });
    });

    // 文件预览
    function setupPreview(fileInput, nameEl, previewEl, card) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
          nameEl.textContent = file.name;
          card.classList.add('has-file');
          const reader = new FileReader();
          reader.onload = e => { previewEl.src = e.target.result; previewEl.style.display = 'block'; };
          reader.readAsDataURL(file);
        }
      });
    }
    setupPreview(pageFile, document.getElementById('pageFileName'), document.getElementById('pagePreview'), pageCard);
    setupPreview(figmaFile, document.getElementById('figmaFileName'), document.getElementById('figmaPreview'), figmaCard);

    // 设备宽度选择
    const widthSelect = document.getElementById('targetWidthSelect');
    const widthCustom = document.getElementById('targetWidthCustom');
    widthSelect.addEventListener('change', () => {
      if (widthSelect.value === 'custom') {
        widthCustom.style.display = 'block';
        widthCustom.focus();
      } else {
        widthCustom.style.display = 'none';
      }
    });

    // 提交
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitBtn');
      const loading = document.getElementById('loading');
      const resultSection = document.getElementById('resultSection');
      const errorMsg = document.getElementById('errorMsg');

      submitBtn.disabled = true;
      loading.classList.add('visible');
      resultSection.classList.remove('visible');
      errorMsg.classList.remove('visible');

      // AI 模式先保存配置
      if (currentMode === 'ai') {
        await saveAIConfig();
      }

      try {
        const formData = new FormData(form);

        // 处理 targetWidth: 下拉选择 或 自定义输入
        const selectedWidth = widthSelect.value;
        if (selectedWidth === 'custom') {
          const customVal = widthCustom.value;
          if (customVal) {
            formData.set('targetWidth', customVal);
          } else {
            formData.delete('targetWidth');
          }
        } else if (selectedWidth) {
          formData.set('targetWidth', selectedWidth);
        } else {
          formData.delete('targetWidth');
        }

        // 根据模式选择不同的 API
        const apiEndpoint = currentMode === 'ai' ? '/api/ai/compare' : '/api/compare';

        // AI 模式下，截图和 URL 至少各提供一个
        if (currentMode === 'ai') {
          const pageUrl = formData.get('pageUrl');
          const figmaUrl = formData.get('figmaUrl');
          if (!pageFile.files[0] && !pageUrl) {
            throw new Error('请提供线上页面 URL 或上传页面截图');
          }
          if (!figmaFile.files[0] && !figmaUrl) {
            throw new Error('请提供 Figma 链接或上传设计稿截图');
          }
        }

        const resp = await fetch(apiEndpoint, { method: 'POST', body: formData });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || '对比失败');
        }

        const scoreWrapper = document.getElementById('scoreWrapper');
        scoreWrapper.className = 'score-wrapper ' + (data.score >= 90 ? 'score-high' : data.score >= 70 ? 'score-mid' : 'score-low');
        document.getElementById('resultScore').textContent = data.score;
        document.getElementById('resultSummary').textContent = data.summary || ('共发现 ' + data.totalIssues + ' 个问题');

        const statsEl = document.getElementById('resultStats');
        statsEl.innerHTML = '';
        if (data.criticalCount) statsEl.innerHTML += '<span class="stat-chip critical"><span class="stat-dot"></span>严重 ' + data.criticalCount + '</span>';
        if (data.majorCount) statsEl.innerHTML += '<span class="stat-chip major"><span class="stat-dot"></span>主要 ' + data.majorCount + '</span>';
        if (data.minorCount) statsEl.innerHTML += '<span class="stat-chip minor"><span class="stat-dot"></span>次要 ' + data.minorCount + '</span>';
        if (data.suggestionCount) statsEl.innerHTML += '<span class="stat-chip suggestion"><span class="stat-dot"></span>建议 ' + data.suggestionCount + '</span>';

        if (data.reportUrl) {
          document.getElementById('reportLink').href = data.reportUrl;
          document.getElementById('reportLink').style.display = 'inline-flex';
          // 直接跳转到报告页面
          window.location.href = data.reportUrl;
        } else {
          document.getElementById('reportLink').style.display = 'none';
        }

        resultSection.classList.add('visible');
      } catch (err) {
        errorMsg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>' + err.message;
        errorMsg.classList.add('visible');
      } finally {
        submitBtn.disabled = false;
        loading.classList.remove('visible');
      }
    });
  </script>
</body>
</html>`;
}
