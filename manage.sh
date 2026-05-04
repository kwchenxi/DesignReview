#!/bin/bash

echo "========================================"
echo "  设计审查工具 - 项目管理脚本"
echo "========================================"
echo ""

# 显示选项
echo "请选择要启动的项目："
echo "  1. 原项目（私人版）"
echo "  2. 公开版（新项目）"
echo "  3. 同时启动两个项目"
echo "  4. 查看项目对比"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
  1)
    echo ""
    echo "🚀 启动原项目（私人版）..."
    cd "/Users/hoho/Desktop/code/Claude/Design Review"
    if [ ! -d "node_modules" ]; then
      echo "📦 首次启动，正在安装依赖..."
      npm install
    fi
    npm run web
    ;;
  2)
    echo ""
    echo "🚀 启动公开版..."
    cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
    if [ ! -d "node_modules" ]; then
      echo "📦 首次启动，正在安装依赖..."
      npm install
    fi
    npm run web
    ;;
  3)
    echo ""
    echo "🚀 同时启动两个项目..."
    echo ""
    echo "📍 原项目将运行在: http://localhost:3456"
    echo "📍 公开版将运行在: http://localhost:3457"
    echo ""
    read -p "按回车键继续..."

    # 启动原项目
    cd "/Users/hoho/Desktop/code/Claude/Design Review"
    PORT=3456 npm run web &
    PID1=$!

    # 启动公开版
    cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
    PORT=3457 npm run web &
    PID2=$!

    echo ""
    echo "✅ 两个项目已启动！"
    echo "   原项目: http://localhost:3456"
    echo "   公开版: http://localhost:3457"
    echo ""
    echo "按 Ctrl+C 停止所有服务"

    # 等待
    wait $PID1 $PID2
    ;;
  4)
    echo ""
    echo "📊 项目对比"
    echo ""
    cat "/Users/hoho/Desktop/code/Claude/Design Review/PROJECT_COMPARISON.md"
    echo ""
    read -p "按回车键返回主菜单..."
    exec "$0"
    ;;
  *)
    echo "❌ 无效选项"
    exit 1
    ;;
esac
