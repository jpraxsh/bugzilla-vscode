import * as vscode from 'vscode';
import { Bug, Comment } from './client';

const STATUSES = ['UNCONFIRMED','CONFIRMED', 'NEW', 'ASSIGNED', 'REOPENED', 'RESOLVED', 'VERIFIED', 'CLOSED'];
const TERMINAL_STATUSES = ['RESOLVED', 'VERIFIED', 'CLOSED'];
const RESOLUTIONS = ['', 'FIXED', 'INVALID', 'WONTFIX', 'DUPLICATE', 'WORKSFORME'];

interface BugData {
  bug: Bug;
  comments: Comment[];
}

export class BugWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentBug: Bug | undefined;
  private onUpdateStatus: ((bugId: number, status: string, resolution?: string) => Promise<void>) | undefined;

  constructor(private extensionUri: vscode.Uri) {}

  setUpdateHandler(handler: (bugId: number, status: string, resolution?: string) => Promise<void>): void {
    this.onUpdateStatus = handler;
  }

  showBug(bug: Bug, comments: Comment[]): void {
    this.currentBug = bug;

    if (this.panel) {
      this.panel.title = `Bug ${bug.id}`;
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'bugzillaBugDetails',
        `Bug ${bug.id}`,
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentBug = undefined;
      });

      this.panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'updateStatus' && this.onUpdateStatus && this.currentBug) {
          try {
            await this.onUpdateStatus(
              this.currentBug.id,
              message.status,
              message.resolution || undefined
            );
            this.panel?.webview.postMessage({
              command: 'statusUpdated',
              success: true,
              status: message.status,
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.panel?.webview.postMessage({
              command: 'statusUpdated',
              success: false,
              message: errorMsg,
            });
          }
        }
      });
    }

    this.panel.webview.html = this.getHtml({ bug, comments });
  }

  private getHtml(data: BugData): string {
    const { bug, comments } = data;
    const severityColor = this.getSeverityColor(bug.severity);
    const priorityColor = this.getPriorityColor(bug.priority);
    const isTerminal = TERMINAL_STATUSES.includes(bug.status);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bug ${bug.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .tab {
      padding: 8px 16px;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--vscode-foreground);
      font-family: inherit;
      font-size: inherit;
      border-bottom: 2px solid transparent;
      opacity: 0.7;
    }
    .tab.active {
      opacity: 1;
      border-bottom-color: var(--vscode-focusBorder);
    }
    .tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    .tab-content { display: none; padding: 16px; }
    .tab-content.active { display: block; }

    .field-table { width: 100%; border-collapse: collapse; }
    .field-table td { padding: 6px 8px; vertical-align: top; }
    .field-table td:first-child {
      width: 120px;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
    }
    .badge-severity { background: ${severityColor}; }
    .badge-priority { background: ${priorityColor}; }

    .status-section {
      margin-top: 16px;
      padding: 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
    }
    .status-section label {
      display: block;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .status-row {
      display: flex;
      gap: 12px;
      align-items: end;
      flex-wrap: wrap;
    }
    .status-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    select, button {
      font-family: inherit;
      font-size: inherit;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
    }
    select:focus, button:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    button {
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .update-status-msg {
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 3px;
      font-size: 12px;
    }
    .update-status-msg.success {
      background: var(--vscode-testing-iconPassed);
      color: #fff;
    }
    .update-status-msg.error {
      background: var(--vscode-testing-iconFailed);
      color: #fff;
    }

    .comment {
      padding: 12px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .comment:last-child { border-bottom: none; }
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .comment-author { font-weight: 600; }
    .comment-text {
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .placeholder {
      padding: 32px 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state { padding: 24px 16px; text-align: center; color: var(--vscode-descriptionForeground); }

    .summary-header {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    .error-toast {
      position: fixed;
      bottom: 16px;
      right: 16px;
      padding: 10px 16px;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
      font-size: 13px;
      max-width: 400px;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="tabs">
    <button class="tab active" data-tab="details">Details</button>
    <button class="tab" data-tab="comments">Comments (${comments.length})</button>
    <button class="tab" data-tab="history">History</button>
  </div>

  <div class="tab-content active" id="tab-details">
    <div class="summary-header">${this.escapeHtml(bug.summary)}</div>
    <table class="field-table">
      <tr><td>Bug ID</td><td><strong>${bug.id}</strong></td></tr>
      <tr><td>Status</td><td>${bug.status}</td></tr>
      <tr><td>Severity</td><td><span class="badge badge-severity">${bug.severity}</span></td></tr>
      <tr><td>Priority</td><td><span class="badge badge-priority">${bug.priority}</span></td></tr>
      <tr><td>Product</td><td>${this.escapeHtml(bug.product)}</td></tr>
      <tr><td>Component</td><td>${this.escapeHtml(bug.component)}</td></tr>
      <tr><td>Assigned To</td><td>${this.escapeHtml(bug.assigned_to)}</td></tr>
    </table>

    <div class="status-section">
      <div class="status-row">
        <div class="status-field">
          <label for="status-select">Status</label>
          <select id="status-select">
            ${STATUSES.map((s) => `<option value="${s}" ${s === bug.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="status-field" id="resolution-field" style="display: ${isTerminal ? 'flex' : 'none'}">
          <label for="resolution-select">Resolution</label>
          <select id="resolution-select">
            ${RESOLUTIONS.map((r) => `<option value="${r}">${r || '-- Select --'}</option>`).join('')}
          </select>
        </div>
        <div class="status-field">
          <label>&nbsp;</label>
          <button id="update-btn">Update Status</button>
        </div>
      </div>
      <div id="update-msg"></div>
    </div>
  </div>

  <div class="tab-content" id="tab-comments">
    ${comments.length === 0
      ? '<div class="empty-state">No comments on this bug.</div>'
      : comments.map((c) => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-author">${this.escapeHtml(c.creator)}</span>
            <span>${c.creation_time}</span>
          </div>
          <div class="comment-text">${this.escapeHtml(c.text)}</div>
        </div>
      `).join('')}
  </div>

  <div class="tab-content" id="tab-history">
    <div class="placeholder">Bug history will be available in a future update.</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Show/hide resolution based on status
    document.getElementById('status-select').addEventListener('change', (e) => {
      const terminalStatuses = ${JSON.stringify(TERMINAL_STATUSES)};
      const resolutionField = document.getElementById('resolution-field');
      if (terminalStatuses.includes(e.target.value)) {
        resolutionField.style.display = 'flex';
      } else {
        resolutionField.style.display = 'none';
      }
    });

    // Update status
    document.getElementById('update-btn').addEventListener('click', () => {
      const status = document.getElementById('status-select').value;
      const resolution = document.getElementById('resolution-select').value;
      const btn = document.getElementById('update-btn');
      btn.disabled = true;
      btn.textContent = 'Updating...';
      vscode.postMessage({ command: 'updateStatus', status, resolution });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'statusUpdated') {
        const display = document.getElementById('update-msg');
        display.className = 'update-status-msg ' + (msg.success ? 'success' : 'error');
        display.textContent = msg.success
          ? 'Status updated to ' + msg.status
          : 'Update failed: ' + (msg.message || 'Unknown error');
        const btn = document.getElementById('update-btn');
        btn.disabled = false;
        btn.textContent = 'Update Status';
        if (msg.success) {
          const statusSelect = document.getElementById('status-select');
          // update selected option
          statusSelect.value = msg.status;
          // trigger change to update resolution field visibility
          statusSelect.dispatchEvent(new Event('change'));
        }
        setTimeout(() => { display.textContent = ''; display.className = ''; }, 5000);
      }
    });
  </script>
</body>
</html>`;
  }

  private getSeverityColor(severity: string): string {
    switch (severity.toUpperCase()) {
      case 'S1': case 'BLOCKER': case 'CRITICAL': return '#d73a49';
      case 'S2': case 'MAJOR': return '#dbab0a';
      case 'S3': case 'NORMAL': return '#0366d6';
      default: return '#586069';
    }
  }

  private getPriorityColor(priority: string): string {
    switch (priority.toUpperCase()) {
      case 'P1': case 'HIGHEST': return '#d73a49';
      case 'P2': case 'HIGH': return '#dbab0a';
      case 'P3': case 'MEDIUM': return '#0366d6';
      default: return '#586069';
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
