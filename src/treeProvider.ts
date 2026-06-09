import * as vscode from 'vscode';
import { Bug, BugzillaClient } from './client';

export interface FilterState {
  severities: string[];
  keywords: string[];
  versions: string[];
  priorities: string[];
  statuses: string[];
  products: string[];
  components: string[];
}

export class BugTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bug: Bug
  ) {
    const label = `Bug ${bug.id}`;
    const parts = [bug.summary, `[${bug.severity}]`];
    if (bug.keywords && bug.keywords.length > 0) {
      parts.push(bug.keywords.map(k => `#${k}`).join(' '));
    }
    const description = parts.join(' ');
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.tooltip = `${bug.summary}\nStatus: ${bug.status}\nSeverity: ${bug.severity}\nPriority: ${bug.priority}\nProduct: ${bug.product}\nComponent: ${bug.component}`;
    if (bug.version) {
      this.tooltip += `\nVersion: ${bug.version}`;
    }
    if (bug.keywords && bug.keywords.length > 0) {
      this.tooltip += `\nKeywords: ${bug.keywords.join(', ')}`;
    }
    this.contextValue = 'bugTreeItem';
    this.iconPath = this.getSeverityIcon(bug.severity);

    this.command = {
      command: 'bugzilla.showBugWebview',
      title: 'Show Bug Details',
      arguments: [bug]
    };
  }

  private getSeverityIcon(severity: string): vscode.ThemeIcon {
    switch (severity.toUpperCase()) {
      case 'S1':
      case 'BLOCKER':
      case 'CRITICAL':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      case 'S2':
      case 'MAJOR':
        return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
      case 'S3':
      case 'NORMAL':
        return new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
      default:
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
    }
  }
}

type TreeData = BugTreeItem[] | undefined;

export class BugTreeDataProvider implements vscode.TreeDataProvider<BugTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BugTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bugs: Bug[] = [];
  private isLoading = false;
  private errorMessage: string | undefined;
  private filterState: FilterState = { severities: [], keywords: [], versions: [], priorities: [], statuses: [], products: [], components: [] };

  constructor(
    private getClient: () => Promise<BugzillaClient | undefined>,
    private outputChannel: vscode.OutputChannel
  ) {}

  async refresh(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = undefined;
    this._onDidChangeTreeData.fire();

    const bugs = await this.loadBugs();
    this.isLoading = false;
    this.bugs = bugs;
    this._onDidChangeTreeData.fire();
  }

  private async loadBugs(): Promise<Bug[]> {
    const client = await this.getClient();
    if (!client) {
      this.errorMessage = 'Not connected. Click the key icon to set your Bugzilla credentials.';
      return [];
    }

    try {
      const email = client.email;
      this.outputChannel.appendLine(`Bugzilla: Connected as ${email}`);

      const bugs = await client.getAssignedBugs(email);
      this.outputChannel.appendLine(`Bugzilla: Found ${bugs.length} assigned bug(s)`);

      if (bugs.length === 0) {
        this.errorMessage = 'No bugs assigned to you.';
      }

      return bugs;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`Bugzilla Error: ${message}`);
      this.errorMessage = message;
      return [];
    }
  }

  getTreeItem(element: BugTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BugTreeItem): TreeData {
    if (element) {
      return [];
    }

    if (this.isLoading) {
      const item = new vscode.TreeItem('Loading...');
      item.iconPath = new vscode.ThemeIcon('loading~spin');
      return [item as unknown as BugTreeItem];
    }

    if (this.errorMessage) {
      const item = new vscode.TreeItem(this.errorMessage);
      item.iconPath = new vscode.ThemeIcon('warning');
      return [item as unknown as BugTreeItem];
    }

    const filtered = this.applyFilter(this.bugs);
    if (filtered.length === 0) {
      const message = this.hasActiveFilter()
        ? 'No bugs match the current filter'
        : 'No bugs found';
      const item = new vscode.TreeItem(message);
      item.iconPath = new vscode.ThemeIcon(this.hasActiveFilter() ? 'filter' : 'check');
      return [item as unknown as BugTreeItem];
    }

    return filtered.map((bug) => new BugTreeItem(bug));
  }

  private applyFilter(bugs: Bug[]): Bug[] {
    const { severities, keywords, versions, priorities, statuses, products, components } = this.filterState;

    if (!this.hasActiveFilter()) {
      return bugs;
    }

    return bugs.filter((bug) => {
      if (severities.length > 0 && !severities.some(
        (s) => s.toLowerCase() === bug.severity.toLowerCase()
      )) {
        return false;
      }

      if (priorities.length > 0 && !priorities.some(
        (p) => p.toLowerCase() === bug.priority.toLowerCase()
      )) {
        return false;
      }

      if (statuses.length > 0 && !statuses.some(
        (s) => s.toLowerCase() === bug.status.toLowerCase()
      )) {
        return false;
      }

      if (products.length > 0 && !products.some(
        (p) => p.toLowerCase() === bug.product.toLowerCase()
      )) {
        return false;
      }

      if (components.length > 0 && !components.some(
        (c) => c.toLowerCase() === bug.component.toLowerCase()
      )) {
        return false;
      }

      if (versions.length > 0 && !versions.some(
        (v) => v.toLowerCase() === (bug.version || '').toLowerCase()
      )) {
        return false;
      }

      if (keywords.length > 0) {
        const matchesKeyword = keywords.some((kw) => {
          const lowerKw = kw.toLowerCase();
          const inKeywords = bug.keywords?.some((bk) =>
            bk.toLowerCase().includes(lowerKw)
          );
          const inSummary = bug.summary.toLowerCase().includes(lowerKw);
          return inKeywords || inSummary;
        });
        if (!matchesKeyword) {
          return false;
        }
      }

      return true;
    });
  }

  setFilter(state: FilterState): void {
    this.filterState = state;
    vscode.commands.executeCommand('setContext', 'bugzilla.filterActive', this.hasActiveFilter());
    this._onDidChangeTreeData.fire();
  }

  clearFilter(): void {
    this.filterState = { severities: [], keywords: [], versions: [], priorities: [], statuses: [], products: [], components: [] };
    vscode.commands.executeCommand('setContext', 'bugzilla.filterActive', false);
    this._onDidChangeTreeData.fire();
  }

  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  hasActiveFilter(): boolean {
    return (
      this.filterState.severities.length > 0 ||
      this.filterState.keywords.length > 0 ||
      this.filterState.versions.length > 0 ||
      this.filterState.priorities.length > 0 ||
      this.filterState.statuses.length > 0 ||
      this.filterState.products.length > 0 ||
      this.filterState.components.length > 0
    );
  }

  getFilterDescription(): string {
    const parts: string[] = [];
    if (this.filterState.severities.length > 0) {
      parts.push(`Severity: ${this.filterState.severities.join(', ')}`);
    }
    if (this.filterState.priorities.length > 0) {
      parts.push(`Priority: ${this.filterState.priorities.join(', ')}`);
    }
    if (this.filterState.statuses.length > 0) {
      parts.push(`Status: ${this.filterState.statuses.join(', ')}`);
    }
    if (this.filterState.products.length > 0) {
      parts.push(`Product: ${this.filterState.products.join(', ')}`);
    }
    if (this.filterState.components.length > 0) {
      parts.push(`Component: ${this.filterState.components.join(', ')}`);
    }
    if (this.filterState.versions.length > 0) {
      parts.push(`Version: ${this.filterState.versions.join(', ')}`);
    }
    if (this.filterState.keywords.length > 0) {
      parts.push(`Keywords: ${this.filterState.keywords.join(', ')}`);
    }
    return parts.length > 0 ? `$(filter) ${parts.join(' | ')}` : '';
  }

  getBugs(): Bug[] {
    return this.bugs;
  }

  getParent(): undefined {
    return undefined;
  }

  getErrorMessage(): string | undefined {
    return this.errorMessage;
  }

  isLoadingBugs(): boolean {
    return this.isLoading;
  }
}
