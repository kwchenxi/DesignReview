// ============================================================
// 报告生成器 - Markdown + HTML (可视化交互版)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import {
  DiffResult,
  DesignReviewReport,
  ReportMeta,
  ModuleDiff,
  Issue,
  IssueLevel,
  OutputFormat,
} from '../types';

// ---- 生成报告元数据 ----

function buildMeta(
  pageUrl: string,
  figmaUrl: string,
  diffResult: DiffResult
): ReportMeta {
  // 判断是否为本地文件路径
  const isFile = (p: string) => p && !p.startsWith('http') && fs.existsSync(p);

  return {
    pageUrl,
    figmaUrl,
    pageScreenshot: isFile(pageUrl) ? pageUrl : undefined,
    figmaScreenshot: isFile(figmaUrl) ? figmaUrl : undefined,
    timestamp: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    overallScore: diffResult.overallScore,
    totalIssues: diffResult.totalIssues,
    criticalCount: diffResult.criticalCount,
    majorCount: diffResult.majorCount,
    minorCount: diffResult.minorCount,
    suggestionCount: diffResult.suggestionCount,
  };
}

// ---- 等级/类别 ----

const LEVEL_ICON: Record<IssueLevel, string> = {
  critical: '🔴', major: '🟠', minor: '🟡', suggestion: '🟢',
};

const LEVEL_LABEL: Record<IssueLevel, string> = {
  critical: '严重', major: '主要', minor: '次要', suggestion: '建议',
};

const CATEGORY_LABEL: Record<string, string> = {
  size: '尺寸', color: '颜色', font: '字体', spacing: '间距',
  radius: '圆角', shadow: '阴影', layout: '布局', state: '交互状态',
};

// ---- 人类可读的相似度描述 ----

function describeSimilarity(similarity: number): string {
  if (similarity >= 98) return '几乎完全一致，还原度非常高 ✨';
  if (similarity >= 95) return '整体还原度很高，存在少量细节差异';
  if (similarity >= 90) return '基本还原了设计稿，但有多处可见差异';
  if (similarity >= 80) return '与设计稿有明显差异，需要重点修复';
  if (similarity >= 60) return '与设计稿差异较大，需要较大改动';
  return '与设计稿差异很大，建议重新对照设计稿开发';
}

function describeScore(score: number): string {
  if (score >= 95) return '优秀';
  if (score >= 85) return '良好';
  if (score >= 70) return '一般';
  if (score >= 50) return '较差';
  return '需重做';
}

// ============================================================
// HTML 报告 (可视化交互版)
// ============================================================

function generateHtml(meta: ReportMeta, modules: ModuleDiff[], pixelDiff: DiffResult['pixelDiff'], outputDir = './output'): string {
  const scoreColor = meta.overallScore >= 90 ? '#22c55e' : meta.overallScore >= 70 ? '#f59e0b' : '#ef4444';
  const scoreDesc = describeScore(meta.overallScore);
  const similarityDesc = pixelDiff.similarity > 0 ? describeSimilarity(pixelDiff.similarity) : '';

  // 把截图图片转为 base64 内嵌 (确保报告自包含)
  // 优先从 outputDir 直接查找，再从 diffImagePath 推导，最后尝试 meta 中的路径
  const diffDir = pixelDiff.diffImagePath ? path.dirname(pixelDiff.diffImagePath) : '';
  const figmaScreenshotB64 = (diffDir && imagePathToBase64(path.join(diffDir, 'figma-screenshot.png')))
    || imagePathToBase64(path.join(outputDir, 'figma-screenshot.png'))
    || imagePathToBase64(path.join(outputDir, 'figma-rendered.png'))
    || imagePathToBase64(meta.figmaScreenshot || '')
    || imagePathToBase64(meta.figmaUrl);
  const pageScreenshotB64 = (diffDir && imagePathToBase64(findPageScreenshot(pixelDiff.diffImagePath)))
    || imagePathToBase64(path.join(outputDir, 'page-full.png'))
    || imagePathToBase64(meta.pageScreenshot || '')
    || imagePathToBase64(meta.pageUrl);
  const diffImageB64 = imagePathToBase64(pixelDiff.diffImagePath);

  const moduleCards = modules.map((mod, idx) => {
    const issueRows = mod.issues.map(issue => {
      // 使用增强字段或回退到基本字段
      const title = issue.title || issue.property;
      const location = issue.location || mod.name || '未知位置';
      const observed = issue.observed || issue.actual;
      const impact = issue.impact || '';
      const recommendation = issue.recommendation || issue.suggestion;
      
      // 是否显示详细信息（如果有impact或详细描述）
      const hasDetails = impact || (issue.observed && issue.observed !== issue.actual) || issue.specReference;
      const detailsId = `details-${mod.name.replace(/\s+/g, '-')}-${idx}-${issue.id}`;

      return `
      <tr class="issue-row ${issue.level}" ${hasDetails ? `onclick="toggleDetails('${detailsId}')" style="cursor: pointer;"` : ''}>
        <td><span class="level-badge ${issue.level}">${LEVEL_ICON[issue.level]} ${LEVEL_LABEL[issue.level]}</span></td>
        <td class="issue-title">${title}</td>
        <td class="issue-location">${location}</td>
        <td>${CATEGORY_LABEL[issue.category] || issue.category}</td>
        <td class="expected">${issue.expected}</td>
        <td class="actual">${observed}</td>
        <td class="suggestion">${recommendation}</td>
      </tr>
      ${hasDetails ? `
      <tr class="issue-details-row" id="${detailsId}" style="display: none;">
        <td colspan="7">
          <div class="issue-details">
            ${issue.specReference ? `<div class="detail-item spec-ref"><strong>规范引用:</strong> ${issue.specReference}</div>` : ''}
            ${impact ? `<div class="detail-item"><strong>影响分析:</strong> ${impact}</div>` : ''}
            ${issue.observed && issue.observed !== issue.actual ? `<div class="detail-item"><strong>观察描述:</strong> ${issue.observed}</div>` : ''}
            ${issue.recommendation && issue.recommendation !== issue.suggestion ? `<div class="detail-item"><strong>详细建议:</strong> ${issue.recommendation}</div>` : ''}
            ${issue.confidence ? `<div class="detail-item"><strong>检测置信度:</strong> ${issue.confidence}%</div>` : ''}
            ${issue.severity ? `<div class="detail-item"><strong>优先级:</strong> ${issue.severity}</div>` : ''}
          </div>
        </td>
      </tr>
      ` : ''}
    `;
    }).join('');

    return `
      <div class="module-card" id="module-${idx}">
        <div class="module-header">
          <h3>${mod.name}</h3>
          <span class="module-score" style="color: ${mod.score >= 90 ? '#22c55e' : mod.score >= 70 ? '#f59e0b' : '#ef4444'}">${mod.score}分</span>
        </div>
        <table class="issue-table">
          <thead>
            <tr>
              <th>等级</th>
              <th>问题标题</th>
              <th>位置</th>
              <th>类别</th>
              <th>设计稿</th>
              <th>实现</th>
              <th>修复建议</th>
            </tr>
          </thead>
          <tbody>${issueRows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设计还原度检查报告</title>
  <style>
    :root {
      --bg: #E8ECF0;
      --surface: rgba(255,255,255,.45);
      --surface-hover: rgba(255,255,255,.58);
      --border: rgba(255,255,255,.7);
      --text: #1a1a2e;
      --text-secondary: #5a6478;
      --accent: #0C7FFC;
      --critical: #E54D4D;
      --major: #E88A3A;
      --minor: #C9A020;
      --suggestion: #4DB87A;
      --glass-blur: blur(32px) saturate(1.4);
      --glass-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 4px 24px rgba(0,0,0,.06);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: #E8ECF0;
      background-image:
        radial-gradient(ellipse 80% 60% at 20% 30%, rgba(12,127,252,.15) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 70%, rgba(12,127,252,.08) 0%, transparent 60%);
      background-attachment: fixed;
      color: var(--text);
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

    /* 报告头 */
    .report-header {
      display: flex;
      align-items: center;
      gap: 32px;
      margin-bottom: 40px;
      background: var(--surface);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      padding: 32px;
      border-radius: 28px;
      border: 1px solid var(--border);
      box-shadow: var(--glass-shadow);
    }
    .score-ring {
      width: 110px; height: 110px;
      border-radius: 50%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-size: 42px; font-weight: 800;
      color: ${scoreColor};
      border: 4px solid ${scoreColor};
      flex-shrink: 0;
      background: rgba(255,255,255,.3);
      backdrop-filter: blur(16px);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
    }
    .score-ring .score-label { font-size: 14px; font-weight: 400; color: var(--text-secondary); }
    .meta-info h1 { font-size: 24px; margin-bottom: 4px; }
    .meta-info p { color: var(--text-secondary); font-size: 14px; }
    .meta-info a { color: var(--accent); }
    .score-desc {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(12,127,252,.1);
      color: var(--accent);
      border: 1px solid rgba(12,127,252,.2);
    }

    /* 统计卡片 */
    .stats-row { display: flex; gap: 12px; margin-bottom: 32px; }
    .stat-card {
      flex: 1;
      background: var(--surface);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-radius: 20px;
      padding: 16px 20px;
      border: 1px solid var(--border);
      text-align: center;
      box-shadow: var(--glass-shadow);
    }
    .stat-card .stat-value { font-size: 28px; font-weight: 700; }
    .stat-card .stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
    .stat-card.critical .stat-value { color: var(--critical); }
    .stat-card.major .stat-value { color: var(--major); }
    .stat-card.minor .stat-value { color: var(--minor); }
    .stat-card.suggestion .stat-value { color: var(--suggestion); }

    /* ============ 可视化对比区 ============ */
    .visual-section {
      background: var(--surface);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-radius: 28px;
      padding: 24px;
      margin-bottom: 32px;
      border: 1px solid var(--border);
      box-shadow: var(--glass-shadow);
    }
    .visual-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .visual-header h2 { font-size: 20px; }
    .similarity-badge {
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      background: rgba(12,127,252,.1);
      color: var(--accent);
      border: 1px solid rgba(12,127,252,.2);
    }
    .similarity-desc {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 20px;
    }

    /* 视图切换 */
    .view-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      background: rgba(255,255,255,.3);
      border-radius: 14px;
      padding: 4px;
    }
    .view-tab {
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      transition: all 0.2s;
    }
    .view-tab.active {
      background: #0C7FFC;
      color: white;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 2px 8px rgba(12,127,252,.25);
    }
    .view-tab:hover:not(.active) {
      background: rgba(255,255,255,.4);
      color: var(--text);
    }

    /* 对比容器 */
    .compare-container {
      position: relative;
      width: 100%;
      border-radius: 18px;
      overflow: hidden;
      background: rgba(200,210,220,.3);
      margin-bottom: 16px;
    }

    /* 滑动对比 */
    .compare-slider {
      position: relative;
      width: 100%;
      overflow: hidden;
      cursor: col-resize;
    }
    .compare-slider img {
      display: block;
      width: 100%;
      height: auto;
      user-select: none;
      -webkit-user-drag: none;
    }
    .compare-slider .img-top {
      position: absolute;
      top: 0; left: 0;
      clip-path: inset(0 50% 0 0);
    }
    .compare-slider .slider-line {
      position: absolute;
      top: 0;
      left: 50%;
      width: 3px;
      height: 100%;
      background: white;
      transform: translateX(-50%);
      z-index: 10;
      pointer-events: none;
    }
    .compare-slider .slider-handle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px; height: 40px;
      border-radius: 50%;
      background: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      z-index: 11;
      box-shadow: 0 2px 12px rgba(0,0,0,.15);
      pointer-events: none;
    }
    .compare-slider .label-left,
    .compare-slider .label-right {
      position: absolute;
      top: 12px;
      padding: 4px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      z-index: 5;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }
    .compare-slider .label-left { left: 12px; background: rgba(12,127,252,.7); color: white; }
    .compare-slider .label-right { right: 12px; background: rgba(229,77,77,.7); color: white; }

    /* 并排对比 */
    .compare-side {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .compare-side.active { display: grid; }
    .compare-side .side-item { text-align: center; }
    .compare-side .side-item img { width: 100%; border-radius: 14px; }
    .compare-side .side-label {
      margin-top: 8px;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 10px;
      display: inline-block;
    }

    /* 差异高亮 */
    .compare-diff {
      display: none;
    }
    .compare-diff.active { display: block; }
    .compare-diff img {
      width: 100%;
      border-radius: 14px;
    }

    /* ============ 问题清单 ============ */
    .issues-section h2 { margin-bottom: 16px; }
    .module-card {
      background: var(--surface);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      box-shadow: var(--glass-shadow);
    }
    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .module-header h3 { font-size: 18px; }
    .module-score { font-size: 24px; font-weight: 700; }
    .issue-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .issue-table th {
      text-align: left;
      padding: 10px 12px;
      background: rgba(200,210,220,.25);
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 12px;
      border-radius: 8px;
    }
    .issue-table td {
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,.4);
    }
    .issue-row.critical { border-left: 3px solid var(--critical); }
    .issue-row.major { border-left: 3px solid var(--major); }
    .issue-row.minor { border-left: 3px solid var(--minor); }
    .issue-row.suggestion { border-left: 3px solid var(--suggestion); }
    .level-badge { font-weight: 500; }
    .level-badge.critical { color: var(--critical); }
    .level-badge.major { color: var(--major); }
    .level-badge.minor { color: var(--minor); }
    .level-badge.suggestion { color: var(--suggestion); }
    td.expected { color: var(--suggestion); }
    td.actual { color: var(--critical); }
    td.suggestion { color: var(--text-secondary); }

    .issue-title { font-weight: 600; }
    .issue-location { font-size: 12px; color: var(--text-secondary); }
    .issue-details-row { background: rgba(200,210,220,.15); }
    .issue-details {
      padding: 12px;
      background: rgba(255,255,255,.3);
      border-radius: 12px;
      margin: 8px 0;
      border-left: 3px solid var(--border);
      backdrop-filter: blur(8px);
    }
    .issue-details .detail-item {
      margin-bottom: 8px;
      font-size: 12px;
      line-height: 1.5;
    }
    .issue-details .detail-item strong {
      color: var(--text-secondary);
      margin-right: 8px;
      display: inline-block;
      min-width: 80px;
    }
    .issue-details .detail-item.spec-ref {
      background: rgba(12,127,252,.08);
      border-radius: 8px;
      padding: 8px 12px;
      border-left: 3px solid var(--accent);
      color: var(--accent);
    }
    .issue-details .detail-item.spec-ref strong {
      color: var(--accent);
    }

    @media (max-width: 768px) {
      .report-header { flex-direction: column; text-align: center; }
      .stats-row { flex-wrap: wrap; }
      .stat-card { min-width: 140px; }
      .compare-side { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 报告头 -->
    <header class="report-header">
      <div class="score-ring">
        ${meta.overallScore}
        <span class="score-label">分</span>
      </div>
      <div class="meta-info">
        <h1>设计还原度检查报告</h1>
        <p>生成时间: ${meta.timestamp}</p>
        ${meta.pageUrl ? `<p>页面: <a href="${meta.pageUrl}" target="_blank" style="color: var(--accent);">${meta.pageUrl}</a></p>` : ''}
        <span class="score-desc">${scoreDesc}</span>
      </div>
    </header>

    <!-- 统计 -->
    <div class="stats-row">
      <div class="stat-card critical">
        <div class="stat-value">${meta.criticalCount}</div>
        <div class="stat-label">🔴 严重</div>
      </div>
      <div class="stat-card major">
        <div class="stat-value">${meta.majorCount}</div>
        <div class="stat-label">🟠 主要</div>
      </div>
      <div class="stat-card minor">
        <div class="stat-value">${meta.minorCount}</div>
        <div class="stat-label">🟡 次要</div>
      </div>
      <div class="stat-card suggestion">
        <div class="stat-value">${meta.suggestionCount}</div>
        <div class="stat-label">🟢 建议</div>
      </div>
    </div>

    <!-- 可视化对比 -->
    ${pixelDiff.similarity > 0 ? `
    <section class="visual-section">
      <div class="visual-header">
        <h2>🖼️ 视觉对比</h2>
        <span class="similarity-badge">相似度 ${pixelDiff.similarity}%</span>
      </div>
      <p class="similarity-desc">${similarityDesc}</p>

      <div class="view-tabs">
        <button class="view-tab active" onclick="switchView('slider')">滑动对比</button>
        <button class="view-tab" onclick="switchView('side')">并排对比</button>
        <button class="view-tab" onclick="switchView('diff')">差异高亮</button>
      </div>

      <!-- 滑动对比 -->
      <div class="compare-container">
        <div class="compare-slider" id="sliderView">
          <img src="${figmaScreenshotB64 || ''}" alt="设计稿" />
          <img class="img-top" src="${pageScreenshotB64 || figmaScreenshotB64 || ''}" alt="线上页面" />
          <div class="slider-line"></div>
          <div class="slider-handle">⇔</div>
          <span class="label-left">线上页面</span>
          <span class="label-right">设计稿</span>
        </div>
      </div>

      <!-- 并排对比 -->
      <div class="compare-side" id="sideView">
        <div class="side-item">
          <img src="${pageScreenshotB64 || figmaScreenshotB64 || ''}" alt="线上页面" />
          <div class="side-label" style="background: rgba(239,68,68,0.2); color: var(--critical);">线上页面</div>
        </div>
        <div class="side-item">
          <img src="${figmaScreenshotB64 || ''}" alt="设计稿" />
          <div class="side-label" style="background: rgba(99,102,241,0.2); color: var(--accent);">设计稿</div>
        </div>
      </div>

      <!-- 差异高亮 -->
      <div class="compare-diff" id="diffView">
        ${diffImageB64 ? `<img src="${diffImageB64}" alt="差异高亮图" />` : '<p style="color: var(--text-secondary);">差异高亮图不可用</p>'}
        <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">🔴 红色区域 = 与设计稿不一致的位置</p>
      </div>
    </section>
    ` : ''}

    <!-- 问题清单 -->
    <section class="issues-section">
      <h2>📋 问题清单</h2>
      ${moduleCards || '<p style="color: var(--suggestion); margin-top: 16px;">🎉 未发现问题，还原度很高！</p>'}
    </section>
  </div>

  <script>
    // 视图切换
    function switchView(mode) {
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');

      document.getElementById('sliderView').parentElement.style.display = mode === 'slider' ? '' : 'none';
      document.getElementById('sideView').className = 'compare-side' + (mode === 'side' ? ' active' : '');
      document.getElementById('diffView').className = 'compare-diff' + (mode === 'diff' ? ' active' : '');
    }

    // 滑动对比交互
    const slider = document.querySelector('.compare-slider');
    if (slider) {
      const imgTop = slider.querySelector('.img-top');
      const sliderLine = slider.querySelector('.slider-line');
      const sliderHandle = slider.querySelector('.slider-handle');
      let isDragging = false;

      function updateSlider(x) {
        const rect = slider.getBoundingClientRect();
        let pos = ((x - rect.left) / rect.width) * 100;
        pos = Math.max(0, Math.min(100, pos));
        imgTop.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
        sliderLine.style.left = pos + '%';
        sliderHandle.style.left = pos + '%';
      }

      slider.addEventListener('mousedown', (e) => { isDragging = true; updateSlider(e.clientX); });
      slider.addEventListener('mousemove', (e) => { if (isDragging) updateSlider(e.clientX); });
      slider.addEventListener('mouseup', () => { isDragging = false; });
      slider.addEventListener('mouseleave', () => { isDragging = false; });

      slider.addEventListener('touchstart', (e) => { isDragging = true; updateSlider(e.touches[0].clientX); });
      slider.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientX); } });
      slider.addEventListener('touchend', () => { isDragging = false; });
    }
  </script>
</body>
</html>`;
}

// ---- 图片转 base64 ----

function imagePathToBase64(imagePath: string): string {
  if (!imagePath || !fs.existsSync(imagePath)) return '';
  try {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    const data = fs.readFileSync(imagePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return '';
  }
}

function findPageScreenshot(diffImagePath: string): string {
  const dir = path.dirname(diffImagePath);
  const candidates = ['page-full.png', 'page-viewport.png'];
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return '';
}

// ============================================================
// Markdown 报告
// ============================================================

function generateMarkdown(meta: ReportMeta, modules: ModuleDiff[], pixelDiff: DiffResult['pixelDiff']): string {
  const lines: string[] = [];

  lines.push('# 设计还原度检查报告');
  lines.push('');
  lines.push(`> 生成时间: ${meta.timestamp}`);
  lines.push(`> 还原度评分: **${meta.overallScore} / 100** (${describeScore(meta.overallScore)})`);
  lines.push('');

  // 摘要
  lines.push('## 📊 总体概览');
  lines.push('');
  lines.push(`| 指标 | 值 |`);
  lines.push(`|------|------|`);
  lines.push(`| 页面 | ${meta.pageUrl || '-'} |`);
  lines.push(`| 设计稿 | ${meta.figmaUrl || '-'} |`);
  lines.push(`| 问题总数 | ${meta.totalIssues} |`);
  lines.push(`| 🔴 严重 | ${meta.criticalCount} |`);
  lines.push(`| 🟠 主要 | ${meta.majorCount} |`);
  lines.push(`| 🟡 次要 | ${meta.minorCount} |`);
  lines.push(`| 🟢 建议 | ${meta.suggestionCount} |`);
  lines.push('');

  if (pixelDiff.similarity > 0) {
    lines.push('## 🖼️ 视觉对比');
    lines.push('');
    lines.push(`- 像素相似度: **${pixelDiff.similarity}%** — ${describeSimilarity(pixelDiff.similarity)}`);
    lines.push('');
  }

  // 问题清单
  lines.push('## 📋 问题清单');
  lines.push('');

  for (const mod of modules) {
    lines.push(`### ${mod.name} (${mod.score}分)`);
    lines.push('');

    lines.push('| 等级 | 类别 | 属性 | 设计稿 | 线上 | 修复建议 | 规范引用 |');
    lines.push('|------|------|------|--------|------|----------|----------|');

    for (const issue of mod.issues) {
      lines.push(
        `| ${LEVEL_ICON[issue.level]} ${LEVEL_LABEL[issue.level]} ` +
        `| ${CATEGORY_LABEL[issue.category] || issue.category} ` +
        `| ${issue.property} ` +
        `| ${issue.expected} ` +
        `| ${issue.actual} ` +
        `| ${issue.suggestion} ` +
        `| ${issue.specReference || '-'} |`
      );
    }
    lines.push('');
  }

  // 修复建议汇总
  lines.push('## 💡 修复建议');
  lines.push('');
  const allIssues = modules.flatMap(m => m.issues);
  const critical = allIssues.filter(i => i.level === 'critical');
  const major = allIssues.filter(i => i.level === 'major');

  if (critical.length > 0) {
    lines.push('### 🔴 必须修复');
    for (const i of critical) lines.push(`- ${i.suggestion}`);
    lines.push('');
  }
  if (major.length > 0) {
    lines.push('### 🟠 建议修复');
    for (const i of major.slice(0, 10)) lines.push(`- ${i.suggestion}`);
    if (major.length > 10) lines.push(`- ... 还有 ${major.length - 10} 条`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 报告生成器主类
// ============================================================

export class ReportGenerator {
  static generate(
    diffResult: DiffResult,
    pageUrl: string,
    figmaUrl: string,
    formats: OutputFormat[] = ['html', 'markdown'],
    outputDir = './output'
  ): DesignReviewReport {
    fs.mkdirSync(outputDir, { recursive: true });

    const meta = buildMeta(pageUrl, figmaUrl, diffResult);
    const { propertyDiffs: modules, pixelDiff } = diffResult;
    const outputFiles: string[] = [];

    if (formats.includes('markdown')) {
      const md = generateMarkdown(meta, modules, pixelDiff);
      const mdPath = path.join(outputDir, 'design-review-report.md');
      fs.writeFileSync(mdPath, md, 'utf-8');
      outputFiles.push(mdPath);
      console.log(`📝 Markdown 报告: ${mdPath}`);
    }

    if (formats.includes('html')) {
      const html = generateHtml(meta, modules, pixelDiff, outputDir);
      const htmlPath = path.join(outputDir, 'design-review-report.html');
      fs.writeFileSync(htmlPath, html, 'utf-8');
      outputFiles.push(htmlPath);
      console.log(`🌐 HTML 报告: ${htmlPath}`);
    }

    if (formats.includes('csv')) {
      const csvLines: string[] = ['模块,等级,类别,属性,设计稿,线上,修复建议'];
      for (const mod of modules) {
        for (const issue of mod.issues) {
          csvLines.push(
            `"${mod.name}","${LEVEL_LABEL[issue.level]}","${CATEGORY_LABEL[issue.category] || issue.category}","${issue.property}","${issue.expected}","${issue.actual}","${issue.suggestion}"`
          );
        }
      }
      const csvPath = path.join(outputDir, 'design-review-report.csv');
      fs.writeFileSync(csvPath, '\uFEFF' + csvLines.join('\n'), 'utf-8');
      outputFiles.push(csvPath);
      console.log(`📊 CSV 报告: ${csvPath}`);
    }

    return { meta, modules, visualDiff: pixelDiff, outputFiles };
  }
}
