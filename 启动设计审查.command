#!/bin/bash
# 设计还原度审查工具启动脚本

# 切换到脚本所在目录（兼容中文路径）
cd "$(dirname "$0")" || cd "$(dirname "$(readlink -f "$0")")" || exit 1

echo "📁 工作目录: $(pwd)"

# 检查 node 是否安装
if ! command -v node &>/dev/null; then
  echo "❌ 错误: 未安装 Node.js，请先安装 Node.js"
  exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
  echo "📦 检测到缺少依赖，正在安装..."
  npm install --silent
fi

# 自动杀掉占用 3456 端口的旧进程
OLD_PID=$(lsof -ti:3456 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "🔄 关闭旧服务 (PID: $OLD_PID)..."
  kill -9 $OLD_PID 2>/dev/null
  sleep 1
fi

echo "🚀 启动设计还原度审查工具..."
echo "   请稍候，服务启动中..."
echo ""

# 后台等待端口就绪后打开浏览器
(
  for i in $(seq 1 30); do
    if lsof -iTCP:3456 -sTCP:LISTEN -t >/dev/null 2>&1; then
      sleep 1
      echo "✅ 服务已就绪，正在打开浏览器..."
      open http://localhost:3456
      exit 0
    fi
    sleep 1
  done
  echo "⚠️ 等待超时，请手动访问 http://localhost:3456"
) &

# 启动服务
npx ts-node src/web/server.ts
