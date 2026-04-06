import { Component } from 'solid-js';
import { actions } from '../../stores';

export const ConnectDialog: Component = () => {
  return (
    <div class="dialog-overlay" onClick={(e) => e.target === e.currentTarget && actions.ui.toggleDialog('connect')}>
      <div class="dialog-panel">
        <div class="dialog-header">
          <span class="text-sm font-bold text-[var(--text-primary)]">连接网关</span>
          <button class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none" onClick={() => actions.ui.toggleDialog('connect')}>×</button>
        </div>
        <div class="dialog-body space-y-4">
          <div class="form-group">
            <label class="form-label">网关类型</label>
            <select class="form-input">
              <option value="DUCKDB_SIM">DUCKDB_SIM — 模拟交易</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">网关名称</label>
            <input class="form-input" type="text" placeholder="DUCKDB_SIM" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" onClick={() => actions.ui.toggleDialog('connect')}>取消</button>
          <button class="btn btn-primary">连接</button>
        </div>
      </div>
    </div>
  );
};
