#!/bin/bash
# 一键复制主对比脚本到项目根目录

# 检查目标脚本是否存在
if [ ! -f "$(dirname "$0")/../../design-implementation-review" ]; then
    echo "主脚本不存在，正在从技能复制..."
    cp "$(dirname "$0")/../design-implementation-review" ../../design-implementation-review 2>/dev/null || echo "无法复制主脚本"
fi

# 设置执行权限
chmod +x ../../design-implementation-review 2>/dev/null || echo "无法设置执行权限"

echo "✅ 脚本就绪: 使用 ./design-implementation-review 运行设计对比"