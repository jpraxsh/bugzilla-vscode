import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode before importing modules that use it
const mockGlobalState = {
  _store: new Map<string, any>(),
  get: vi.fn().mockImplementation((key: string) => mockGlobalState._store.get(key)),
  update: vi.fn().mockImplementation(async (key: string, value: any) => {
    mockGlobalState._store.set(key, value);
    return Promise.resolve();
  }),
};

const mockSecrets = {
  _store: new Map<string, string | undefined>(),
  get: vi.fn().mockImplementation(async (key: string) => mockSecrets._store.get(key)),
  store: vi.fn().mockImplementation(async (key: string, value: string) => {
    mockSecrets._store.set(key, value);
    return Promise.resolve();
  }),
  delete: vi.fn().mockImplementation(async (key: string) => {
    mockSecrets._store.delete(key);
    return Promise.resolve();
  }),
};

const mockContext = {
  globalState: mockGlobalState,
  secrets: mockSecrets,
  subscriptions: [],
  extensionUri: {} as any,
} as any;

// Setup vi.mock BEFORE importing
vi.mock('vscode', () => ({
  window: {
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createOutputChannel: vi.fn().mockReturnValue({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    }),
    createWebviewPanel: vi.fn().mockReturnValue({
      title: '',
      reveal: vi.fn(),
      dispose: vi.fn(),
      onDidDispose: vi.fn(),
      webview: {
        html: '',
        onDidReceiveMessage: vi.fn(),
        postMessage: vi.fn(),
        asWebviewUri: vi.fn().mockImplementation((uri: any) => uri),
      },
    }),
    createStatusBarItem: vi.fn().mockReturnValue({
      show: vi.fn(),
      dispose: vi.fn(),
      command: '',
      tooltip: '',
      text: '',
    }),
    createTreeView: vi.fn().mockReturnValue({
      dispose: vi.fn(),
      onDidChangeVisibility: vi.fn(),
    }),
  },
  ThemeIcon: class {
    constructor(public id: string, public color?: any) {}
  },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  TreeItem: class {
    label?: string;
    description?: string;
    tooltip?: string;
    contextValue?: string;
    iconPath?: any;
    command?: any;
    collapsibleState = 0;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      if (collapsibleState !== undefined) this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ViewColumn: { One: 1, Two: 2 },
  StatusBarAlignment: { Right: 2 },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  ExtensionContext: class {},
}));

import * as vscode from 'vscode';
import { CredentialsManager } from '../credentials';
import { BugTreeDataProvider, BugTreeItem } from '../treeProvider';
import { BugzillaClient } from '../client';

beforeEach(() => {
  mockGlobalState._store.clear();
  mockSecrets._store.clear();
  vi.clearAllMocks();
});

// --- CredentialsManager ---
describe('CredentialsManager', () => {
  describe('setBaseUrl / getBaseUrl', () => {
    it('stores and retrieves base URL via globalState', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugzilla.example.com');
      expect(mockGlobalState.update).toHaveBeenCalledWith('bugzilla.baseUrl', 'https://bugzilla.example.com');
      expect(cm.getBaseUrl()).toBe('https://bugzilla.example.com');
    });

    it('returns undefined when no base URL set', () => {
      const cm = new CredentialsManager(mockContext);
      expect(cm.getBaseUrl()).toBeUndefined();
    });

    it('overwrites existing base URL', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://old.example.com');
      await cm.setBaseUrl('https://new.example.com');
      expect(cm.getBaseUrl()).toBe('https://new.example.com');
    });
  });

  describe('setApiKey / getApiKey', () => {
    it('stores API key in SecretStorage and retrieves it', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setApiKey('secret-key-123');
      expect(mockSecrets.store).toHaveBeenCalledWith('bugzilla.apiKey', 'secret-key-123');
      expect(await cm.getApiKey()).toBe('secret-key-123');
    });

    it('returns undefined when no API key set', async () => {
      const cm = new CredentialsManager(mockContext);
      expect(await cm.getApiKey()).toBeUndefined();
    });
  });

  describe('setEmail / getEmail', () => {
    it('stores email in globalState and retrieves it', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setEmail('user@example.com');
      expect(mockGlobalState.update).toHaveBeenCalledWith('bugzilla.email', 'user@example.com');
      expect(cm.getEmail()).toBe('user@example.com');
    });

    it('returns undefined when no email set', () => {
      const cm = new CredentialsManager(mockContext);
      expect(cm.getEmail()).toBeUndefined();
    });
  });

  describe('getCredentials', () => {
    it('returns all credentials when all three are set', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com/');
      await cm.setApiKey('key-abc');
      await cm.setEmail('user@example.com');

      const creds = await cm.getCredentials();
      expect(creds).toEqual({
        baseUrl: 'https://bugs.example.com', // trailing slash stripped
        apiKey: 'key-abc',
        email: 'user@example.com',
      });
    });

    it('returns undefined when baseUrl is missing', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setApiKey('key');
      await cm.setEmail('user@example.com');

      const creds = await cm.getCredentials();
      expect(creds).toBeUndefined();
    });

    it('returns undefined when apiKey is missing', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');
      await cm.setEmail('user@example.com');

      const creds = await cm.getCredentials();
      expect(creds).toBeUndefined();
    });

    it('returns undefined when email is missing', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');
      await cm.setApiKey('key');

      const creds = await cm.getCredentials();
      expect(creds).toBeUndefined();
    });

    it('returns undefined when nothing is set', async () => {
      const cm = new CredentialsManager(mockContext);
      expect(await cm.getCredentials()).toBeUndefined();
    });

    it('normalizes baseUrl by stripping trailing slashes', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com///');
      await cm.setApiKey('key');
      await cm.setEmail('user@example.com');

      const creds = await cm.getCredentials();
      expect(creds?.baseUrl).toBe('https://bugs.example.com');
    });

    it('does not modify baseUrl without trailing slashes', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com/path');
      await cm.setApiKey('key');
      await cm.setEmail('user@example.com');

      const creds = await cm.getCredentials();
      expect(creds?.baseUrl).toBe('https://bugs.example.com/path');
    });
  });

  describe('hasCredentials', () => {
    it('returns true when baseUrl and email are set', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');
      await cm.setEmail('user@example.com');
      expect(cm.hasCredentials()).toBe(true);
    });

    it('returns false when only baseUrl set', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');
      expect(cm.hasCredentials()).toBe(false);
    });

    it('returns false when only email set', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setEmail('user@example.com');
      expect(cm.hasCredentials()).toBe(false);
    });

    it('returns false when nothing set', () => {
      const cm = new CredentialsManager(mockContext);
      expect(cm.hasCredentials()).toBe(false);
    });
  });

  describe('clearCredentials', () => {
    it('clears all stored credentials', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');
      await cm.setApiKey('key');
      await cm.setEmail('user@example.com');

      await cm.clearCredentials();

      expect(mockGlobalState.update).toHaveBeenCalledWith('bugzilla.baseUrl', undefined);
      expect(mockGlobalState.update).toHaveBeenCalledWith('bugzilla.email', undefined);
      expect(mockSecrets.delete).toHaveBeenCalledWith('bugzilla.apiKey');

      expect(cm.getBaseUrl()).toBeUndefined();
      expect(await cm.getApiKey()).toBeUndefined();
      expect(cm.getEmail()).toBeUndefined();
    });

    it('clears partial credentials without error', async () => {
      const cm = new CredentialsManager(mockContext);
      await cm.setBaseUrl('https://bugs.example.com');

      await expect(cm.clearCredentials()).resolves.toBeUndefined();
    });
  });

  describe('setCredentials (full flow via mock)', () => {
    it('completes full credential setup with valid inputs', async () => {
      (vscode.window.showInputBox as any)
        .mockResolvedValueOnce('https://bugzilla.example.com')
        .mockResolvedValueOnce('valid-api-key')
        .mockResolvedValueOnce('user@example.com');

      const cm = new CredentialsManager(mockContext);
      await cm.setCredentials();

      expect(vscode.window.showInputBox).toHaveBeenCalledTimes(3);
      const creds = await cm.getCredentials();
      expect(creds).toBeDefined();
      expect(creds!.baseUrl).toBe('https://bugzilla.example.com');
      expect(creds!.apiKey).toBe('valid-api-key');
      expect(creds!.email).toBe('user@example.com');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Bugzilla credentials saved successfully.'
      );
    });

    it('stops early if user cancels URL input', async () => {
      (vscode.window.showInputBox as any).mockResolvedValueOnce(undefined);

      const cm = new CredentialsManager(mockContext);
      await cm.setCredentials();

      expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
      expect(await cm.getCredentials()).toBeUndefined();
    });

    it('stops early if user cancels API key input', async () => {
      (vscode.window.showInputBox as any)
        .mockResolvedValueOnce('https://bugzilla.example.com')
        .mockResolvedValueOnce(undefined);

      const cm = new CredentialsManager(mockContext);
      await cm.setCredentials();

      expect(vscode.window.showInputBox).toHaveBeenCalledTimes(2);
      expect(await cm.getCredentials()).toBeUndefined();
    });

    it('stops early if user cancels email input', async () => {
      (vscode.window.showInputBox as any)
        .mockResolvedValueOnce('https://bugzilla.example.com')
        .mockResolvedValueOnce('valid-key')
        .mockResolvedValueOnce(undefined);

      const cm = new CredentialsManager(mockContext);
      await cm.setCredentials();

      expect(vscode.window.showInputBox).toHaveBeenCalledTimes(3);
      expect(await cm.getCredentials()).toBeUndefined();
    });

    it('passes validation callback to showInputBox for URL', async () => {
      // The validateInput callback is passed to VS Code which handles it internally.
      // We verify the showInputBox was called with a validateInput function.
      (vscode.window.showInputBox as any).mockResolvedValueOnce('https://valid.com');
      (vscode.window.showInputBox as any).mockResolvedValueOnce('key');
      (vscode.window.showInputBox as any).mockResolvedValueOnce('email@test.com');

      const cm = new CredentialsManager(mockContext);
      await cm.setCredentials();

      // First call should have validateInput defined
      const firstCall = (vscode.window.showInputBox as any).mock.calls[0][0];
      expect(firstCall.validateInput).toBeDefined();
      expect(typeof firstCall.validateInput).toBe('function');
    });
  });
});

// --- BugTreeItem ---
describe('BugTreeItem', () => {
  const bug = {
    id: 42,
    summary: 'Critical crash',
    severity: 'S1',
    priority: 'P1',
    status: 'NEW',
    assigned_to: 'dev@example.com',
    product: 'Core',
    component: 'Engine',
  };

  it('creates tree item with correct label', () => {
    const item = new BugTreeItem(bug);
    expect(item.label).toBe('Bug 42');
  });

  it('sets description with summary and severity', () => {
    const item = new BugTreeItem(bug);
    expect(item.description).toBe('Critical crash [S1]');
  });

  it('sets contextValue for context menus', () => {
    const item = new BugTreeItem(bug);
    expect(item.contextValue).toBe('bugTreeItem');
  });

  it('sets tooltip with multiple fields', () => {
    const item = new BugTreeItem(bug);
    expect(item.tooltip).toContain('Critical crash');
    expect(item.tooltip).toContain('Status: NEW');
    expect(item.tooltip).toContain('Severity: S1');
    expect(item.tooltip).toContain('Priority: P1');
    expect(item.tooltip).toContain('Product: Core');
    expect(item.tooltip).toContain('Component: Engine');
  });

  it('sets click command to show bug webview', () => {
    const item = new BugTreeItem(bug);
    expect(item.command).toEqual({
      command: 'bugzilla.showBugWebview',
      title: 'Show Bug Details',
      arguments: [bug],
    });
  });

  it('has None collapsible state', () => {
    const item = new BugTreeItem(bug);
    expect(item.collapsibleState).toBe(0);
  });

  // getSeverityIcon via indirect check on iconPath
  it('gives error icon for S1/BLOCKER/CRITICAL severities', () => {
    const s1 = new BugTreeItem({ ...bug, severity: 'S1' });
    expect((s1.iconPath as any).id).toBe('error');

    const blocker = new BugTreeItem({ ...bug, severity: 'BLOCKER' });
    expect((blocker.iconPath as any).id).toBe('error');

    const critical = new BugTreeItem({ ...bug, severity: 'critical' });
    expect((critical.iconPath as any).id).toBe('error');
  });

  it('gives warning icon for S2/MAJOR severities', () => {
    const s2 = new BugTreeItem({ ...bug, severity: 'S2' });
    expect((s2.iconPath as any).id).toBe('warning');

    const major = new BugTreeItem({ ...bug, severity: 'major' });
    expect((major.iconPath as any).id).toBe('warning');
  });

  it('gives info icon for S3/NORMAL severities', () => {
    const s3 = new BugTreeItem({ ...bug, severity: 'S3' });
    expect((s3.iconPath as any).id).toBe('info');

    const normal = new BugTreeItem({ ...bug, severity: 'normal' });
    expect((normal.iconPath as any).id).toBe('info');
  });

  it('gives default circle icon for unknown severity', () => {
    const unknown = new BugTreeItem({ ...bug, severity: 'UNKNOWN' });
    expect((unknown.iconPath as any).id).toBe('circle-outline');
  });

  it('handles empty summary for description', () => {
    const emptySummary = new BugTreeItem({ ...bug, summary: '' });
    expect(emptySummary.description).toBe(' [S1]');
  });
});

// --- BugTreeDataProvider ---
describe('BugTreeDataProvider', () => {
  let outputChannel: { appendLine: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    outputChannel = { appendLine: vi.fn() };
  });

  function createProvider(getClient: () => Promise<any>) {
    return new BugTreeDataProvider(getClient, outputChannel as any);
  }

  it('getParent returns undefined', () => {
    const dp = createProvider(async () => undefined);
    expect(dp.getParent()).toBeUndefined();
  });

  it('getChildren for element returns empty array', () => {
    const dp = createProvider(async () => undefined);
    const bug = {
      id: 1, summary: 'Bug', severity: 'S3', priority: 'P3',
      status: 'NEW', assigned_to: 'x', product: 'P', component: 'C',
    };
    const item = new BugTreeItem(bug);
    expect(dp.getChildren(item)).toEqual([]);
  });

  it('errorMessage shows when provided', () => {
    const dp = createProvider(async () => undefined);
    expect(dp.getErrorMessage()).toBeUndefined();
    (dp as any).errorMessage = 'Something went wrong';
    expect(dp.getErrorMessage()).toBe('Something went wrong');
  });

  it('isLoadingBugs returns false initially', () => {
    const dp = createProvider(async () => undefined);
    expect(dp.isLoadingBugs()).toBe(false);
  });

  it('isLoadingBugs returns true when loading', () => {
    const dp = createProvider(async () => undefined);
    (dp as any).isLoading = true;
    expect(dp.isLoadingBugs()).toBe(true);
  });

  it('getChildren returns loading item when isLoading', () => {
    const dp = createProvider(async () => undefined);
    (dp as any).isLoading = true;
    const children = dp.getChildren();
    expect(children).toHaveLength(1);
    expect((children![0] as any).label).toBe('Loading...');
  });

  it('getChildren returns error message item when errorMessage set', () => {
    const dp = createProvider(async () => undefined);
    (dp as any).errorMessage = 'Connection failed';
    const children = dp.getChildren();
    expect(children).toHaveLength(1);
    expect((children![0] as any).label).toBe('Connection failed');
  });

  it('getChildren returns "No bugs found" when bugs array empty and no error', () => {
    const dp = createProvider(async () => undefined);
    const children = dp.getChildren();
    expect(children).toHaveLength(1);
    expect((children![0] as any).label).toBe('No bugs found');
  });

  it('getChildren returns bug tree items when bugs available', () => {
    const dp = createProvider(async () => undefined);
    const bugs = [
      { id: 1, summary: 'Bug 1', severity: 'S1', priority: 'P1', status: 'NEW', assigned_to: 'x', product: 'P', component: 'C' },
      { id: 2, summary: 'Bug 2', severity: 'S3', priority: 'P3', status: 'ASSIGNED', assigned_to: 'x', product: 'P', component: 'C' },
    ];
    (dp as any).bugs = bugs;
    const children = dp.getChildren();
    expect(children).toHaveLength(2);
    expect((children![0] as any).label).toBe('Bug 1');
    expect((children![1] as any).label).toBe('Bug 2');
  });

  it('getTreeItem returns the element unchanged', () => {
    const dp = createProvider(async () => undefined);
    const bug = {
      id: 1, summary: 'Bug', severity: 'S3', priority: 'P3',
      status: 'NEW', assigned_to: 'x', product: 'P', component: 'C',
    };
    const item = new BugTreeItem(bug);
    expect(dp.getTreeItem(item)).toBe(item);
  });

  describe('refresh / loadBugs', () => {
    it('sets error message when no client available', async () => {
      const dp = createProvider(async () => undefined);
      // Manually trigger loadBugs behavior
      (dp as any).isLoading = true;
      (dp as any).errorMessage = undefined;
      const client = await (dp as any).getClient();
      expect(client).toBeUndefined();

      // Simulate refresh logic
      (dp as any).isLoading = true;
      (dp as any).errorMessage = undefined;
      (dp as any)._onDidChangeTreeData.fire();

      const bugs = await (dp as any).loadBugs();
      expect(bugs).toEqual([]);
      expect((dp as any).errorMessage).toContain('Not connected');
    });

    it('loads bugs successfully when client available', async () => {
      const mockClient = {
        email: 'user@example.com',
        getAssignedBugs: vi.fn().mockResolvedValue([
          { id: 1, summary: 'Bug 1', severity: 'S1', priority: 'P1', status: 'NEW', assigned_to: 'user@example.com', product: 'P', component: 'C' },
        ]),
      };
      const dp = createProvider(async () => mockClient);

      const bugs = await (dp as any).loadBugs();
      expect(bugs).toHaveLength(1);
      expect(bugs[0].id).toBe(1);
      expect((dp as any).errorMessage).toBeUndefined();
      expect(outputChannel.appendLine).toHaveBeenCalledWith('Bugzilla: Connected as user@example.com');
      expect(outputChannel.appendLine).toHaveBeenCalledWith('Bugzilla: Found 1 assigned bug(s)');
    });

    it('sets "No bugs" message when client returns empty array', async () => {
      const mockClient = {
        email: 'user@example.com',
        getAssignedBugs: vi.fn().mockResolvedValue([]),
      };
      const dp = createProvider(async () => mockClient);

      const bugs = await (dp as any).loadBugs();
      expect(bugs).toEqual([]);
      expect((dp as any).errorMessage).toBe('No bugs assigned to you.');
    });

    it('handles client error gracefully', async () => {
      const mockClient = {
        email: 'user@example.com',
        getAssignedBugs: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const dp = createProvider(async () => mockClient);

      const bugs = await (dp as any).loadBugs();
      expect(bugs).toEqual([]);
      expect((dp as any).errorMessage).toBe('Network error');
      expect(outputChannel.appendLine).toHaveBeenCalledWith('Bugzilla Error: Network error');
    });

    it('handles non-Error thrown values', async () => {
      const mockClient = {
        email: 'user@example.com',
        getAssignedBugs: vi.fn().mockRejectedValue('string error'),
      };
      const dp = createProvider(async () => mockClient);

      const bugs = await (dp as any).loadBugs();
      expect(bugs).toEqual([]);
      expect((dp as any).errorMessage).toBe('string error');
    });
  });
});
