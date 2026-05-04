---
name: design-implementation-review-main
description: 对比设计稿与实际实现页面的差异，生成详细设计还原度报告。当用户提供设计稿和实现页面截图时使用此技能。
---

# 设计实现对比审查技能

## 使用此技能的场景

此技能在用户需要对比设计稿与实现页面时使用，特别适用于：
- 用户提供两张截图：设计稿和实现页面
- 用户请求评估设计还原度
- 用户需要生成专业设计审查报告
- 项目需要验证UI实现质量

## 执行对比分析

### 确认文件路径
首先确认用户提供的图片文件路径。需要两个文件：
1. 设计稿截图（通常是Figma导出）
2. 实现页面截图（实际开发成果）

如果用户未明确提供，使用默认路径或询问用户。

### 选择对比方法
采用以下方法之一进行对比：

#### 方法A：一键对比脚本
如果项目根目录存在 `design-implementation-review` 脚本：
```bash
chmod +x design-implementation-review
./design-implementation-review <设计稿路径> <实现页面路径>
```

#### 方法B：CLI工具
如果项目配置了TypeScript环境：
```bash
npx ts-node src/cli.ts check \
  -p <实现页面路径> \
  -g <设计稿路径> \
  --format html,markdown \
  --output ./design-review-output
```

#### 方法C：Web界面
启动可视化对比界面：
```bash
npm run web
# 或
npx ts-node src/web/server.ts
```
然后引导用户访问 http://localhost:3456

#### 方法D：技能脚本
使用技能内置脚本：
```bash
node .codebuddy/skills/design-implementation-review-main/scripts/design-implementation-review.js \
  <实现页面路径> <设计稿路径>
```

### 展示对比结果
对比完成后，向用户报告：
- 总体还原度评分（0-100分）
- 问题分类统计（严重、主要、次要、建议）
- 生成报告文件的位置
- 如何打开HTML可视化报告

## 资源文件说明

### 脚本文件（scripts/）
- `design-implementation-review.js` - 技能主对比脚本
- `copy_main_script.sh` - 复制主脚本到项目目录

### 参考文档（references/）
- `implementation_guide.md` - 详细实现技术指南
- `issue_categories.md` - 问题分类和优先级标准

### 模板文件（assets/） 
- `report_template.html` - HTML报告模板

## 质量评估参考

### 相似度等级标准
- ≥95%：优秀（高度还原）
- 90-94%：良好（基本还原）
- 80-89%：一般（部分差异）
- <80%：较差（显著差异）

### 问题分级快速参考
- **严重**：功能缺失、主要组件缺失、颜色完全错误
- **主要**：布局错位、显著样式差异、主要间距错误
- **次要**：细微颜色差异、小间距偏差、次要样式差异
- **建议**：可优化项、增强建议

完整标准见 `references/issue_categories.md`

## 故障排除流程

### 文件不存在错误
1. 验证文件路径是否正确
2. 检查文件权限和格式（需PNG格式）
3. 确认文件是否损坏

### 依赖或编译错误
1. 尝试编译项目：`npm run build`
2. 如果编译失败，使用Web界面作为备选
3. 安装缺失依赖：`npm install`

### 备选方案
当主对比功能不可用时，使用简单对比：
```bash
node .codebuddy/simple_compare.js <设计稿路径> <实现页面路径>
```

## 输出和交付

### 核心输出文件
- HTML报告：`design-review-output/design-review-report.html`
- Markdown报告：`design-review-output/design-review-report.md`
- 差异图片：`design-review-output/visual-diff.png`

### 报告内容
确保报告包含：
- 总体评分和相似度百分比
- 问题分类统计
- 详细问题清单和位置标注
- 修复建议和优先级

### 最佳实践建议
- 优先使用最简单的方法（一键脚本）
- 明确告知用户输出文件位置
- 提供多种访问方式以适应不同环境
- 清晰解释错误信息并提供解决方案
- 参考技能文档获取技术细节