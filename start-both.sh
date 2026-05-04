#!/bin/bash

echo "========================================"
echo "  同时启动两个设计审查工具"
echo "========================================"
echo ""
echo "📍 项目信息："
echo "   原项目（旧版）: http://your-ip:3456"
echo "   公开版（新项目）: http://localhost:3457"
echo ""

read -p "确定要同时启动两个项目吗？(y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "🚀 正在启动原项目（3456 端口）..."
cd "/Users/hoho/Desktop/code/Claude/Design Review"
PORT=3456 npm run web &
PID1=$!

sleep 2

echo "🚀 正在启动公开版（3457 端口）..."
cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
PORT=3457 npm run web &
PID2=$!

echo ""
echo "✅ 两个项目已启动！"
echo ""
echo "========================================"
echo "  📍 访问地址"
echo "========================================"
echo ""
echo "📌 原项目（旧版）- 供局域网访问"
echo "   http://your-ip:3456"
echo "   http://localhost:3456"
echo ""
echo "📌 公开版（新项目）- 本地使用"
echo "   http://localhost:3457"
echo ""
echo "========================================"
echo ""
echo "💡 提示："
echo "   按 Ctrl+C 停止所有服务"
echo "   查看端口使用: cat PORT_USAGE.md"
echo ""

# 等待任一进程结束
wait $PID1 $PID2
