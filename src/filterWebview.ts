import * as vscode from 'vscode';
import { Bug } from './client';
import { FilterState } from './treeProvider';

const FIELD_DEFS: { id: string; label: string; operators: string[] }[] = [
  { id: 'severity', label: 'Severity', operators: ['equals', 'not equals'] },
  { id: 'keywords', label: 'Keywords', operators: ['contains', 'not contains'] },
  { id: 'summary', label: 'Summary', operators: ['contains', 'not contains'] },
  { id: 'version', label: 'Version', operators: ['equals', 'not equals'] },
  { id: 'priority', label: 'Priority', operators: ['equals', 'not equals'] },
  { id: 'status', label: 'Status', operators: ['equals', 'not equals'] },
  { id: 'product', label: 'Product', operators: ['equals', 'not equals'] },
  { id: 'component', label: 'Component', operators: ['equals', 'not equals'] },
];

interface FilterRow {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface FilterData {
  rows: FilterRow[];
  availableValues: Record<string, string[]>;
  matchCount: number;
  totalCount: number;
}

export class FilterWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private onApplyFilter: ((state: FilterState) => void) | undefined;
  private getBugs: (() => Bug[]) | undefined;
  private currentState: FilterState | undefined;

  constructor(private extensionUri: vscode.Uri) {}

  setApplyHandler(handler: (state: FilterState) => void): void {
    this.onApplyFilter = handler;
  }

  setBugsProvider(provider: () => Bug[]): void {
    this.getBugs = provider;
  }

  show(currentState: FilterState): void {
    this.currentState = currentState;

    const bugs = this.getBugs?.() ?? [];
    const availableValues = this.computeAvailableValues(bugs);
    const rows = this.stateToRows(currentState);

    const matchCount = rows.length > 0
      ? this.computeMatchCount(bugs, rows)
      : bugs.length;

    const data: FilterData = { rows, availableValues, matchCount, totalCount: bugs.length };

    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'bugzillaFilter',
        'Filter Bugs',
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case 'apply': {
            const filterRows: FilterRow[] = message.rows;
            const state = this.rowsToState(filterRows);
            this.currentState = state;
            this.onApplyFilter?.(state);
            break;
          }
          case 'clear': {
            const empty = { severities: [], keywords: [], versions: [], priorities: [], statuses: [], products: [], components: [] };
            this.currentState = empty;
            this.onApplyFilter?.(empty);
            this.panel?.webview.postMessage({
              command: 'clearApplied',
              rows: [],
              hasFilter: false,
            });
            break;
          }
          case 'refreshValues': {
            const freshBugs = this.getBugs?.() ?? [];
            const freshValues = this.computeAvailableValues(freshBugs);
            this.panel?.webview.postMessage({
              command: 'valuesUpdated',
              availableValues: freshValues,
              totalCount: freshBugs.length,
            });
            break;
          }
          case 'preview': {
            const filterRows: FilterRow[] = message.rows;
            const freshBugs = this.getBugs?.() ?? [];
            const count = filterRows.length > 0
              ? this.computeMatchCount(freshBugs, filterRows)
              : freshBugs.length;
            this.panel?.webview.postMessage({ command: 'previewCount', count });
            break;
          }
        }
      });
    }

    this.panel.webview.html = this.getHtml(data);
  }

  private computeAvailableValues(bugs: Bug[]): Record<string, string[]> {
    const sets: Record<string, Set<string>> = {};
    for (const f of FIELD_DEFS) {
      sets[f.id] = new Set();
    }

    const severityOrder = ['S1', 'CRITICAL', 'BLOCKER', 'S2', 'MAJOR', 'S3', 'NORMAL', 'S4', 'MINOR', 'TRIVIAL', 'ENHANCEMENT'];

    for (const bug of bugs) {
      sets.severity.add(bug.severity);
      sets.priority.add(bug.priority);
      sets.status.add(bug.status);
      sets.product.add(bug.product);
      sets.component.add(bug.component);
      if (bug.version) sets.version.add(bug.version);
    }

    const result: Record<string, string[]> = {};
    for (const f of FIELD_DEFS) {
      const vals = [...sets[f.id]];
      if (f.id === 'severity') {
        vals.sort((a, b) => {
          const ai = severityOrder.indexOf(a);
          const bi = severityOrder.indexOf(b);
          if (ai === -1 && bi === -1) return a.localeCompare(b);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
      } else {
        vals.sort((a, b) => a.localeCompare(b));
      }
      result[f.id] = vals;
    }

    return result;
  }

  private stateToRows(state: FilterState): FilterRow[] {
    const rows: FilterRow[] = [];
    let id = 0;
    for (const s of state.severities) {
      rows.push({ id: `r${id++}`, field: 'severity', operator: 'equals', value: s });
    }
    for (const s of state.priorities) {
      rows.push({ id: `r${id++}`, field: 'priority', operator: 'equals', value: s });
    }
    for (const s of state.statuses) {
      rows.push({ id: `r${id++}`, field: 'status', operator: 'equals', value: s });
    }
    for (const s of state.products) {
      rows.push({ id: `r${id++}`, field: 'product', operator: 'equals', value: s });
    }
    for (const s of state.components) {
      rows.push({ id: `r${id++}`, field: 'component', operator: 'equals', value: s });
    }
    for (const s of state.versions) {
      rows.push({ id: `r${id++}`, field: 'version', operator: 'equals', value: s });
    }
    for (const s of state.keywords) {
      rows.push({ id: `r${id++}`, field: 'keywords', operator: 'contains', value: s });
    }
    return rows;
  }

  private rowsToState(rows: FilterRow[]): FilterState {
    const state: FilterState = {
      severities: [],
      keywords: [],
      versions: [],
      priorities: [],
      statuses: [],
      products: [],
      components: [],
    };
    for (const row of rows) {
      switch (row.field) {
        case 'severity': state.severities.push(row.value); break;
        case 'priority': state.priorities.push(row.value); break;
        case 'status': state.statuses.push(row.value); break;
        case 'product': state.products.push(row.value); break;
        case 'component': state.components.push(row.value); break;
        case 'version': state.versions.push(row.value); break;
        case 'keywords': case 'summary': state.keywords.push(row.value); break;
      }
    }
    return state;
  }

  private computeMatchCount(bugs: Bug[], rows: FilterRow[]): number {
    let count = 0;
    for (const bug of bugs) {
      let matches = true;
      for (const row of rows) {
        if (!this.rowMatches(bug, row)) {
          matches = false;
          break;
        }
      }
      if (matches) count++;
    }
    return count;
  }

  private rowMatches(bug: Bug, row: FilterRow): boolean {
    const fieldVal = this.getBugField(bug, row.field);
    const rowVal = row.value.toLowerCase();

    if (row.operator === 'equals') {
      return fieldVal.toLowerCase() === rowVal;
    }
    if (row.operator === 'not equals') {
      return fieldVal.toLowerCase() !== rowVal;
    }
    if (row.operator === 'contains') {
      return fieldVal.toLowerCase().includes(rowVal);
    }
    if (row.operator === 'not contains') {
      return !fieldVal.toLowerCase().includes(rowVal);
    }
    return true;
  }

  private getBugField(bug: Bug, field: string): string {
    switch (field) {
      case 'severity': return bug.severity;
      case 'priority': return bug.priority;
      case 'status': return bug.status;
      case 'product': return bug.product;
      case 'component': return bug.component;
      case 'version': return bug.version || '';
      case 'keywords': return (bug.keywords || []).join(' ') + ' ' + bug.summary;
      case 'summary': return bug.summary;
      default: return '';
    }
  }

  private getHtml(data: FilterData): string {
    const fieldDefsJson = JSON.stringify(FIELD_DEFS);
    const dataJson = JSON.stringify(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Filter Bugs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .header h2 {
      font-size: 16px;
      font-weight: 600;
    }
    .header-actions {
      display: flex;
      gap: 8px;
    }

    button {
      font-family: inherit;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 2px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--vscode-input-border);
    }
    button:focus { outline: 1px solid var(--vscode-focusBorder); }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }

    .btn-secondary {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .btn-secondary:hover { background: var(--vscode-list-hoverBackground); }

    .btn-danger {
      background: transparent;
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }
    .btn-danger:hover {
      background: var(--vscode-inputValidation-errorBackground);
    }

    .filter-rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      animation: slideIn 0.15s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .field-select {
      width: 130px;
      flex-shrink: 0;
    }
    .operator-select {
      width: 120px;
      flex-shrink: 0;
    }
    .value-select, .value-input {
      flex: 1;
      min-width: 120px;
    }

    select, input {
      font-family: inherit;
      font-size: 13px;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
    }
    select:focus, input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .remove-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .remove-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .add-filter-area {
      margin-bottom: 16px;
    }
    .add-filter-btn {
      width: 100%;
      padding: 8px;
      border: 1px dashed var(--vscode-input-border);
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
    }
    .add-filter-btn:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
      border-style: solid;
    }

    .match-count {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    .match-count strong {
      color: var(--vscode-foreground);
      font-size: 15px;
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state .icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }
    .empty-state p {
      font-size: 13px;
      margin-bottom: 12px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .chip-active {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Filter Bugs</h2>
    <div class="header-actions">
      <button class="btn-secondary" id="clearBtn" title="Clear all filters">Clear All</button>
      <button class="btn-primary" id="applyBtn">Apply Filters</button>
    </div>
  </div>

  <div class="filter-rows" id="filterRows"></div>

  <div class="add-filter-area">
    <button class="add-filter-btn" id="addFilterBtn">+ Add Filter</button>
  </div>

  <div class="footer">
    <div class="match-count" id="matchCount"></div>
    <button class="btn-secondary" id="applyBtn2">Apply Filters</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const fieldDefs = ${fieldDefsJson};
    let data = ${dataJson};
    let rows = data.rows || [];
    let rowCounter = rows.length;

    const filterRowsEl = document.getElementById('filterRows');
    const matchCountEl = document.getElementById('matchCount');

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function getValuesForField(fieldId) {
      if (fieldId === 'keywords' || fieldId === 'summary') return [];
      return data.availableValues[fieldId] || [];
    }

    function usesValueInput(fieldId) {
      return fieldId === 'keywords' || fieldId === 'summary';
    }

    function getFieldDef(fieldId) {
      return fieldDefs.find(function(f) { return f.id === fieldId; });
    }

    function renderRows() {
      filterRowsEl.innerHTML = '';

      if (rows.length === 0) {
        filterRowsEl.innerHTML = '<div class="empty-state"><div class="icon">&#x1F50D;</div><p>No filters applied. Showing all bugs.</p><p>Click <strong>+ Add Filter</strong> to start.</p></div>';
      } else {
        rows.forEach(function(row, index) {
          const fieldDef = getFieldDef(row.field);
          const operators = fieldDef ? fieldDef.operators : ['equals'];
          const values = getValuesForField(row.field);
          const usesInput = usesValueInput(row.field);

          const rowEl = document.createElement('div');
          rowEl.className = 'filter-row';

          let valHtml = '';
          if (usesInput) {
            valHtml = '<input class="value-input" type="text" value="' + escapeHtml(row.value) + '" placeholder="Type keyword...">';
          } else {
            valHtml = '<select class="value-select">' +
              values.map(function(v) {
                return '<option value="' + escapeHtml(v) + '"' + (v === row.value ? ' selected' : '') + '>' + escapeHtml(v) + '</option>';
              }).join('') +
              '</select>';
          }

          rowEl.innerHTML =
            '<select class="field-select">' +
              fieldDefs.map(function(f) {
                return '<option value="' + f.id + '"' + (f.id === row.field ? ' selected' : '') + '>' + f.label + '</option>';
              }).join('') +
            '</select>' +
            '<select class="operator-select">' +
              operators.map(function(op) {
                return '<option value="' + op + '"' + (op === row.operator ? ' selected' : '') + '>' + op + '</option>';
              }).join('') +
            '</select>' +
            valHtml +
            '<button class="remove-btn" title="Remove">&times;</button>';

          // event handlers
          const fieldSelect = rowEl.querySelector('.field-select');
          const opSelect = rowEl.querySelector('.operator-select');
          const removeBtn = rowEl.querySelector('.remove-btn');
          const valueEl = usesInput ? rowEl.querySelector('.value-input') : rowEl.querySelector('.value-select');

          fieldSelect.addEventListener('change', function() {
            var newField = this.value;
            var newDef = getFieldDef(newField);
            var newValues = getValuesForField(newField);
            var defaultVal = newValues.length > 0 ? newValues[0] : '';
            rows[index].field = newField;
            rows[index].operator = newDef.operators[0];
            rows[index].value = defaultVal;
            renderRows();
          });

          opSelect.addEventListener('change', function() {
            rows[index].operator = this.value;
            requestPreview();
          });

          valueEl.addEventListener(usesInput ? 'input' : 'change', function() {
            rows[index].value = this.value;
            requestPreview();
          });

          removeBtn.addEventListener('click', function() {
            rows.splice(index, 1);
            renderRows();
            requestPreview();
          });

          filterRowsEl.appendChild(rowEl);
        });
      }

      updateMatchCount();
    }

    function requestPreview() {
      // small debounce
      if (requestPreview._timer) clearTimeout(requestPreview._timer);
      requestPreview._timer = setTimeout(function() {
        vscode.postMessage({ command: 'preview', rows: rows });
      }, 150);
    }

    function updateMatchCount() {
      if (rows.length === 0) {
        matchCountEl.innerHTML = 'Showing all <strong>' + data.totalCount + '</strong> bugs';
      } else {
        matchCountEl.innerHTML = 'Matching: <strong>' + data.matchCount + '</strong> of ' + data.totalCount + ' bugs';
      }
    }

    function addRow() {
      var fieldId = 'severity';
      var values = getValuesForField(fieldId);
      var defaultValue = values.length > 0 ? values[0] : '';
      rows.push({
        id: 'r' + (rowCounter++),
        field: fieldId,
        operator: 'equals',
        value: defaultValue
      });
      renderRows();
      requestPreview();
    }

    document.getElementById('addFilterBtn').addEventListener('click', addRow);

    document.getElementById('applyBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'apply', rows: rows });
    });
    document.getElementById('applyBtn2').addEventListener('click', function() {
      vscode.postMessage({ command: 'apply', rows: rows });
    });

    document.getElementById('clearBtn').addEventListener('click', function() {
      rows = [];
      renderRows();
      vscode.postMessage({ command: 'clear', rows: [] });
    });

    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (msg.command === 'previewCount') {
        data.matchCount = msg.count;
        updateMatchCount();
      }
      if (msg.command === 'clearApplied') {
        rows = msg.rows || [];
        renderRows();
        data.matchCount = data.totalCount;
        updateMatchCount();
      }
      if (msg.command === 'valuesUpdated') {
        data.availableValues = msg.availableValues;
        data.totalCount = msg.totalCount;
        if (rows.length === 0) {
          data.matchCount = msg.totalCount;
        }
        renderRows();
      }
    });

    // initial render
    renderRows();
    if (rows.length > 0) {
      vscode.postMessage({ command: 'preview', rows: rows });
    }
  </script>
</body>
</html>`;
  }
}
