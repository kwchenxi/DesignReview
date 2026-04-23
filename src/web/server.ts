import { config } from 'dotenv';
config();

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { designReview } from '../index';

const app = express();
const PORT = 3456;

// 使用绝对路径
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// multer 配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
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
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-hover: #334155;
      --border: #334155;
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --critical: #ef4444;
      --major: #f97316;
      --minor: #eab308;
      --suggestion: #22c55e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 48px 24px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, var(--accent), #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 48px;
      font-size: 16px;
    }
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 640px) {
      .upload-grid { grid-template-columns: 1fr; }
    }
    .upload-card {
      background: var(--surface);
      border: 2px dashed var(--border);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      transition: border-color 0.3s, background 0.3s;
      cursor: pointer;
      position: relative;
    }
    .upload-card:hover, .upload-card.dragover {
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.05);
    }
    .upload-card.has-file {
      border-style: solid;
      border-color: var(--suggestion);
    }
    .upload-icon { font-size: 48px; margin-bottom: 12px; }
    .upload-card h3 { font-size: 18px; margin-bottom: 8px; }
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
      transition: border-color 0.2s;
    }
    .upload-card input[type="text"]:focus { border-color: var(--accent); }
    .file-name {
      margin-top: 8px;
      font-size: 13px;
      color: var(--suggestion);
      word-break: break-all;
    }
    .or-divider {
      color: var(--text-secondary);
      font-size: 12px;
      margin: 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .preview-img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
      margin-top: 12px;
      object-fit: contain;
      display: none;
    }
    .btn-select {
      padding: 8px 20px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-select:hover { background: var(--accent); border-color: var(--accent); }
    .btn-primary {
      display: block;
      width: 100%;
      padding: 16px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .result-section {
      margin-top: 48px;
      display: none;
    }
    .result-section.visible { display: block; }
    .result-header {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 32px;
      background: var(--surface);
      padding: 24px 32px;
      border-radius: 16px;
      border: 1px solid var(--border);
    }
    .score-big {
      font-size: 56px;
      font-weight: 800;
      min-width: 100px;
      text-align: center;
    }
    .result-meta h2 { font-size: 20px; margin-bottom: 4px; }
    .result-meta p { color: var(--text-secondary); font-size: 14px; }
    .stats-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .stat-chip {
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .stat-chip.critical { color: var(--critical); border-color: var(--critical); }
    .stat-chip.major { color: var(--major); border-color: var(--major); }
    .stat-chip.minor { color: var(--minor); border-color: var(--minor); }
    .stat-chip.suggestion { color: var(--suggestion); border-color: var(--suggestion); }
    .open-report-btn {
      display: inline-block;
      padding: 12px 24px;
      background: var(--accent);
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
    }
    .open-report-btn:hover { background: var(--accent-hover); }
    .loading {
      display: none;
      text-align: center;
      padding: 32px;
    }
    .loading.visible { display: block; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-msg {
      display: none;
      background: rgba(239,68,68,0.1);
      border: 1px solid var(--critical);
      border-radius: 12px;
      padding: 16px 24px;
      margin-top: 24px;
      color: var(--critical);
    }
    .error-msg.visible { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Design Review</h1>
    <p class="subtitle">上传设计稿和线上截图，自动对比生成还原度检查报告</p>

    <form id="compareForm" enctype="multipart/form-data">
      <div class="upload-grid">
        <div class="upload-card" id="pageCard">
          <div class="upload-icon">🌐</div>
          <h3>线上页面</h3>
          <p>提供 URL 或上传截图</p>
          <input type="text" name="pageUrl" placeholder="粘贴页面 URL..." />
          <div class="or-divider">— 或 —</div>
          <input type="file" id="pageFile" name="pageScreenshot" accept="image/*" />
          <button type="button" class="btn-select" onclick="document.getElementById('pageFile').click()">📁 选择截图</button>
          <div class="file-name" id="pageFileName"></div>
          <img class="preview-img" id="pagePreview" />
        </div>

        <div class="upload-card" id="figmaCard">
          <div class="upload-icon">🎨</div>
          <h3>Figma 设计稿</h3>
          <p>提供链接或上传截图</p>
          <input type="text" name="figmaUrl" placeholder="粘贴 Figma 链接..." />
          <div class="or-divider">— 或 —</div>
          <input type="file" id="figmaFile" name="figmaScreenshot" accept="image/*" />
          <button type="button" class="btn-select" onclick="document.getElementById('figmaFile').click()">📁 选择截图</button>
          <div class="file-name" id="figmaFileName"></div>
          <img class="preview-img" id="figmaPreview" />
        </div>
      </div>

      <button type="submit" class="btn-primary" id="submitBtn">🚀 开始检查</button>
    </form>

    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>正在对比分析中，请稍候...</p>
    </div>

    <div class="error-msg" id="errorMsg"></div>

    <div class="result-section" id="resultSection">
      <div class="result-header">
        <div class="score-big" id="resultScore">--</div>
        <div class="result-meta">
          <h2>还原度评分</h2>
          <p id="resultSummary"></p>
        </div>
      </div>
      <div class="stats-row" id="resultStats"></div>
      <a class="open-report-btn" id="reportLink" href="#" target="_blank">📄 查看完整报告</a>
    </div>
  </div>

  <script>
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
          nameEl.textContent = '✅ ' + file.name;
          card.classList.add('has-file');
          const reader = new FileReader();
          reader.onload = e => { previewEl.src = e.target.result; previewEl.style.display = 'block'; };
          reader.readAsDataURL(file);
        }
      });
    }
    setupPreview(pageFile, document.getElementById('pageFileName'), document.getElementById('pagePreview'), pageCard);
    setupPreview(figmaFile, document.getElementById('figmaFileName'), document.getElementById('figmaPreview'), figmaCard);

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

      try {
        const formData = new FormData(form);
        const resp = await fetch('/api/compare', { method: 'POST', body: formData });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || '对比失败');
        }

        const scoreColor = data.score >= 90 ? '#22c55e' : data.score >= 70 ? '#eab308' : '#ef4444';
        document.getElementById('resultScore').textContent = data.score;
        document.getElementById('resultScore').style.color = scoreColor;
        document.getElementById('resultSummary').textContent = '共发现 ' + data.totalIssues + ' 个问题';

        const statsEl = document.getElementById('resultStats');
        statsEl.innerHTML = '';
        if (data.criticalCount) statsEl.innerHTML += '<span class="stat-chip critical">🔴 严重 ' + data.criticalCount + '</span>';
        if (data.majorCount) statsEl.innerHTML += '<span class="stat-chip major">🟠 主要 ' + data.majorCount + '</span>';
        if (data.minorCount) statsEl.innerHTML += '<span class="stat-chip minor">🟡 次要 ' + data.minorCount + '</span>';
        if (data.suggestionCount) statsEl.innerHTML += '<span class="stat-chip suggestion">🟢 建议 ' + data.suggestionCount + '</span>';

        if (data.reportUrl) {
          document.getElementById('reportLink').href = data.reportUrl;
          document.getElementById('reportLink').style.display = 'inline-block';
        } else {
          document.getElementById('reportLink').style.display = 'none';
        }

        resultSection.classList.add('visible');
      } catch (err) {
        errorMsg.textContent = '❌ ' + err.message;
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
