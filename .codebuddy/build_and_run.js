const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 开始设计实现对比审查...')

const figmaScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png'
const pageScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png'

// 检查文件存在性
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
console.log(`✅ 实现页面: ${path.basename(pageScreenshot)}`)

// 检查是否有编译好的dist
if (!fs.existsSync(path.join(__dirname, '..', 'dist'))) {
  console.log('🔨 编译TypeScript项目...')
  try {
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
  } catch (err) {
    console.error('编译失败，尝试使用ts-node运行...')
  }
}

// 运行设计对比
console.log('🔄 执行设计对比...')
const cmd = `node "${path.join(__dirname, '..', 'dist', 'cli.js')}" check -p "${pageScreenshot}" -g "${figmaScreenshot}" --format html,markdown`

try {
  console.log(`执行命令: ${cmd}`)
  execSync(cmd, { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
  console.log('✅ 设计对比完成！')
  
  // 显示报告路径
  const outputDir = path.join(__dirname, '..', 'output')
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir)
    console.log('\n📋 生成的报告文件:')
    files.forEach(file => {
      console.log(`  - ${path.join(outputDir, file)}`)
    })
    
    // 尝试打开HTML报告
    const htmlReport = path.join(outputDir, 'design-review-report.html')
    if (fs.existsSync(htmlReport)) {
      console.log(`\n🌐 HTML报告: file://${htmlReport}`)
    }
  }
} catch (err) {
  console.error('❌ 设计对比失败:', err.message)
  process.exit(1)
}