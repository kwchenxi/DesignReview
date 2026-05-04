#!/bin/bash
cd "$(dirname "$0")"

FIGMA_SCREENSHOT="/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页设计稿.png"
PAGE_SCREENSHOT="/var/folders/mp/f30cybhj6vn2llw8vxbsl7nc0000gn/T/会议首页.png"

# 检查文件是否存在
if [ ! -f "$FIGMA_SCREENSHOT" ]; then
    echo "❌ 设计稿文件不存在: $FIGMA_SCREENSHOT"
    exit 1
fi

if [ ! -f "$PAGE_SCREENSHOT" ]; then
    echo "❌ 页面截图文件不存在: $PAGE_SCREENSHOT"
    exit 1
fi

echo "🚀 启动设计实现对比审查"
echo "设计稿: $(basename "$FIGMA_SCREENSHOT")"
echo "实现页面: $(basename "$PAGE_SCREENSHOT")"
echo ""

# 使用 npm run review (ts-node src/cli.ts) 但需要传递参数
# 使用 npx ts-node 直接运行
npx ts-node src/cli.ts check \
  -p "$PAGE_SCREENSHOT" \
  -g "$FIGMA_SCREENSHOT" \
  --format html,markdown \
  --output ./output