#!/bin/bash
cd "$(dirname "$0")"

# 自动杀掉占用 3456 端口的旧进程
OLD_PID=$(lsof -ti:3456 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "🔄 关闭旧服务 (PID: $OLD_PID)..."
  kill -9 $OLD_PID 2>/dev/null
  sleep 1
fi

echo "🚀 启动设计还原度审查工具..."

# 延迟2秒后自动打开浏览器
(sleep 2 && open http://localhost:3456) &

npx ts-node src/web/server.ts
