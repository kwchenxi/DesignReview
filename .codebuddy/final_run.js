// 最终运行脚本
const fs = require('fs')
const path = require('path')

console.log('='.repeat(60))
console.log('🎨 设计实现对比审查')
console.log('='.repeat(60))

const figmaPath = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png'
const pagePath = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png'

// 检查文件
console.log('\n📁 文件检查:')
console.log(`   设计稿: ${figmaPath}`)
console.log(`   ${fs.existsSync(figmaPath) ? '✅ 存在' : '❌ 不存在'}`)
console.log(`   实现页面: ${pagePath}`)
console.log(`   ${fs.existsSync(pagePath) ? '✅ 存在' : '❌ 不存在'}\n`)

if (!fs.existsSync(figmaPath) || !fs.existsSync(pagePath)) {
  console.log('❌ 文件不全，无法进行对比。')
  process.exit(1)
}

console.log('🔄 正在加载设计对比模块...')

try {
  // 尝试使用 ts-node
  require('ts-node/register')
  const { designReview } = require('./src/index')
  
  console.log('✅ 模块加载成功')
  console.log('🔄 开始执行设计对比...\n')
  
  const outputDir = './design-review-output-' + Date.now()
  
  designReview({
    pageScreenshot: pagePath,
    figmaScreenshot: figmaPath,
    options: {
      output: {
        dir: outputDir,
        formats: ['html', 'markdown'],
        screenshotScale: 2,
      },
    },
  }).then(report => {
    console.log('\n' + '='.repeat(60))
    console.log('✅ 设计对比完成！')
    console.log('='.repeat(60))
    
    console.log(`\n📊 总体还原度: ${report.meta.overallScore}/100`)
    console.log(`📋 发现问题: ${report.meta.totalIssues} 个`)
    console.log(`   🔴 严重: ${report.meta.criticalCount}`)
    console.log(`   🟠 主要: ${report.meta.majorCount}`)
    console.log(`   🟡 次要: ${report.meta.minorCount}`)
    console.log(`   🟢 建议: ${report.meta.suggestionCount}`)
    
    console.log('\n📁 报告文件:')
    report.outputFiles.forEach(file => {
      console.log(`   📄 ${file}`)
    })
    
    const htmlReport = report.outputFiles.find(f => f.endsWith('.html'))
    if (htmlReport) {
      console.log(`\n🌐 HTML 报告: file://${path.resolve(htmlReport)}`)
      console.log('   💡 复制此链接到浏览器中打开查看可视化报告')
    }
    
    console.log('\n📝 详细问题请查看生成的报告文件。')
    
  }).catch(err => {
    console.error('\n❌ 设计对比失败:', err.message)
    console.log('\n💡 请尝试以下替代方案:')
    console.log('   1. 运行: npx ts-node src/cli.ts check -p "' + pagePath + '" -g "' + figmaPath + '"')
    console.log('   2. 启动 Web 界面: npm run web')
  })
  
} catch (err) {
  console.error('❌ 初始化失败:', err.message)
  console.log('\n🔧 可能的原因及解决方案:')
  console.log('   1. 依赖未安装: 运行 npm install')
  console.log('   2. TypeScript 未安装: 运行 npm install -g ts-node 或使用 npx')
  console.log('   3. 使用编译版本: 运行 npm run build')
}