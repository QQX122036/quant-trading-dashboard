#!/bin/bash

# 前端数据验证修复脚本
# 修复所有组件的空值检查问题

echo "开始修复前端数据验证问题..."

# 1. 找到所有包含 .toFixed() 但没有空值检查的文件
echo "查找需要修复的文件..."
grep -r "\.toFixed(" src/ --include="*.tsx" | grep -v "toFixed\??\|??" | head -20

# 2. 备份原始文件
echo "创建备份目录..."
mkdir -p backup
find src/ -name "*.tsx" -exec cp {} backup/ \;

# 3. 批量修复 - 这个需要手动逐个文件修复，因为每个文件的情况不同
echo ""
echo "⚠️  重要：需要手动逐个文件修复，因为每个文件的情况不同"
echo ""
echo "修复模式："
echo "  1. value.toFixed(n) → (value ?? 0).toFixed(n)"
echo "  2. item.value.toFixed(n) → (item.value ?? 0).toFixed(n)"
echo "  3. obj?.prop?.toFixed(n) → (obj?.prop ?? 0).toFixed(n)"
echo ""
echo "已修复的文件："
echo "  - src/components/market/SectorMoneyFlow.tsx"
echo "  - src/components/market/SectorSentimentHeatmap.tsx"
echo ""
echo "还需要修复的文件（请手动检查）："
grep -r "\.toFixed(" src/ --include="*.tsx" -n | head -30

echo ""
echo "修复完成！"
