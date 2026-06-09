import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BugzillaClient, BugzillaClientError } from '../client';
import type { z } from 'zod';

function mockFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    text: async () => '',
    ...response,
  });
}

function createClient(baseUrl = 'https://bugzilla.example.com', apiKey = 'test-api-key', email = 'user@example.com') {
  return new BugzillaClient(baseUrl, apiKey, email);
}

// --- Constructor ---
describe('BugzillaClient constructor', () => {
  it('strips trailing slashes from baseUrl', () => {
    const client = new BugzillaClient('https://bugzilla.example.com///', 'key', 'email@example.com');
    expect(client.email).toBe('email@example.com');
  });

  it('keeps baseUrl without trailing slashes as-is', () => {
    const client = createClient('https://bugzilla.example.com');
    expect(client.email).toBe('user@example.com');
  });

  it('handles empty email', () => {
    const client = new BugzillaClient('https://bugzilla.example.com', 'key', '');
    expect(client.email).toBe('');
  });
});

// --- request method (generic) ---
describe('BugzillaClient.request', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a GET request and parses valid response', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    const result = await (client as any).request('/rest/bug', schema);
    expect(result).toEqual(responseData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const urlArg = (globalThis.fetch as any).mock.calls[0][0];
    expect(urlArg).toContain('api_key=test-api-key');
  });

  it('sends X-BUGZILLA-API-KEY header', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    await (client as any).request('/rest/bug', schema);
    const callHeaders = (globalThis.fetch as any).mock.calls[0][1].headers;
    expect(callHeaders['X-BUGZILLA-API-KEY']).toBe('test-api-key');
  });

  it('sends Accept: application/json header', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    await (client as any).request('/rest/bug', schema);
    const callHeaders = (globalThis.fetch as any).mock.calls[0][1].headers;
    expect(callHeaders['Accept']).toBe('application/json');
  });

  it('throws BugzillaClientError on 401', async () => {
    globalThis.fetch = mockFetch({ ok: false, status: 401, statusText: 'Unauthorized' });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow(BugzillaClientError);
    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Authentication failed');
  });

  it('throws BugzillaClientError on 404', async () => {
    globalThis.fetch = mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('endpoint not found');
  });

  it('throws BugzillaClientError on invalid JSON body', async () => {
    globalThis.fetch = mockFetch({
      ok: true,
      json: async () => { throw new Error('Invalid JSON'); },
    });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Failed to parse Bugzilla API response');
  });

  it('throws BugzillaClientError on schema validation failure', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const schema = {
      safeParse: vi.fn().mockReturnValue({ success: false, error: { message: 'Invalid format' } }),
    } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Unexpected API response format');
  });

  it('retries on network failure then succeeds on second attempt', async () => {
    const responseData = { bugs: [] };
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => responseData });

    const result = await (client as any).request('/rest/bug', schema);
    expect(result).toEqual(responseData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Failed to connect to Bugzilla');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('retries on 5xx errors then succeeds', async () => {
    const responseData = { bugs: [] };
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' })
      .mockResolvedValueOnce({ ok: true, json: async () => responseData });

    const result = await (client as any).request('/rest/bug', schema);
    expect(result).toEqual(responseData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on 5xx after exhausting retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Error', text: async () => 'server error' });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Bugzilla API error');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws on 4xx without retrying (except 401/404)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request', text: async () => 'bad input' });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow('Bugzilla API error (400)');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retries for 4xx
  });

  it('includes custom headers from init', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: responseData }) } as unknown as z.ZodSchema<{ bugs: unknown[] }>;
    const client = createClient();

    await (client as any).request('/rest/bug/42', schema, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [42], status: 'RESOLVED' }),
    });

    const callInit = (globalThis.fetch as any).mock.calls[0][1];
    expect(callInit.method).toBe('PUT');
    expect(callInit.headers['Content-Type']).toBe('application/json');
    expect(callInit.body).toBe(JSON.stringify({ ids: [42], status: 'RESOLVED' }));
  });

  it('handles response.text() failing on error', async () => {
    globalThis.fetch = mockFetch({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => { throw new Error('body read error'); },
    });
    const schema = { safeParse: vi.fn() } as unknown as z.ZodSchema<any>;
    const client = createClient();

    // Should not crash even if text() throws
    await expect((client as any).request('/rest/bug', schema)).rejects.toThrow();
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

// --- getAssignedBugs ---
describe('BugzillaClient.getAssignedBugs', () => {
  const validBug = {
    id: 1,
    summary: 'Test bug',
    severity: 'S3',
    priority: 'P3',
    status: 'NEW',
    assigned_to: 'user@example.com',
    product: 'Product',
    component: 'Component',
  };

  it('returns bugs from response', async () => {
    const responseData = { bugs: [validBug] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const bugs = await client.getAssignedBugs('user@example.com');
    expect(bugs).toHaveLength(1);
    expect(bugs[0].id).toBe(1);
  });

  it('returns empty array when no bugs assigned', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const bugs = await client.getAssignedBugs('user@example.com');
    expect(bugs).toEqual([]);
  });

  it('includes multiple statuses in query', async () => {
    const responseData = { bugs: [] };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    await client.getAssignedBugs('user@example.com');
    const url = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('assigned_to=user%40example.com');
    expect(url).toContain('status=UNCONFIRMED');
    expect(url).toContain('status=CONFIRMED');
    expect(url).toContain('status=NEW');
    expect(url).toContain('status=ASSIGNED');
    expect(url).toContain('status=REOPENED');
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch({ ok: false, status: 401 });
    const client = createClient();

    await expect(client.getAssignedBugs('user@example.com')).rejects.toThrow(BugzillaClientError);
  });
});

// --- getBugComments ---
describe('BugzillaClient.getBugComments', () => {
  const validComment = {
    id: 1,
    bug_id: 42,
    text: 'A comment',
    creator: 'user@example.com',
    creation_time: '2025-01-01T00:00:00Z',
    time: '2025-01-01T00:00:00Z',
    count: 0,
    attachment_id: null,
    is_private: false,
    tags: [],
  };

  it('returns comments for a bug', async () => {
    const responseData = { bugs: { '42': { comments: [validComment] } } };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const comments = await client.getBugComments(42);
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('A comment');
  });

  it('returns empty array when bug is not in response', async () => {
    const responseData = { bugs: {} };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const comments = await client.getBugComments(42);
    expect(comments).toEqual([]);
  });

  it('returns empty array when bug has no comments array', async () => {
    const responseData = { bugs: { '42': { comments: [] } } };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const comments = await client.getBugComments(42);
    expect(comments).toEqual([]);
  });

  it('returns empty array when bug key is not present', async () => {
    const responseData = { bugs: { '99': { comments: [validComment] } } };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const comments = await client.getBugComments(42);
    expect(comments).toEqual([]);
  });

  it('handles bug with many comments', async () => {
    const manyComments = Array.from({ length: 100 }, (_, i) => ({ ...validComment, id: i + 1 }));
    const responseData = { bugs: { '42': { comments: manyComments } } };
    globalThis.fetch = mockFetch({ ok: true, json: async () => responseData });
    const client = createClient();

    const comments = await client.getBugComments(42);
    expect(comments).toHaveLength(100);
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch({ ok: false, status: 500, text: async () => 'error' });
    const client = createClient();

    await expect(client.getBugComments(42)).rejects.toThrow();
  });
});

// --- updateBugStatus ---
describe('BugzillaClient.updateBugStatus', () => {
  const validResponse = {
    bugs: [{ id: 42, last_change_time: '2025-01-01T00:00:00Z', changes: {} }],
  };

  it('sends PUT with status and resolves successfully', async () => {
    globalThis.fetch = mockFetch({ ok: true, json: async () => validResponse });
    const client = createClient();

    await expect(client.updateBugStatus(42, 'RESOLVED')).resolves.toBeUndefined();
    const callInit = (globalThis.fetch as any).mock.calls[0][1];
    expect(callInit.method).toBe('PUT');
    expect(callInit.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(callInit.body);
    expect(body.ids).toEqual([42]);
    expect(body.status).toBe('RESOLVED');
  });

  it('includes resolution when provided', async () => {
    globalThis.fetch = mockFetch({ ok: true, json: async () => validResponse });
    const client = createClient();

    await client.updateBugStatus(42, 'RESOLVED', 'FIXED');
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.resolution).toBe('FIXED');
  });

  it('omits resolution when undefined', async () => {
    globalThis.fetch = mockFetch({ ok: true, json: async () => validResponse });
    const client = createClient();

    await client.updateBugStatus(42, 'ASSIGNED', undefined);
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body).not.toHaveProperty('resolution');
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch({ ok: false, status: 403, text: async () => 'forbidden' });
    const client = createClient();

    await expect(client.updateBugStatus(42, 'RESOLVED')).rejects.toThrow('Bugzilla API error (403)');
  });
});

// --- BugzillaClientError ---
describe('BugzillaClientError', () => {
  it('has correct name', () => {
    const error = new BugzillaClientError('test');
    expect(error.name).toBe('BugzillaClientError');
  });

  it('stores statusCode', () => {
    const error = new BugzillaClientError('test', 404);
    expect(error.statusCode).toBe(404);
  });

  it('stores message', () => {
    const error = new BugzillaClientError('custom message', 500);
    expect(error.message).toBe('custom message');
  });

  it('is instance of Error', () => {
    const error = new BugzillaClientError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('statusCode defaults to undefined', () => {
    const error = new BugzillaClientError('test');
    expect(error.statusCode).toBeUndefined();
  });
});
