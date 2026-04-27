// ============================================================
// AI 视觉分析器 - 使用 AI API 进行设计对比分析
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { Issue, IssueLevel, IssueCategory, ModuleDiff, PixelDiffResult } from '../types';
import { pixelDiff } from './engine';

// ============================================================
// 类型定义
// ============================================================

export interface AIAnalyzerConfig {
  /** API Provider: openai (兼容 OpenAI 格式) | claude (Anthropic 原生格式) */
  provider: 'openai' | 'claude';
  /** API Key */
  apiKey: string;
  /** API Base URL (自定义端点, 如 DeepSeek: https://api.deepseek.com) */
  apiBase: string;
  /** 模型名称 */
  model: string;
  /** 最大 token */
  maxTokens: number;
}

export interface AIAnalysisResult {
  issues: Issue[];
  overallScore: number;
  summary: string;
  rawResponse: string;
}

// ============================================================
// 默认配置
// ============================================================

// 根据 model 名自动推断 provider
function inferProvider(model: string): 'openai' | 'claude' {
  if (model.startsWith('claude')) return 'claude';
  return 'openai';
}

const envModel = process.env.AI_MODEL || 'gpt-4o';
const envProvider = (process.env.AI_PROVIDER as 'openai' | 'claude') || inferProvider(envModel);

export const DEFAULT_AI_CONFIG: AIAnalyzerConfig = {
  provider: envProvider,
  apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  apiBase: process.env.AI_API_BASE || (envProvider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'),
  model: envModel,
  maxTokens: 4096,
};

// ============================================================
// AI 分析器
// ============================================================

export class AIAnalyzer {
  private config: AIAnalyzerConfig;

  constructor(config?: Partial<AIAnalyzerConfig>) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  get isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 分析两张截图的差异
   */
  async analyze(
    figmaScreenshotPath: string,
    pageScreenshotPath: string,
    outputDir: string
  ): Promise<AIAnalysisResult> {
    if (!this.isConfigured) {
      throw new Error('AI API Key 未配置。请在 .env 文件中设置 AI_API_KEY，或在设置面板中输入。');
    }

    // Step 1: 先做像素对比获取基础数据
    const diffImagePath = path.join(outputDir, 'visual-diff.png');
    let pixelResult: PixelDiffResult | null = null;
    try {
      pixelResult = await pixelDiff(figmaScreenshotPath, pageScreenshotPath, diffImagePath);
    } catch {
      // 像素对比失败不影响 AI 分析
    }

    // Step 2: 将图片转为 base64
    const figmaBase64 = this.imageToBase64(figmaScreenshotPath);
    const pageBase64 = this.imageToBase64(pageScreenshotPath);

    // Step 3: 调用 AI API
    const prompt = this.buildPrompt(pixelResult);
    const rawResponse = await this.callAIAPI(prompt, figmaBase64, pageBase64);

    // Step 4: 解析 AI 响应为结构化问题
    const { issues, overallScore, summary } = this.parseAIResponse(rawResponse, pixelResult);

    return { issues, overallScore, summary, rawResponse };
  }

  /**
   * 将图片文件转为 base64
   */
  private imageToBase64(imagePath: string): string {
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  }

  /**
   * 构建 AI Prompt
   */
  private buildPrompt(pixelResult: PixelDiffResult | null): string {
    const similarityInfo = pixelResult
      ? `像素级相似度: ${pixelResult.similarity}%`
      : '像素级相似度: 未计算';

    return `你是一位专业的设计审查专家。请对比以下两张截图：

1. 第一张图是**设计稿**（Figma 设计）
2. 第二张图是**实现页面**（线上实际截图）

参考信息: ${similarityInfo}

请仔细对比两张图，找出所有视觉差异，并按照以下 JSON 格式输出（不要输出其他内容，只输出 JSON）：

{
  "overallScore": <0-100 的还原度评分>,
  "summary": "<一句话总结>",
  "issues": [
    {
      "title": "<问题标题，如'导航栏布局错位'>",
      "severity": "<CRITICAL | HIGH | MEDIUM | LOW>",
      "location": "<问题位置，如'页面头部导航栏'>",
      "category": "<LAYOUT | VISUAL | SPACING | TYPOGRAPHY | COLOR | INTERACTION>",
      "observed": "<观察到的实现状态，如'按钮背景色为#0078D4'>",
      "expected": "<设计稿期望状态，如'设计指定品牌蓝色为#0A66C2'>",
      "impact": "<问题影响分析>",
      "recommendation": "<修复建议>"
    }
  ]
}

审查要点：
- 布局对齐：元素位置、间距是否与设计稿一致
- 颜色匹配：品牌色、文字色、背景色是否准确（尽量给出具体色值）
- 字体排版：字号、字重、行高是否匹配
- 间距留白：内边距、外边距、元素间距是否一致
- 组件样式：按钮、图标、卡片等组件的圆角、阴影、边框是否匹配
- 内容完整性：是否有缺失或多余的元素

注意：
- 只报告确实存在的差异，不要猜测
- severity 的判定标准: CRITICAL=功能不可用/关键内容缺失, HIGH=明显视觉差异/品牌偏差, MEDIUM=可察觉但影响较小, LOW=细微优化建议
- 尽量给出具体的色值、尺寸等量化信息
- 请确保输出合法的 JSON`;
  }

  /**
   * 调用 AI API (自动根据 provider 选择格式)
   */
  private async callAIAPI(prompt: string, figmaBase64: string, pageBase64: string): Promise<string> {
    if (this.config.provider === 'claude') {
      return this.callClaudeAPI(prompt, figmaBase64, pageBase64);
    }
    return this.callOpenAIAPI(prompt, figmaBase64, pageBase64);
  }

  /**
   * 调用 OpenAI 兼容 API
   */
  private async callOpenAIAPI(prompt: string, figmaBase64: string, pageBase64: string): Promise<string> {
    const url = `${this.config.apiBase.replace(/\/$/, '')}/chat/completions`;

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: figmaBase64, detail: 'high' },
            },
            {
              type: 'image_url',
              image_url: { url: pageBase64, detail: 'high' },
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 调用 Claude (Anthropic) API
   */
  private async callClaudeAPI(prompt: string, figmaBase64: string, pageBase64: string): Promise<string> {
    const url = `${this.config.apiBase.replace(/\/$/, '')}/v1/messages`;

    // Claude API 要求 base64 图片不带 data URI 前缀
    const figmaData = figmaBase64.replace(/^data:[^;]+;base64,/, '');
    const pageData = pageBase64.replace(/^data:[^;]+;base64,/, '');

    // 获取 media type
    const getMediaType = (dataUri: string): string => {
      const match = dataUri.match(/^data:([^;]+);/);
      return match ? match[1] : 'image/png';
    };

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: getMediaType(figmaBase64),
                data: figmaData,
              },
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: getMediaType(pageBase64),
                data: pageData,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    // Claude 返回格式: { content: [{ type: 'text', text: '...' }] }
    const textBlock = data.content?.find((block: any) => block.type === 'text');
    return textBlock?.text || '';
  }

  /**
   * 解析 AI 响应为结构化数据
   */
  private parseAIResponse(rawResponse: string, pixelResult: PixelDiffResult | null): {
    issues: Issue[];
    overallScore: number;
    summary: string;
  } {
    let parsed: any;

    // 尝试从响应中提取 JSON
    try {
      // 先尝试直接解析
      parsed = JSON.parse(rawResponse);
    } catch {
      // 尝试提取 ```json ... ``` 代码块
      const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          // 尝试提取第一个 { 到最后一个 }
          const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            parsed = JSON.parse(braceMatch[0]);
          }
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.issues)) {
      // 解析失败，返回空结果
      return {
        issues: [],
        overallScore: pixelResult ? Math.round(pixelResult.similarity) : 0,
        summary: 'AI 响应解析失败，请查看原始输出',
      };
    }

    // 映射 severity -> IssueLevel
    const severityMap: Record<string, IssueLevel> = {
      CRITICAL: 'critical',
      HIGH: 'major',
      MEDIUM: 'minor',
      LOW: 'suggestion',
    };

    // 映射 category
    const categoryMap: Record<string, IssueCategory> = {
      LAYOUT: 'layout',
      VISUAL: 'color',
      SPACING: 'spacing',
      TYPOGRAPHY: 'font',
      COLOR: 'color',
      INTERACTION: 'state',
    };

    const issues: Issue[] = parsed.issues.map((item: any, index: number) => {
      const level = severityMap[item.severity] || 'minor';
      const category = categoryMap[item.category] || 'layout';

      return {
        id: `ai-issue-${index + 1}`,
        level,
        category,
        property: item.title || '视觉差异',
        expected: item.expected || '',
        actual: item.observed || '',
        deviation: '',
        suggestion: item.recommendation || '',
        // 增强字段
        title: item.title,
        location: item.location,
        observed: item.observed,
        impact: item.impact,
        recommendation: item.recommendation,
        severity: item.severity,
        confidence: 85,
      };
    });

    const overallScore = typeof parsed.overallScore === 'number'
      ? Math.max(0, Math.min(100, parsed.overallScore))
      : (pixelResult ? Math.round(pixelResult.similarity) : 0);

    const summary = parsed.summary || `AI 发现 ${issues.length} 个差异`;

    return { issues, overallScore, summary };
  }

  /**
   * 将 AI 分析结果转换为 ModuleDiff 格式
   */
  convertToModuleDiffs(
    result: AIAnalysisResult,
    figmaScreenshot: string,
    pageScreenshot: string
  ): ModuleDiff[] {
    if (result.issues.length === 0) {
      return [];
    }

    // 按区域/类别分组
    const grouped = new Map<string, Issue[]>();
    for (const issue of result.issues) {
      const key = issue.location || issue.category;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(issue);
    }

    const moduleDiffs: ModuleDiff[] = [];
    let index = 0;
    for (const [location, issues] of grouped) {
      const score = Math.max(0, 100 - issues.reduce((deduct, issue) => {
        switch (issue.level) {
          case 'critical': return deduct + 20;
          case 'major': return deduct + 10;
          case 'minor': return deduct + 3;
          case 'suggestion': return deduct + 1;
        }
      }, 0));

      moduleDiffs.push({
        name: location,
        selector: '',
        figmaNodeId: `ai-group-${index++}`,
        figmaScreenshot,
        pageScreenshot,
        score,
        issues,
      });
    }

    return moduleDiffs;
  }
}
