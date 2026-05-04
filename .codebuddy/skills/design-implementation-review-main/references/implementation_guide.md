# 设计实现对比实现指南

## 核心对比方法

### 1. 像素级对比
使用 pixelmatch 库进行像素级差异检测：
- **阈值 (threshold)**: 0.1（推荐），控制颜色差异灵敏度
- **抗锯齿检测 (includeAA)**: true（检测抗锯齿边缘差异）
- **透明度处理 (alpha)**: 0.5（半透明区域对比设置）

### 2. 尺寸处理策略
1. **等比缩放**: 将两张图片缩放到相同宽度
2. **重叠区域计算**: 只比较两张图片重叠的高度部分
3. **非重叠处理**: 记录非重叠区域，但不作为差异像素

### 3. 相似度计算公式
```
相似度 = (1 - 差异像素数 / 总像素数) × 100%
```

## 技术架构

### 核心文件结构
```
src/
├── diff/engine.ts          # 对比引擎（像素对比）
├── report/generator.ts     # 报告生成器
├── types.ts               # 类型定义
├── index.ts               # 主入口
└── web/server.ts          # Web服务端
```

### 主要模块功能

#### diff/engine.ts
- `pixelDiff()`: 像素对比主函数
- `resizePng()`: PNG图片缩放函数
- 尺寸统一、重叠区域计算、差异检测

#### report/generator.ts
- HTML报告生成（可视化对比）
- Markdown报告生成（详细清单）
- 问题分类和分级

#### web/server.ts
- Express服务器
- 文件上传处理
- 浏览器端可视化展示

## 依赖库说明

### 必需依赖
```json
{
  "pixelmatch": "^5.3.0",      // 像素对比
  "pngjs": "^7.0.0",          // PNG图片处理
  "colorjs.io": "^0.4.5",     // 颜色对比分析
  "express": "^4.22.1",       // Web服务器
  "multer": "^1.4.5-lts.1"    // 文件上传
}
```

### TypeScript配置
- Target: ES2020
- Module: CommonJS
- Strict模式启用

## 使用实例

### 基本调用方式
```typescript
import { designReview } from './src/index'

const report = await designReview({
  pageScreenshot: '/path/to/implementation.png',
  figmaScreenshot: '/path/to/design.png',
  options: {
    output: {
      dir: './output',
      formats: ['html', 'markdown']
    }
  }
})
```

### CLI调用
```bash
# 使用TypeScript
npx ts-node src/cli.ts check \
  -p implementation.png \
  -g design.png \
  --format html,markdown \
  --output ./design-review-output

# 使用编译版本
node dist/cli.js check \
  -p implementation.png \
  -g design.png \
  --format html,markdown \
  --output ./design-review-output
```

## 故障排除

### 常见错误及解决方案

#### Error: Cannot find module 'pixelmatch'
```bash
npm install pixelmatch pngjs
npm install --save-dev @types/pixelmatch @types/pngjs
```

#### Error: Image dimensions don't match
- 确保图片格式正确（PNG格式）
- 调整缩放策略参数
- 检查图片是否损坏

#### Error: TypeScript compilation failed
```bash
npm run build              # 编译项目
npx tsc --noEmit           # 检查类型错误
```

### 性能优化建议
1. **图片大小限制**: 建议图片宽度不超过1500px
2. **内存管理**: 大图片分块处理
3. **缓存策略**: 复用已解析的图片对象

## 扩展建议

### 功能扩展
1. **多区域对比**: 支持特定区域（如上导航、主内容区）的独立对比
2. **文字OCR对比**: 识别并对比文字内容
3. **颜色量化分析**: 统计颜色使用差异

### 集成建议
1. **CI/CD集成**: 在构建流程中自动进行设计对比
2. **Figma插件**: 直接从Figma获取设计稿
3. **截图服务集成**: 自动截取实现页面

### 质量提升
1. **智能阈值调整**: 根据图片内容自动调整对比阈值
2. **差异分类学习**: 使用机器学习分类差异类型
3. **上下文感知**: 考虑UI组件上下文差异容忍度

## 最佳实践

### 图片准备
1. **设计稿**:
   - 导出PNG格式
   - 建议分辨率：2倍图
   - 移除辅助线和标注

2. **实现页面**:
   - 相同设备尺寸截图
   - 相同浏览器缩放比例
   - 清除用户个人数据

### 对比执行
1. **定期对比**: 每次重要UI更新后进行对比
2. **版本控制**: 保存历史对比结果
3. **团队协作**: 分享对比报告并记录修复进度

### 结果解释
1. **关注严重问题**: 优先修复功能性和显著视觉问题
2. **容忍微小差异**: 抗锯齿、渲染引擎差异等可容忍
3. **持续改进**: 建立设计还原度基线并持续提升