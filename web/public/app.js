// ============================================================
// Design Review Public - 前端逻辑（Vercel 版）
// ============================================================

let currentMode = 'ai';
let lastReportHtml = '';

// 模式切换
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('aiSettings').classList.toggle('visible', mode === 'ai');
}

// AI 设置折叠
let aiSettingsExpanded = false;
function toggleAISettings() {
  aiSettingsExpanded = !aiSettingsExpanded;
  document.getElementById('aiFieldsBody').style.display = aiSettingsExpanded ? 'block' : 'none';
  document.getElementById('aiToggleArrow').textContent = aiSettingsExpanded ? '▼' : '▶';
}

// 检查 AI 状态
async function checkAIStatus() {
  try {
    const resp = await fetch('/api/ai/status');
    const data = await resp.json();
    const statusEl = document.getElementById('aiStatus');
    const statusText = document.getElementById('aiStatusText');
    if (data.configured) {
      statusEl.className = 'ai-status ok';
      statusText.textContent = '已配置 (' + data.model + ')';
      aiSettingsExpanded = false;
      document.getElementById('aiFieldsBody').style.display = 'none';
      document.getElementById('aiToggleArrow').textContent = '▶';
    } else {
      statusEl.className = 'ai-status no';
      statusText.textContent = '未配置';
      aiSettingsExpanded = true;
      document.getElementById('aiFieldsBody').style.display = 'block';
      document.getElementById('aiToggleArrow').textContent = '▼';
    }
  } catch {
    document.getElementById('aiStatusText').textContent = '检测失败';
  }
}

// 保存 AI 配置
async function saveAIConfig() {
  const apiKey = document.getElementById('aiApiKey').value.trim();
  const apiBase = document.getElementById('aiApiBase').value.trim();
  const model = document.getElementById('aiModel').value;
  if (!apiKey) return;
  const provider = model.startsWith('claude') ? 'claude' : 'openai';
  try {
    await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, apiBase, model, provider }),
    });
    await checkAIStatus();
  } catch {}
}

// 选择模型时自动切换 API Base
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

// 初始化
checkAIStatus();
switchMode(currentMode);

// 文件拖拽与预览
const pageCard = document.getElementById('pageCard');
const figmaCard = document.getElementById('figmaCard');
const pageFile = document.getElementById('pageFile');
const figmaFile = document.getElementById('figmaFile');

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

// 提交
const form = document.getElementById('compareForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');
  const resultSection = document.getElementById('resultSection');
  const errorMsg = document.getElementById('errorMsg');
  const reportContainer = document.getElementById('reportFrameContainer');

  // 校验
  if (!pageFile.files[0]) {
    showError('请上传线上页面截图');
    return;
  }
  if (!figmaFile.files[0]) {
    showError('请上传设计稿截图');
    return;
  }

  submitBtn.disabled = true;
  loading.classList.add('visible');
  resultSection.classList.remove('visible');
  errorMsg.classList.remove('visible');
  reportContainer.style.display = 'none';

  if (currentMode === 'ai') {
    await saveAIConfig();
  }

  try {
    const formData = new FormData();
    formData.append('pageScreenshot', pageFile.files[0]);
    formData.append('figmaScreenshot', figmaFile.files[0]);

    const apiEndpoint = currentMode === 'ai' ? '/api/ai/compare' : '/api/compare';

    const resp = await fetch(apiEndpoint, { method: 'POST', body: formData });
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || '对比失败');
    }

    // 显示分数
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

    // 保存报告 HTML
    if (data.reportHtml) {
      lastReportHtml = atob(data.reportHtml);
    }

    resultSection.classList.add('visible');
    resultSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    loading.classList.remove('visible');
  }
});

// 显示报告
function showReport() {
  if (!lastReportHtml) {
    alert('报告内容为空');
    return;
  }
  const container = document.getElementById('reportFrameContainer');
  const frame = document.getElementById('reportFrame');
  frame.srcdoc = lastReportHtml;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

// 关闭报告
function closeReport() {
  document.getElementById('reportFrameContainer').style.display = 'none';
}

// 重置
function resetForm() {
  form.reset();
  document.getElementById('pageFileName').textContent = '';
  document.getElementById('figmaFileName').textContent = '';
  document.getElementById('pagePreview').style.display = 'none';
  document.getElementById('figmaPreview').style.display = 'none';
  pageCard.classList.remove('has-file');
  figmaCard.classList.remove('has-file');
  document.getElementById('resultSection').classList.remove('visible');
  document.getElementById('reportFrameContainer').style.display = 'none';
  document.getElementById('errorMsg').classList.remove('visible');
  lastReportHtml = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 显示错误
function showError(msg) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}
