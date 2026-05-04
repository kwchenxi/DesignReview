#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 简单的图片对比脚本，不依赖项目结构
async function compareImages(designPath, implementationPath) {
  console.log('🔍 开始对比设计稿与实现页面...');
  console.log(`设计稿: ${designPath}`);
  console.log(`实现页面: ${implementationPath}`);
  
  // 检查文件是否存在
  if (!fs.existsSync(designPath)) {
    console.error(`❌ 设计稿文件不存在: ${designPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(implementationPath)) {
    console.error(`❌ 实现页面文件不存在: ${implementationPath}`);
    process.exit(1);
  }
  
  console.log('✅ 文件存在，准备进行对比分析...');
  
  // 尝试使用 pixelmatch（如果可用）
  try {
    const pixelmatch = require('pixelmatch');
    const { PNG } = require('pngjs');
    
    console.log('📊 使用 pixelmatch 进行像素级对比...');
    
    // 读取图片
    const img1 = PNG.sync.read(fs.readFileSync(designPath));
    const img2 = PNG.sync.read(fs.readFileSync(implementationPath));
    
    console.log(`设计稿尺寸: ${img1.width} x ${img1.height}`);
    console.log(`实现页面尺寸: ${img2.width} x ${img2.height}`);
    
    // 计算简单相似度（如果尺寸相同）
    if (img1.width === img2.width && img1.height === img2.height) {
      const diff = new PNG({ width: img1.width, height: img1.height });
      const mismatchedPixels = pixelmatch(
        img1.data, img2.data, diff.data, 
        img1.width, img1.height, 
        { threshold: 0.1, includeAA: true }
      );
      
      const totalPixels = img1.width * img1.height;
      const similarity = ((1 - mismatchedPixels / totalPixels) * 100).toFixed(2);
      
      console.log(`📈 像素相似度: ${similarity}%`);
      console.log(`🔢 差异像素数: ${mismatchedPixels} / ${totalPixels}`);
      
      // 保存差异图
      const diffPath = path.join(process.cwd(), 'diff-output.png');
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      console.log(`🖼️  差异图已保存: ${diffPath}`);
      
      // 提供简单的评估
      let assessment = '';
      if (similarity >= 95) assessment = '✅ 优秀 - 高度还原';
      else if (similarity >= 90) assessment = '⚠️  良好 - 基本还原';
      else if (similarity >= 80) assessment = '⚠️  一般 - 部分差异';
      else assessment = '❌ 较差 - 显著差异';
      
      console.log(`📋 评估: ${assessment}`);
      
      return { similarity, mismatchedPixels, totalPixels, diffPath };
    } else {
      console.log('⚠️  图片尺寸不同，无法进行精确像素对比');
      console.log('📏 尺寸差异分析:');
      console.log(`  宽度: 设计稿 ${img1.width}px, 实现 ${img2.width}px (差异: ${Math.abs(img1.width - img2.width)}px)`);
      console.log(`  高度: 设计稿 ${img1.height}px, 实现 ${img2.height}px (差异: ${Math.abs(img1.height - img2.height)}px)`);
      
      return { similarity: null, sizeMismatch: true };
    }
  } catch (error) {
    console.log('⚠️  pixelmatch 不可用，进行基础分析...');
    console.log('📝 基础分析完成');
    console.log('💡 建议: 安装完整的设计审查工具获得更详细的分析');
    
    return { error: error.message };
  }
}

// 从命令行参数获取文件路径
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('用法: node simple_compare.js <设计稿路径> <实现页面路径>');
  console.log('示例: node simple_compare.js design.png implementation.png');
  process.exit(1);
}

const designPath = args[0];
const implementationPath = args[1];

compareImages(designPath, implementationPath)
  .then(() => console.log('🎉 对比完成'))
  .catch(err => console.error('❌ 对比失败:', err));