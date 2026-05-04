#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 用户提供的图片路径
const designPath = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png';
const implementationPath = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png';

console.log('🚀 启动设计实现对比 (Skill版本)');
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

console.log('✅ 文件存在，开始对比分析...');

// 技能脚本路径
const skillScript = path.join(__dirname, 'skills/design-implementation-review-main/scripts/design-implementation-review.js');

if (fs.existsSync(skillScript)) {
  try {
    console.log('\n📦 使用技能脚本进行对比...');
    execSync(`node "${skillScript}" "${implementationPath}" "${designPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  } catch (error) {
    console.error('❌ 技能脚本执行失败:', error.message);
    tryFallback();
  }
} else {
  console.log('⚠️ 技能脚本不存在，使用备用方案...');
  tryFallback();
}

function tryFallback() {
  // 备用方案：检查主脚本
  const mainScript = path.join(__dirname, '..', 'design-implementation-review');
  if (fs.existsSync(mainScript)) {
    console.log('\n📋 使用主脚本对比...');
    try {
      fs.chmodSync(mainScript, '755');
      execSync(`"${mainScript}" "${implementationPath}" "${designPath}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.error('❌ 主脚本执行失败:', error.message);
      runSimpleCompare();
    }
  } else {
    console.log('⚠️ 主脚本不存在，使用简单对比...');
    runSimpleCompare();
  }
}

function runSimpleCompare() {
  const simpleScript = path.join(__dirname, 'simple_compare.js');
  if (fs.existsSync(simpleScript)) {
    console.log('\n🔧 使用简单对比脚本...');
    try {
      execSync(`node "${simpleScript}" "${designPath}" "${implementationPath}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('❌ 简单对比失败:', error.message);
      console.log('\n💡 最终建议: 使用Web界面');
      console.log('  1. cd "/Users/hoho/Desktop/code/Design Review"');
      console.log('  2. npm run web');
      console.log('  3. 访问 http://localhost:3456');
      console.log('  4. 上传两张截图进行对比');
    }
  }
}