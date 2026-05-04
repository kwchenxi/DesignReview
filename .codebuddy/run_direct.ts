import { designReview } from './src/index'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  console.log('🚀 设计实现对比审查\n')
  
  const figmaScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png'
  const pageScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png'
  
  // 检查文件
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
  
  // 确保输出目录存在
  const outputDir = './output'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  try {
    console.log('🔄 正在对比设计稿与实现页面...')
    const report = await designReview({
      pageScreenshot,
      figmaScreenshot,
      options: {
        output: {
          dir: outputDir,
          formats: ['html', 'markdown'] as any,
          screenshotScale: 2,
        },
      },
    })
    
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
    
    // 显示HTML报告路径
    const htmlReport = path.join(outputDir, 'design-review-report.html')
    if (fs.existsSync(htmlReport)) {
      console.log(`\n🌐 HTML 报告: file://${path.resolve(htmlReport)}`)
    }
    
  } catch (error: any) {
    console.error('❌ 执行失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()