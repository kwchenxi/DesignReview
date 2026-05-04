# Design Review — 设计还原度审查工具

自动化对比设计稿与实现页面的视觉差异，输出还原度评分和结构化问题清单。

---

## 三种使用方式

### 1. Claude Code Skill（推荐）

将 `skill/SKILL.md` 放入你的 Claude Code 项目即可通过命令调用。

**安装：**

```bash
curl -o .claude/commands/design-review.md https://raw.githubusercontent.com/kwchenxi/DesignReview/main/skill/SKILL.md
```

或者手动：打开 [skill/SKILL.md](skill/SKILL.md) → 下载 → 放到你项目的 `.claude/commands/` 目录下。

**使用：**

在 Claude Code 中输入 `/design-review`，按提示上传截图即可。

---

### 2. 在线工具（免安装）

上传两张截图（页面 + 设计稿），直接获得分析报告。

- 支持算法分析（免费、无需配置）
- 支持 AI 分析（自行配置 API Key，Key 只存浏览器本地）

**访问地址：** [design-review-weld.vercel.app](https://design-review-weld.vercel.app)

---

### 3. 本地运行（完整功能）

适合需要 URL 自动截图、Figma 集成等高级功能的开发者。

```bash
git clone https://github.com/kwchenxi/DesignReview.git
cd DesignReview
npm install

# Web 界面（端口 3456）
npm run web

# 或 CLI 命令行
npx ts-node src/cli.ts check -p 页面截图.png -g 设计稿截图.png

# AI 分析（需在 .env 中配置 AI_API_KEY）
npx ts-node src/cli.ts check -p 页面截图.png -g 设计稿截图.png --ai
```

---

## 仓库结构

```
DesignReview/
├── skill/
│   └── SKILL.md          ← Claude Code Skill 文件（下载这个即可）
├── web/                  ← 在线工具源码（Vercel 部署）
│   ├── api/              ← Serverless 函数入口
│   ├── public/           ← 前端页面
│   └── src/              ← 后端逻辑
├── src/                  ← 完整工具源码（CLI + Web + AI + Figma）
│   ├── cli.ts            ← CLI 入口
│   ├── diff/engine.ts    ← 像素对比 + CIE76 DeltaE 引擎
│   ├── diff/ai-analyzer.ts ← AI 视觉分析
│   ├── capture/          ← Puppeteer 页面截图
│   ├── figma/            ← Figma API 解析
│   ├── report/           ← 报告生成器
│   └── web/              ← Web UI 服务
└── README.md
```

## 功能特性

- **像素级对比** — pixelmatch + CIE76 DeltaE 感知色差
- **AI 语义分析** — 支持 OpenAI / Claude / DeepSeek
- **Figma 集成** — 解析 Figma 文件链接
- **结构化报告** — HTML 可视化报告 + Markdown 问题清单

## License

MIT
