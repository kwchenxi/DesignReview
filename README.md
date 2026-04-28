# Design Review - 设计还原度审查工具

自动化对比设计稿与实现页面的视觉差异，输出还原度评分和问题清单。

## 特性

- **像素级对比** — 基于 pixelmatch 的像素差异检测，支持抗锯齿容差
- **CIE76 DeltaE 感知色差** — 使用 Lab 色彩空间计算人眼感知色差，避免 RGB 空间的误判
- **容差按属性独立配置** — 颜色、字号、字重等属性各有独立容差阈值
- **AI 视觉分析** — 支持 OpenAI / Anthropic Claude / DeepSeek 及兼容接口，理解上下文语义
- **Figma 集成** — 支持直接解析 Figma 文件链接，提取设计稿信息
- **多种使用方式** — CLI 命令行 / Web 界面 / Claude Code Skill

## 快速开始（3 步上手，零配置可用）

```bash
# 1. 克隆安装
git clone <repo-url>
cd Design\ Review
npm install

# 2. 直接使用——两张截图即可，无需任何配置
npx ts-node src/cli.ts check -p 页面截图.png -g 设计稿截图.png

# 3. 查看报告——自动生成在 ./output 目录
```

**就这样，不需要 API Key，不需要 Figma Token。**

## 按需解锁更多能力

核心的截图对比功能开箱即用。以下功能按需配置，配一个用一个：

### 解锁 AI 语义分析

> 让 AI 不只找像素差异，还能理解上下文语义、交互状态、文案一致性

```bash
cp .env.example .env
# 编辑 .env，填入 AI_API_KEY
```

| 变量 | 说明 | 怎么获取 |
|------|------|---------|
| `AI_API_KEY` | AI 服务密钥 | [OpenAI](https://platform.openai.com/api-keys) / [Anthropic](https://console.anthropic.com/) / [DeepSeek](https://platform.deepseek.com/) |
| `AI_API_BASE` | API 地址 | 不填默认 OpenAI；用 DeepSeek 填 `https://api.deepseek.com/v1` |
| `AI_MODEL` | 模型名称 | 不填默认 `gpt-4o`；DeepSeek 填 `deepseek-chat` |
| `AI_PROVIDER` | 服务商 | 不填自动推断；手动指定 `openai` 或 `claude` |

配置后使用：

```bash
npx ts-node src/cli.ts check -p 页面截图.png -g 设计稿截图.png --ai
```

### 解锁 Figma 链接解析

> 不用手动导出设计稿截图，直接用 Figma 文件链接

```bash
# 在 .env 中添加
FIGMA_ACCESS_TOKEN=figd_你的token
```

获取方式：Figma → Settings → Personal access tokens → Generate new token

配置后使用：

```bash
npx ts-node src/cli.ts check -u https://example.com -f https://figma.com/file/xxx
```

## 使用方式

### 方式一：CLI 命令行

```bash
# 纯截图对比（最常用，零配置）
npx ts-node src/cli.ts check -p page.png -g design.png

# 截图 + AI 分析（需配置 AI_API_KEY）
npx ts-node src/cli.ts check -p page.png -g design.png --ai

# URL 截图 + 设计稿截图
npx ts-node src/cli.ts check -u https://example.com -g design.png

# URL + Figma 链接（需配置 FIGMA_ACCESS_TOKEN）
npx ts-node src/cli.ts check -u https://example.com -f https://figma.com/file/xxx
```

### 方式二：Web 界面

```bash
npm run web
```

浏览器访问 `http://localhost:3456`，上传截图即可对比。

局域网其他设备可访问 `http://<你的IP>:3456`。

### 方式三：Claude Code Skill

将 `.claude/commands/design-review.md` 放入你的 Claude Code 项目目录，即可通过 `/design-review` 命令调用。

## 输出

工具会生成：

- **HTML 可视化报告** — 像素差异热力图 + 问题标注
- **Markdown 报告** — 结构化问题清单

报告内容包含：

- 总体评分（X / 100）
- 问题统计（严重 / 主要 / 次要 / 建议）
- 逐项问题详情及修复建议

## 技术架构

```
src/
├── cli.ts              # CLI 入口
├── index.ts            # 主流程编排
├── config.ts           # 容差配置
├── diff/
│   ├── engine.ts       # 像素对比 + CIE76 DeltaE 引擎
│   └── ai-analyzer.ts  # AI 视觉分析
├── capture/            # Puppeteer 页面截图
├── figma/              # Figma API 解析
├── report/             # 报告生成器
└── web/                # Web UI 服务
```

## License

MIT
