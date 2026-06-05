import * as vscode from 'vscode';
import { CredentialsManager } from './credentials';
import { BugzillaClient, Bug } from './client';
import { BugTreeDataProvider } from './treeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Bugzilla');
  context.subscriptions.push(outputChannel);

  const credentials = new CredentialsManager(context);

  async function createClient(): Promise<BugzillaClient | undefined> {
    const creds = await credentials.getCredentials();
    if (!creds) {
      return undefined;
    }
    return new BugzillaClient(creds.baseUrl, creds.apiKey);
  }

  const treeProvider = new BugTreeDataProvider(createClient, outputChannel);

  const treeView = vscode.window.createTreeView('bugzilla-assigned-bugs', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);

  treeView.onDidChangeVisibility((e) => {
    if (e.visible) {
      updateTreeMessage();
    }
  });

  async function updateTreeMessage(): Promise<void> {
    const creds = await credentials.getCredentials();
    if (!creds) {
      treeView.message = 'Click the key icon to set your Bugzilla credentials';
      return;
    }
    treeView.message = undefined;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.setCredentials', async () => {
      await credentials.setCredentials();
      treeProvider.refresh();
      await updateTreeMessage();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.refreshBugs', () => {
      treeProvider.refresh();
      updateTreeMessage();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bugzilla.showBugDetails', (bug: Bug) => {
      outputChannel.show(true);
      outputChannel.appendLine('=== Bug Details ===');
      outputChannel.appendLine(`ID:        ${bug.id}`);
      outputChannel.appendLine(`Summary:   ${bug.summary}`);
      outputChannel.appendLine(`Status:    ${bug.status}`);
      outputChannel.appendLine(`Severity:  ${bug.severity}`);
      outputChannel.appendLine(`Priority:  ${bug.priority}`);
      outputChannel.appendLine(`Product:   ${bug.product}`);
      outputChannel.appendLine(`Component: ${bug.component}`);
      outputChannel.appendLine(`Assigned:  ${bug.assigned_to}`);
      outputChannel.appendLine('');
    })
  );

  // Auto-load on startup if credentials exist
  if (credentials.hasCredentials()) {
    treeProvider.refresh();
  }
  updateTreeMessage();
}

export function deactivate(): void {}
