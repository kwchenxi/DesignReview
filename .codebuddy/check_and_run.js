const fs = require('fs')
const path = require('path')

console.log('🔍 检查设计对比文件...\n')

const figmaScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png'
const pageScreenshot = '/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png'

const figmaExists = fs.existsSync(figmaScreenshot)
const pageExists = fs.existsSync(pageScreenshot)

console.log(`设计稿 (${path.basename(figmaScreenshot)}): ${figmaExists ? '✅ 存在' : '❌ 不存在'}`)
console.log(`实现页面 (${path.basename(pageScreenshot)}): ${pageExists ? '✅ 存在' : '❌ 不存在'}\n`)

if (!figmaExists || !pageExists) {
  console.log('📌 文件不存在，无法进行设计对比。')
  console.log('   请确保图片文件在指定路径。')
  process.exit(1)
}

console.log('🎯 文件检查通过！')
console.log(`
下一步操作:

方案1: 使用命令行对比 (推荐)
--------------------------------
在终端中运行以下命令:

  cd "${process.cwd()}"
  npx ts-node src/cli.ts check \\
    -p "${pageScreenshot}" \\
    -g "${figmaScreenshot}" \\
    --format html,markdown \\
    --output ./design-review-output

方案2: 启动 Web 界面
--------------------------------
运行以下命令启动 Web 界面，然后上传截图对比:

  cd "${process.cwd()}"
  npm run web
  # 或
  npx ts-node src/web/server.ts

然后在浏览器中访问: http://localhost:3456

方案3: 使用一键脚本
--------------------------------
已创建一键脚本:

  chmod +x design-implementation-review
  ./design-implementation-review

该脚本会自动对比以上两个图片文件。

📊 对比完成后，会生成 HTML 和 Markdown 报告。
🌐 HTML 报告可以在浏览器中打开查看可视化对比结果。

开始执行方案1...\n`)

// 尝试自动运行方案1
const { execSync } = require('child_process')
try {
  const outputDir = './design-review-output'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  console.log('🔄 正在执行设计对比...')
  const cmd = `npx ts-node src/cli.ts check -p "${pageScreenshot}" -g "${figmaScreenshot}" --format html,markdown --output "${outputDir}"`
  console.log(`执行: ${cmd}\n`)
  
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
  
  console.log('\n✅ 设计对比完成！')
  
  // 显示报告
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir)
    console.log('\n📋 生成的报告文件:')
    files.forEach(file => {
      console.log(`  - ${path.join(outputDir, file)}`)
    })
    
    const htmlReport = path.join(outputDir, 'design-review-report.html')
    if (fs.existsSync(htmlReport)) {
      console.log(`\n🌐 HTML 报告: file://${path.resolve(htmlReport)}`)
      console.log('   复制以上链接到浏览器打开查看详细报告')
    }
  }
  
} catch (error) {
  console.error('\n❌ 自动执行失败:', error.message)
  console.log('\n📝 请手动执行上述方案1或方案2。')
}