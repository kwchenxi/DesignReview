const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

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

// 创建输出目录
const outputDir = path.join(__dirname, '..', 'output')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 构建命令
const cmd = `npx ts-node src/cli.ts check -p "${pageScreenshot}" -g "${figmaScreenshot}" --format html,markdown --output "${outputDir}"`

console.log('🔄 正在执行设计对比...\n')
console.log(`执行命令: ${cmd}\n`)

try {
  // 执行命令
  execSync(cmd, { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
  
  console.log('\n✅ 设计对比完成！')
  
  // 显示生成的文件
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir)
    console.log('\n📋 生成的报告文件:')
    files.forEach(file => {
      const fullPath = path.join(outputDir, file)
      console.log(`  - ${fullPath}`)
    })
    
    const htmlReport = path.join(outputDir, 'design-review-report.html')
    if (fs.existsSync(htmlReport)) {
      console.log(`\n🌐 HTML 报告路径: file://${htmlReport}`)
    }
  }
} catch (error) {
  console.error('\n❌ 执行失败:', error.message)
  console.log('\n尝试编译项目再运行...')
  
  // 尝试先构建
  console.log('🔨 编译项目...')
  try {
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
    
    // 使用编译后的版本
    const distCli = path.join(__dirname, '..', 'dist', 'cli.js')
    if (fs.existsSync(distCli)) {
      const cmd2 = `node dist/cli.js check -p "${pageScreenshot}" -g "${figmaScreenshot}" --format html,markdown --output "${outputDir}"`
      console.log(`\n执行编译后的命令: ${cmd2}`)
      execSync(cmd2, { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
      
      console.log('\n✅ 设计对比完成！')
    }
  } catch (buildError) {
    console.error('❌ 构建失败:', buildError.message)
    process.exit(1)
  }
}