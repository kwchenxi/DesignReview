# 设计审查工具 - 公开版

自动化设计还原度检查工具，支持 Figma 设计稿与线上页面对比，提供像素级差异检测和 AI 智能分析。

## ✨ 特性

- **🎨 Figma 设计稿对比** - 直接从 Figma 提取设计数据
- **🔍 像素级差异检测** - 精确识别视觉差异
- **🤖 AI 智能分析** - 增强功能，提供专业设计建议（可选）
- **📊 详细的审查报告** - 多维度评估设计还原度
- **⚙️ 灵活配置** - 支持自定义设计规范
- **🌐 Web 界面** - 简单易用的可视化操作

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动 Web 服务

```bash
npm run web
```

访问 http://localhost:3457 开始使用

### 使用命令行

```bash
# 使用算法模式（无需 AI）
npm run dev -- --design <figma-url> --url <page-url> --mode algorithm

# 使用 AI 增强模式（需配置 AI Key）
npm run dev -- --design <figma-url> --url <page-url> --mode ai
```

## 📖 使用说明

### Web 界面使用流程

1. **配置参数**（首次使用）
   - 点击设置图标配置 Figma Token 和 AI Key（可选）
   - Figma Token 获取方式：Figma Account Settings → Personal Access Tokens

2. **上传对比素材**
   - 方式一：输入 Figma 设计稿 URL
   - 方式二：上传页面截图（手动）

3. **选择审查模式**
   - **算法模式**（默认）- 仅像素对比，无需 AI
   - **AI 增强模式** - 像素对比 + AI 智能分析

4. **生成报告**
   - 等待分析完成，查看详细的差异报告和建议

### 配置设计规范

自定义设计规范 URL，支持：
- NPM 包地址（如：`https://registry.npmjs.org/your-ui-package`）
- JSON API 地址
- 本地文件路径

## 🔧 配置说明

### 运行时配置

在 Web 界面的设置页面可以配置：

| 配置项 | 说明 | 是否必需 |
|--------|------|----------|
| Figma Token | 访问 Figma API 的凭证 | 必需（使用 Figma 时） |
| AI API Key | AI 分析的 API Key | 可选（算法模式不需要） |
| 设计规范地址 | 自定义设计规范源 | 可选 |
| 默认端口 | Web 服务端口 | 可选（默认 3456） |

### 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
FIGMA_TOKEN=your_figma_token
AI_API_KEY=your_ai_key
PORT=3456
```

## 📊 审查报告说明

报告包含以下维度：

- **视觉差异** - 像素级对比结果
- **布局一致性** - 间距、对齐等
- **字体排版** - 字号、字重、行高
- **颜色使用** - 主色、辅助色、对比度
- **组件规范** - 是否符合设计规范

## 🎯 最佳实践

1. **优先使用算法模式** - 速度快，适合快速检查
2. **AI 模式用于深度分析** - 需要专业建议时使用
3. **配置设计规范** - 提高审查准确性
4. **定期审查** - 持续监控设计还原度

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⚠️ 注意事项

- 本工具仅用于开发阶段的设计验证
- 不建议在生产环境中使用
- AI 分析功能需要有效的 API Key
- 请妥善保管你的 API Token
