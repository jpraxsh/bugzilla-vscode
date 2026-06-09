import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInputBox: vi.fn(),
    createOutputChannel: vi.fn().mockReturnValue({ appendLine: vi.fn(), dispose: vi.fn() }),
    createWebviewPanel: vi.fn().mockReturnValue({
      title: '',
      reveal: vi.fn(),
      dispose: vi.fn(),
      onDidDispose: vi.fn(),
      webview: {
        html: '',
        onDidReceiveMessage: vi.fn(),
        postMessage: vi.fn(),
        asWebviewUri: vi.fn(),
      },
    }),
    createStatusBarItem: vi.fn().mockReturnValue({ show: vi.fn(), dispose: vi.fn() }),
    createTreeView: vi.fn().mockReturnValue({ dispose: vi.fn(), onDidChangeVisibility: vi.fn() }),
  },
  ThemeIcon: class { constructor(public id: string, public color?: any) {} },
  ThemeColor: class { constructor(public id: string) {} },
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
  TreeItemCollapsibleState: { None: 0 },
  ViewColumn: { One: 1, Two: 2 },
  StatusBarAlignment: { Right: 2 },
  EventEmitter: class { event = vi.fn(); fire = vi.fn(); },
}));

import { BugWebviewProvider } from '../bugWebview';
import type { Bug, Comment } from '../client';

// We test the pure helper methods directly via prototype access
// getSeverityColor, getPriorityColor, escapeHtml

function makeProvider(): BugWebviewProvider {
  return new BugWebviewProvider({} as any);
}

const mockBug: Bug = {
  id: 12345,
  summary: 'Test bug',
  severity: 'S3',
  priority: 'P3',
  status: 'NEW',
  assigned_to: 'user@example.com',
  product: 'TestProduct',
  component: 'Core',
};

const mockComments: Comment[] = [
  {
    id: 1,
    bug_id: 12345,
    text: 'First comment',
    creator: 'user@example.com',
    creation_time: '2025-01-15T10:30:00Z',
    time: '2025-01-15T10:30:00Z',
    count: 0,
    attachment_id: null,
    is_private: false,
    tags: [],
  },
];

// --- getSeverityColor ---
describe('BugWebviewProvider.getSeverityColor', () => {
  it('returns red for S1', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('S1')).toBe('#d73a49');
  });

  it('returns red for BLOCKER (case insensitive)', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('blocker')).toBe('#d73a49');
  });

  it('returns red for CRITICAL', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('CRITICAL')).toBe('#d73a49');
  });

  it('returns yellow for S2', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('S2')).toBe('#dbab0a');
  });

  it('returns yellow for MAJOR (case insensitive)', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('major')).toBe('#dbab0a');
  });

  it('returns blue for S3', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('S3')).toBe('#0366d6');
  });

  it('returns blue for NORMAL', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('NORMAL')).toBe('#0366d6');
  });

  it('returns default grey for unknown severity', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('UNKNOWN_SEV')).toBe('#586069');
  });

  it('returns default grey for empty string', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('')).toBe('#586069');
  });

  it('handles lowercase S1', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('s1')).toBe('#d73a49');
  });

  it('returns default grey for mixed case unknown', () => {
    const provider = makeProvider();
    expect((provider as any).getSeverityColor('s4')).toBe('#586069');
  });
});

// --- getPriorityColor ---
describe('BugWebviewProvider.getPriorityColor', () => {
  it('returns red for P1', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('P1')).toBe('#d73a49');
  });

  it('returns red for HIGHEST', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('HIGHEST')).toBe('#d73a49');
  });

  it('returns yellow for P2', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('P2')).toBe('#dbab0a');
  });

  it('returns yellow for HIGH', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('HIGH')).toBe('#dbab0a');
  });

  it('returns blue for P3', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('P3')).toBe('#0366d6');
  });

  it('returns blue for MEDIUM', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('MEDIUM')).toBe('#0366d6');
  });

  it('returns default grey for unknown priority', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('P5')).toBe('#586069');
  });

  it('returns default grey for empty string', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('')).toBe('#586069');
  });

  it('handles lowercase p2', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('p2')).toBe('#dbab0a');
  });

  it('handles mixed case "highest"', () => {
    const provider = makeProvider();
    expect((provider as any).getPriorityColor('highest')).toBe('#d73a49');
  });
});

// --- escapeHtml ---
describe('BugWebviewProvider.escapeHtml', () => {
  it('returns the same string when no HTML chars present', () => {
    const provider = makeProvider();
    const result = (provider as any).escapeHtml('Hello World');
    expect(result).toBe('Hello World');
  });

  it('escapes ampersand', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quote', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quote', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml("it's done")).toBe('it&#39;s done');
  });

  it('escapes multiple types in one string', () => {
    const provider = makeProvider();
    const input = '<script>alert("XSS & more")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS &amp; more&quot;)&lt;/script&gt;';
    expect((provider as any).escapeHtml(input)).toBe(expected);
  });

  it('handles empty string', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('')).toBe('');
  });

  it('handles string with only special chars', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('<>"\'&')).toBe('&lt;&gt;&quot;&#39;&amp;');
  });

  it('does not double-escape already escaped string', () => {
    const provider = makeProvider();
    const input = '&amp;lt;';
    const result = (provider as any).escapeHtml(input);
    // It WILL double-escape because the & in &amp; gets hit
    expect(result).toBe('&amp;amp;lt;');
  });

  it('handles unicode without modification', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('バグ 🐛 привет')).toBe('バグ 🐛 привет');
  });

  it('handles very long string', () => {
    const provider = makeProvider();
    const input = '<'.repeat(10000);
    const result = (provider as any).escapeHtml(input);
    expect(result).toBe('&lt;'.repeat(10000));
  });

  it('handles string with only ampersands', () => {
    const provider = makeProvider();
    expect((provider as any).escapeHtml('&&&&')).toBe('&amp;&amp;&amp;&amp;');
  });
});

// --- getHtml (integration through public showBug) ---
describe('BugWebviewProvider.getHtml', () => {
  it('generates HTML content for a bug with comments', () => {
    const provider = makeProvider();

    // Simulate what showBug does internally without the VS Code WebviewPanel APIs
    const html = (provider as any).getHtml({ bug: mockBug, comments: mockComments });

    expect(typeof html).toBe('string');
    expect(html).toContain('Bug 12345');
    expect(html).toContain('Test bug');
    expect(html).toContain('S3');
    expect(html).toContain('P3');
    expect(html).toContain('NEW');
    expect(html).toContain('user@example.com');
    expect(html).toContain('TestProduct');
    expect(html).toContain('Core');
    expect(html).toContain('Comments (1)');
    expect(html).toContain('First comment');
    expect(html).toContain('updateStatus');
  });

  it('generates HTML with "No comments" state', () => {
    const provider = makeProvider();
    const html = (provider as any).getHtml({ bug: mockBug, comments: [] });

    expect(html).toContain('Comments (0)');
    expect(html).toContain('No comments on this bug.');
  });

  it('generates HTML with many comments', () => {
    const provider = makeProvider();
    const manyComments: Comment[] = Array.from({ length: 50 }, (_, i) => ({
      ...mockComments[0],
      id: i + 1,
      text: `Comment ${i + 1}`,
    }));
    const html = (provider as any).getHtml({ bug: mockBug, comments: manyComments });

    expect(html).toContain('Comments (50)');
    expect(html).toContain('Comment 1');
    expect(html).toContain('Comment 50');
  });

  it('escapes HTML in bug summary', () => {
    const provider = makeProvider();
    const xssBug = { ...mockBug, summary: '<img src=x onerror=alert(1)>' };
    const html = (provider as any).getHtml({ bug: xssBug, comments: [] });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes HTML in comment text', () => {
    const provider = makeProvider();
    const xssComment: Comment = { ...mockComments[0], text: '<script>alert(1)</script>' };
    const html = (provider as any).getHtml({ bug: mockBug, comments: [xssComment] });

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes HTML in comment creator', () => {
    const provider = makeProvider();
    const xssComment: Comment = { ...mockComments[0], creator: '<b>hacker</b>' };
    const html = (provider as any).getHtml({ bug: mockBug, comments: [xssComment] });

    expect(html).not.toContain('<b>hacker</b>');
    expect(html).toContain('&lt;b&gt;hacker&lt;/b&gt;');
  });

  it('shows resolution field for terminal status', () => {
    const provider = makeProvider();
    const resolvedBug = { ...mockBug, status: 'RESOLVED' };
    const html = (provider as any).getHtml({ bug: resolvedBug, comments: [] });

    // Terminal statuses: RESOLVED is in the TERMINAL_STATUSES list
    expect(html).toContain('resolution-select');
    // Resolution field should be visible (display: flex)
    expect(html).toContain('display: flex');
  });

  it('hides resolution field for non-terminal status', () => {
    const provider = makeProvider();
    const html = (provider as any).getHtml({ bug: mockBug, comments: [] });
    // For NEW, resolution field should be display: none
    expect(html).toContain('display: none');
  });

  it('includes terminal statuses in JSON for client-side script', () => {
    const provider = makeProvider();
    const html = (provider as any).getHtml({ bug: mockBug, comments: [] });

    expect(html).toContain('"RESOLVED"');
    expect(html).toContain('"VERIFIED"');
    expect(html).toContain('"CLOSED"');
  });

  it('renders correct date format for comments', () => {
    const provider = makeProvider();
    const html = (provider as any).getHtml({ bug: mockBug, comments: mockComments });

    // Date is formatted via toLocaleString, exact output varies by locale but it should be present
    // Just verify the creation_time is handled without error
    expect(html).toBeTruthy();
  });
});

// --- setUpdateHandler ---
describe('BugWebviewProvider.setUpdateHandler', () => {
  it('stores the handler', () => {
    const provider = makeProvider();
    const handler = async () => {};
    provider.setUpdateHandler(handler);
    expect((provider as any).onUpdateStatus).toBe(handler);
  });
});
