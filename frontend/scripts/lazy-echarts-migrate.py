#!/usr/bin/env python3
"""
lazy-echarts-migrate.py
将所有 ECharts 组件从静态 import 改为动态 import
"""
import os
import re
import sys

ECHARTS_IMPORT_RE = re.compile(r"^import\s+echarts\s+from\s+'@/lib/echarts';\s*$", re.MULTILINE)
ECHARTS_INIT_RE = re.compile(r"(let\s+(\w+Chart):\s*echarts\.ECharts\s*\| undefined)")
ECHARTS_SETOPTION_RE = re.compile(r"(\w+Chart)\.setOption\(")

# 需要迁移的文件及对应的图表变量名
FILES_TO_MIGRATE = [
    # (file_path, [(chart_var, ref_var), ...])
    ("src/pages/Dashboard.tsx", [("lineChart", "lineRef")]),
    ("src/pages/Sentiment.tsx", []),  # 多个子组件分别处理
    ("src/pages/AlphaSignals.tsx", []),
    ("src/components/pages/FactorDashboard.tsx", []),
    ("src/components/pages/BacktestAnalysis.tsx", []),
    ("src/components/pages/PortfolioAnalysis/PortfolioOverview.tsx", []),
    ("src/components/pages/PortfolioAnalysis/RiskContribution.tsx", []),
    ("src/components/pages/PortfolioAnalysis/CorrelationMatrix.tsx", []),
    ("src/components/pages/MultiStrategyChart.tsx", []),
    ("src/components/pages/Derivatives/FuturesModule.tsx", []),
    ("src/components/pages/Derivatives/GreeksPanel.tsx", []),
    ("src/components/pages/MultiFactorChart.tsx", []),
    ("src/components/pages/BacktestProgress.tsx", []),
    ("src/components/market/SectorSentimentHeatmap.tsx", []),
    ("src/components/market/MoneyFlowPanel.tsx", []),
    ("src/components/market/SentimentTrendChart.tsx", []),
    ("src/components/market/SentimentGauge.tsx", []),
    ("src/components/market/SentimentMarketCompare.tsx", []),
    ("src/components/reports/StockReport.tsx", []),
    ("src/components/reports/BacktestReport.tsx", []),
    ("src/components/dashboard/DashboardCharts.tsx", []),
    ("src/components/charts/DepthChart.tsx", []),
    ("src/components/charts/YieldChart.tsx", []),
    ("src/components/news/NewsSentiment.tsx", []),
    ("src/components/monitors/PositionMonitor.tsx", []),
]

def migrate_file(file_path):
    """迁移单个文件"""
    full_path = os.path.join(BASE_DIR, file_path)
    if not os.path.exists(full_path):
        print(f"  ⏭️ 跳过 (不存在): {file_path}")
        return False

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. 移除静态 import
    if "import echarts from '@/lib/echarts'" not in content:
        print(f"  ⏭️ 跳过 (无静态import): {file_path}")
        return False

    content = content.replace("import echarts from '@/lib/echarts';\n", "")

    # 2. 添加动态导入辅助函数（在文件末尾或合适位置）
    # 我们在 onMount 内部做动态导入，所以不需要额外的 import 语句

    # 3. 找到所有 onMount 中调用 echarts.init 的地方，改为动态导入
    # 典型模式: chart = echarts.init(ref, 'dark', { renderer: 'canvas' });
    # 改为: const echarts = await import('@/lib/echarts'); chart = echarts.default.init(...)

    # 处理 echarts.init 调用
    content = re.sub(
        r"(?<!const\s)(?<!let\s)(?<!var\s)(?<!await\s)(?<!= )(?<!return\s)(?<!new\s)"
        r"(?<!import\s*\()"
        r"(echarts)\.init\(",
        r"(await import('@/lib/echarts')).default.init(",
        content
    )

    # 4. 处理 echarts.use 调用（如果有的话）
    content = re.sub(
        r"(?<!await\s)(?<!import\s*\()"
        r"(echarts)\.use\(",
        r"(await import('@/lib/echarts')).default.use(",
        content
    )

    # 5. 处理 echarts.graphic 引用
    content = re.sub(
        r"(?<!await\s)(?<!import\s*\()"
        r"(echarts)\.graphic",
        r"(await import('@/lib/echarts')).default.graphic",
        content
    )

    # 6. 移除 onCleanup 中可能的 echarts.dispose（保持原样）

    # 7. 如果 onMount 不是 async 的，添加 async
    # 查找 onMount(() => { ... }) 模式，如果有 await import 就改成 async
    content = re.sub(
        r"onMount\(\(\)\s*=>\s*\{",
        r"onMount(async () => {",
        content
    )

    if content != original:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ 已迁移: {file_path}")
        return True
    else:
        print(f"  ⏭️ 无变化: {file_path}")
        return False

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    SRC_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "src")

    print("开始 ECharts 懒加载迁移...")
    migrated = 0
    for file_rel in FILES_TO_MIGRATE:
        if isinstance(file_rel, tuple):
            file_path = file_rel[0]
        else:
            file_path = file_rel
        result = migrate_file(file_path)
        if result:
            migrated += 1

    print(f"\n迁移完成: {migrated}/{len(FILES_TO_MIGRATE)} 个文件")
