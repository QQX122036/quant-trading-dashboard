import { Component } from 'solid-js';

export const TestPage: Component = () => {
  return (
    <div class="p-8 bg-red-900/20 border border-red-500/30 rounded-lg m-4">
      <h1 class="text-3xl font-bold text-red-400 mb-4">✅ 测试页面</h1>
      <p class="text-white mb-2">如果你看到这个红色边框的页面，说明:</p>
      <ul class="list-disc list-inside text-gray-300 space-y-1">
        <li>✅ 路由配置正常</li>
        <li>✅ 组件渲染正常</li>
        <li>✅ 样式加载正常</li>
      </ul>
      <div class="mt-4 p-4 bg-white/5 rounded border border-white/10">
        <p class="text-sm text-gray-400">当前时间：{new Date().toLocaleString('zh-CN')}</p>
        <p class="text-sm text-gray-400">路径：/test</p>
      </div>
    </div>
  );
};
