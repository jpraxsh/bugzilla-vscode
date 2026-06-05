import * as vscode from 'vscode';
import { Bug, BugzillaClient } from './client';

export class BugTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bug: Bug
  ) {
    const label = `Bug ${bug.id}`;
    const description = `${bug.summary} [${bug.severity}]`;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.tooltip = `${bug.summary}\nStatus: ${bug.status}\nSeverity: ${bug.severity}\nPriority: ${bug.priority}\nProduct: ${bug.product}\nComponent: ${bug.component}`;
    this.contextValue = 'bugTreeItem';
    this.iconPath = this.getSeverityIcon(bug.severity);

    this.command = {
      command: 'bugzilla.showBugDetails',
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

export class BugTreeDataProvider implements vscode.TreeDataProvider<BugTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BugTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private errorMessage: string | undefined;

  constructor(
    private getClient: () => Promise<BugzillaClient | undefined>,
    private outputChannel: vscode.OutputChannel
  ) {}

  refresh(): void {
    this.errorMessage = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BugTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BugTreeItem): Promise<BugTreeItem[]> {
    if (element) {
      return [];
    }

    const client = await this.getClient();
    if (!client) {
      this.errorMessage = 'Not connected. Set your Bugzilla credentials first.';
      return [];
    }

    try {
      const user = await client.whoami();
      this.outputChannel.appendLine(`Bugzilla: Connected as ${user.real_name} (${user.email})`);

      const bugs = await client.getAssignedBugs(user.email);
      this.outputChannel.appendLine(`Bugzilla: Found ${bugs.length} assigned bug(s)`);

      if (bugs.length === 0) {
        this.errorMessage = 'No bugs assigned to you.';
        return [];
      }

      return bugs.map((bug) => new BugTreeItem(bug));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`Bugzilla Error: ${message}`);
      this.errorMessage = message;
      return [];
    }
  }

  getParent(): undefined {
    return undefined;
  }

  getErrorMessage(): string | undefined {
    return this.errorMessage;
  }
}
