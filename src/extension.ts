import * as vscode from 'vscode';
import { CredentialsManager } from './credentials';
import { BugzillaClient, Bug, BugzillaClientError, Comment } from './client';
import { BugTreeDataProvider } from './treeProvider';
import { BugWebviewProvider } from './bugWebview';
import { FilterWebviewProvider } from './filterWebview';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Bugzilla');
  context.subscriptions.push(outputChannel);

  const credentials = new CredentialsManager(context);
  const webviewProvider = new BugWebviewProvider(context.extensionUri);
  const filterWebviewProvider = new FilterWebviewProvider(context.extensionUri);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'bugzilla.refreshBugs';
  statusBarItem.tooltip = 'Click to refresh Bugzilla bugs';
  context.subscriptions.push(statusBarItem);

  async function createClient(): Promise<BugzillaClient | undefined> {
    const creds = await credentials.getCredentials();
    if (!creds) {
      return undefined;
    }
    return new BugzillaClient(creds.baseUrl, creds.apiKey, creds.email);
  }

  webviewProvider.setUpdateHandler(async (bugId, status, resolution) => {
    const client = await createClient();
    if (!client) {
      throw new BugzillaClientError('Not connected. Set your Bugzilla credentials first.');
    }
    await client.updateBugStatus(bugId, status, resolution);
    outputChannel.appendLine(`Bugzilla: Bug ${bugId} updated to ${status}`);
    treeProvider.refresh();
  });

  const treeProvider = new BugTreeDataProvider(createClient, outputChannel);

  filterWebviewProvider.setBugsProvider(() => treeProvider.getBugs());
  filterWebviewProvider.setApplyHandler((state) => {
    treeProvider.setFilter(state);
    if (treeProvider.hasActiveFilter()) {
      treeView.message = treeProvider.getFilterDescription();
    } else {
      treeView.message = '';
    }
  });

  const treeView = vscode.window.createTreeView('bugzilla-assigned-bugs', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);

  treeView.onDidChangeVisibility((e) => {
    if (e.visible) {
      treeProvider.refresh();
      updateStatusBar();
    }
  });

  function updateStatusBar(): void {
    if (credentials.hasCredentials()) {
      statusBarItem.text = '$(bug) Bugzilla: Connected';
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = '$(bug) Bugzilla: Disconnected';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    statusBarItem.show();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.setCredentials', async () => {
      await credentials.setCredentials();
      updateStatusBar();
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.refreshBugs', () => {
      treeProvider.refresh();
      updateStatusBar();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.filterBugs', async () => {
      filterWebviewProvider.show(treeProvider.getFilterState());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.clearFilter', () => {
      treeProvider.clearFilter();
      treeView.message = '';
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.clearCredentials', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear Bugzilla credentials?',
        { modal: false },
        'Clear'
      );
      if (confirm === 'Clear') {
        await credentials.clearCredentials();
        updateStatusBar();
        treeProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.showBugWebview', async (bug: Bug) => {
      const client = await createClient();
      if (!client) {
        vscode.window.showErrorMessage('Not connected. Set your Bugzilla credentials first.');
        return;
      }

      let comments: Comment[] = [];
      try {
        comments = await client.getBugComments(bug.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Bugzilla: Failed to fetch comments for bug ${bug.id}: ${message}`);
      }

      webviewProvider.showBug(bug, comments);
    })
  );

  if (credentials.hasCredentials()) {
    treeProvider.refresh();
  }
  updateStatusBar();
}

export function deactivate(): void {}
