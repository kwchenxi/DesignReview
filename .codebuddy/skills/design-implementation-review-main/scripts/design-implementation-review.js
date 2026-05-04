#!/usr/bin/env node
/**
 * 设计实现对比审查脚本 - skill版本
 * 用法: node design-implementation-review.js <设计稿路径> <实现页面路径>
 * 示例: node design-implementation-review.js "/tmp/设计稿.png" "/tmp/实现页面.png"
 */

const fs = require('fs')
const path = require('path')

// 寻找项目根目录
function findProjectRoot() {
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return process.cwd();
}

async function main() {
  // 如果没有参数，尝试使用用户提供的默认路径
  let figmaScreenshot, pageScreenshot
  
  if (process.argv.length >= 4) {
    // 从命令行参数获取
    pageScreenshot = process.argv[2]
    figmaScreenshot = process.argv[3]
  } else {
    console.log('⚠️  用法: node design-implementation-review.js <实现页面路径> <设计稿路径>')
    console.log('\n示例:')
    console.log('  node design-implementation-review.js "/tmp/实现页面.png" "/tmp/设计稿.png"')
    return
  }
  
  console.log('🚀 设计实现对比审查 (skill版本)\n')
  console.log('📁 检查文件...')
  
  // 检查文件是否存在
  if (!fs.existsSync(figmaScreenshot)) {
    console.error(`❌ 设计稿文件不存在: ${figmaScreenshot}`)
    process.exit(1)
  }
  if (!fs.existsSync(pageScreenshot)) {
    console.error(`❌ 页面截图文件不存在: ${pageScreenshot}`)
    process.exit(1)
  }
  
  console.log(`✅ 设计稿: ${path.basename(figmaScreenshot)}`)
  console.log(`✅ 实现页面: ${path.basename(pageScreenshot)}\n`)
  
  const projectRoot = findProjectRoot();
  console.log(`📦 项目根目录: ${projectRoot}`)
  
  // 检查是否有主对比脚本
  const mainScript = path.join(projectRoot, 'design-implementation-review')
  if (fs.existsSync(mainScript)) {
    console.log('📋 使用已存在的主对比脚本...')
    try {
      // 设置执行权限
      fs.chmodSync(mainScript, '755')
      
      const { spawn } = require('child_process')
      const child = spawn(mainScript, [pageScreenshot, figmaScreenshot], {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true
      })
      
      child.on('close', (code) => {
        process.exit(code)
      })
    } catch (error) {
      console.error('❌ 执行主脚本失败:', error.message)
    }
  } else {
    console.log('⚠️ 未找到主对比脚本，使用简易对比...')
    await runSimpleCompare(pageScreenshot, figmaScreenshot, projectRoot)
  }
}

// 简易对比函数
async function runSimpleCompare(pagePath, figmaPath, outputDir) {
  console.log('📊 使用简易像素对比分析...')
  
  // 如果pixelmatch不可用，使用基础分析
  try {
    const pixelmatch = require('pixelmatch');
    const { PNG } = require('pngjs');
    
    const img1 = PNG.sync.read(fs.readFileSync(figmaPath));
    const img2 = PNG.sync.read(fs.readFileSync(pagePath));
    
    console.log(`设计稿尺寸: ${img1.width} x ${img1.height}`);
    console.log(`实现页面尺寸: ${img2.width} x ${img2.height}`);
    
    // 创建输出目录
    const outputPath = path.join(outputDir, 'design-review-output')
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }
    
    if (img1.width === img2.width && img1.height === img2.height) {
      const diff = new PNG({ width: img1.width, height: img1.height });
      const mismatchedPixels = pixelmatch(
        img1.data, img2.data, diff.data, 
        img1.width, img1.height, 
        { threshold: 0.1, includeAA: true }
      );
      
      const totalPixels = img1.width * img1.height;
      const similarity = ((1 - mismatchedPixels / totalPixels) * 100).toFixed(2);
      
      console.log(`\n📊 对比结果:`);
      console.log(`  像素相似度: ${similarity}%`);
      console.log(`  差异像素数: ${mismatchedPixels} / ${totalPixels}`);
      
      // 保存差异图
      const diffPath = path.join(outputPath, 'visual-diff.png');
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      console.log(`🖼️  差异图已保存: ${diffPath}`);
      
      // 评估
      let assessment = '';
      if (similarity >= 95) assessment = '✅ 优秀 - 高度还原';
      else if (similarity >= 90) assessment = '⚠️  良好 - 基本还原';
      else if (similarity >= 80) assessment = '⚠️  一般 - 部分差异';
      else assessment = '❌ 较差 - 显著差异';
      
      console.log(`📋 评估: ${assessment}`);
      
      // 生成简单报告
      const reportPath = path.join(outputPath, 'simple-report.md');
      const report = `# 设计对比报告

## 基本信息
- 设计稿: ${path.basename(figmaPath)}
- 实现页面: ${path.basename(pagePath)}
- 对比时间: ${new Date().toLocaleString()}

## 对比结果
- **像素相似度**: ${similarity}%
- **差异像素数**: ${mismatchedPixels} / ${totalPixels}
- **评估**: ${assessment}

## 图片信息
- 设计稿尺寸: ${img1.width} x ${img1.height}
- 实现页面尺寸: ${img2.width} x ${img2.height}

## 查看差异
1. 打开差异图片: ${path.relative(outputDir, diffPath)}
2. 红色越深表示差异越大

## 建议
${getRecommendations(parseFloat(similarity))}

---

*报告由 Design Implementation Review Skill 生成*`;
      
      fs.writeFileSync(reportPath, report);
      console.log(`📄 报告已保存: ${reportPath}`);
      console.log(`📁 输出目录: ${outputPath}`);
      
    } else {
      console.log('⚠️  图片尺寸不同:');
      console.log(`  宽度: 设计稿 ${img1.width}px, 实现 ${img2.width}px (差异: ${Math.abs(img1.width - img2.width)}px)`);
      console.log(`  高度: 设计稿 ${img1.height}px, 实现 ${img2.height}px (差异: ${Math.abs(img1.height - img2.height)}px)`);
    }
  } catch (error) {
    console.log('⚠️  pixelmatch不可用，进行基础文件检查...');
    console.log(`✅ 文件存在: ${fs.existsSync(pagePath) ? '是' : '否'}`);
    console.log(`✅ 文件存在: ${fs.existsSync(figmaPath) ? '是' : '否'}`);
    console.log('📝 基础检查完成');
    console.log('💡 建议: 在主项目目录中运行 npm install 安装依赖');
  }
}

function getRecommendations(similarity) {
  if (similarity >= 95) return "- 实现质量优秀，继续保持！\n- 检查是否有细微的交互状态差异";
  if (similarity >= 90) return "- 实现质量良好\n- 检查字体、间距等细节\n- 验证颜色是否完全匹配";
  if (similarity >= 80) return "- 存在明显视觉差异\n- 需要检查布局、颜色、字体\n- 建议进行详细的视觉审查";
  return "- 差异显著，需要重新评估实现方案\n- 检查UI组件是否正确实现\n- 建议与设计师进行沟通";
}

if (require.main === module) {
  main().catch(err => {
    console.error('未处理的错误:', err)
    process.exit(1)
  })
}

module.exports = { main }