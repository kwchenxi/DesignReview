// 直接运行 TypeScript 模块的方法
require('ts-node/register')

const path = require('path')
const fs = require('fs')

console.log('🚀 设计实现对比审查\n')

const figmaScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png'
const pageScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png'

// 检查文件是否存在
console.log('📁 检查文件...')
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

// 导入并使用 designReview 函数
try {
  console.log('🔄 正在加载模块...')
  const { designReview } = require('../src/index')
  
  console.log('🔄 正在执行设计对比...')
  
  designReview({
    pageScreenshot,
    figmaScreenshot,
    options: {
      output: {
        dir: './output',
        formats: ['html', 'markdown'],
        screenshotScale: 2,
      },
    },
  }).then(report => {
    console.log('\n✅ 设计还原度检查完成!')
    console.log(`📊 总体还原度评分: ${report.meta.overallScore}/100`)
    console.log(`📋 问题总数: ${report.meta.totalIssues}`)
    console.log(`  🔴 严重: ${report.meta.criticalCount}`)
    console.log(`  🟠 主要: ${report.meta.majorCount}`)
    console.log(`  🟡 次要: ${report.meta.minorCount}`)
    console.log(`  🟢 建议: ${report.meta.suggestionCount}\n`)
    
    console.log('📁 生成的报告文件:')
    report.outputFiles.forEach(file => {
      console.log(`  - ${file}`)
    })
    
    const htmlReport = path.join(__dirname, '..', 'output', 'design-review-report.html')
    if (fs.existsSync(htmlReport)) {
      console.log(`\n🌐 HTML 报告路径: file://${htmlReport}`)
    }
  }).catch(error => {
    console.error('❌ 设计对比失败:', error)
    console.error(error.stack)
    process.exit(1)
  })
  
} catch (error) {
  console.error('❌ 加载模块失败:', error)
  console.error(error.stack)
  process.exit(1)
}