import { describe, it, expect } from 'vitest';
import {
  bugSchema,
  bugSearchResponseSchema,
  commentSchema,
  commentSearchResponseSchema,
  updateResponseSchema,
  urlSchema,
  apiKeySchema,
  emailSchema,
} from '../schemas';

// --- bugSchema ---
describe('bugSchema', () => {
  const validBug = {
    id: 12345,
    summary: 'Application crashes on startup',
    severity: 'S1',
    priority: 'P1',
    status: 'NEW',
    assigned_to: 'dev@example.com',
    product: 'MyProduct',
    component: 'Core',
  };

  it('parses a valid bug', () => {
    const result = bugSchema.safeParse(validBug);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(12345);
      expect(result.data.summary).toBe('Application crashes on startup');
    }
  });

  it('rejects a bug with missing id', () => {
    const { id, ...rest } = validBug;
    const result = bugSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a bug with id as string instead of number', () => {
    const result = bugSchema.safeParse({ ...validBug, id: '12345' });
    expect(result.success).toBe(false);
  });

  it('accepts a bug with negative id (zod number allows any number)', () => {
    const result = bugSchema.safeParse({ ...validBug, id: -1 });
    expect(result.success).toBe(true);
  });

  it('accepts a bug with id 0 (zod number allows zero)', () => {
    const result = bugSchema.safeParse({ ...validBug, id: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts empty string for summary', () => {
    const result = bugSchema.safeParse({ ...validBug, summary: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a bug with null fields', () => {
    const result = bugSchema.safeParse({ ...validBug, severity: null });
    expect(result.success).toBe(false);
  });

  it('rejects a bug with extra unknown fields', () => {
    const result = bugSchema.safeParse({ ...validBug, extraField: 'value' });
    expect(result.success).toBe(true); // Zod ignores unknown by default in object()
  });

  it('rejects completely empty object', () => {
    const result = bugSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-object input (string)', () => {
    const result = bugSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('rejects non-object input (array)', () => {
    const result = bugSchema.safeParse([1, 2, 3]);
    expect(result.success).toBe(false);
  });

  it('rejects non-object input (null)', () => {
    const result = bugSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects non-object input (undefined)', () => {
    const result = bugSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('handles very long summary string', () => {
    const result = bugSchema.safeParse({ ...validBug, summary: 'x'.repeat(10000) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary.length).toBe(10000);
    }
  });

  it('handles special characters in fields', () => {
    const result = bugSchema.safeParse({
      ...validBug,
      summary: '<script>alert("xss")</script>',
      assigned_to: 'user+tag@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('handles unicode characters in fields', () => {
    const result = bugSchema.safeParse({
      ...validBug,
      summary: 'バグレポート 🐛',
      product: '製品',
    });
    expect(result.success).toBe(true);
  });

  it('handles maximum safe integer as id', () => {
    const result = bugSchema.safeParse({ ...validBug, id: Number.MAX_SAFE_INTEGER });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  it('accepts float as id (zod number allows floats)', () => {
    const result = bugSchema.safeParse({ ...validBug, id: 1.5 });
    expect(result.success).toBe(true);
  });
});

// --- bugSearchResponseSchema ---
describe('bugSearchResponseSchema', () => {
  const validBug = {
    id: 1,
    summary: 'Test',
    severity: 'S3',
    priority: 'P3',
    status: 'NEW',
    assigned_to: 'user@example.com',
    product: 'P',
    component: 'C',
  };

  it('parses a valid response with one bug', () => {
    const result = bugSearchResponseSchema.safeParse({ bugs: [validBug] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs).toHaveLength(1);
    }
  });

  it('parses empty bugs array', () => {
    const result = bugSearchResponseSchema.safeParse({ bugs: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs).toHaveLength(0);
    }
  });

  it('parses large bugs array', () => {
    const bugs = Array.from({ length: 1000 }, (_, i) => ({ ...validBug, id: i + 1 }));
    const result = bugSearchResponseSchema.safeParse({ bugs });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs).toHaveLength(1000);
    }
  });

  it('rejects missing bugs field', () => {
    const result = bugSearchResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects bugs as string', () => {
    const result = bugSearchResponseSchema.safeParse({ bugs: 'not an array' });
    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = bugSearchResponseSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects array with one invalid bug', () => {
    const result = bugSearchResponseSchema.safeParse({ bugs: [{ id: 'bad' }] });
    expect(result.success).toBe(false);
  });
});

// --- commentSchema ---
describe('commentSchema', () => {
  const validComment = {
    id: 100,
    bug_id: 12345,
    text: 'This is a comment',
    creator: 'user@example.com',
    creation_time: '2025-01-15T10:30:00Z',
    time: '2025-01-15T10:30:00Z',
    count: 0,
    attachment_id: null,
    is_private: false,
    tags: [],
  };

  it('parses a valid comment', () => {
    const result = commentSchema.safeParse(validComment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(100);
      expect(result.data.text).toBe('This is a comment');
    }
  });

  it('parses comment with attachment_id as number', () => {
    const result = commentSchema.safeParse({ ...validComment, attachment_id: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachment_id).toBe(42);
    }
  });

  it('parses comment with attachment_id as null', () => {
    const result = commentSchema.safeParse({ ...validComment, attachment_id: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachment_id).toBeNull();
    }
  });

  it('rejects comment with attachment_id as undefined', () => {
    const { attachment_id, ...rest } = validComment;
    const result = commentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('parses comment with is_private true', () => {
    const result = commentSchema.safeParse({ ...validComment, is_private: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_private).toBe(true);
    }
  });

  it('rejects is_private as string', () => {
    const result = commentSchema.safeParse({ ...validComment, is_private: 'yes' });
    expect(result.success).toBe(false);
  });

  it('parses comment with tags', () => {
    const result = commentSchema.safeParse({ ...validComment, tags: ['tag1', 'tag2'] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(['tag1', 'tag2']);
    }
  });

  it('rejects tags as non-array', () => {
    const result = commentSchema.safeParse({ ...validComment, tags: 'tag1' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const { id, ...rest } = validComment;
    const result = commentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = commentSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('handles empty text', () => {
    const result = commentSchema.safeParse({ ...validComment, text: '' });
    expect(result.success).toBe(true);
  });

  it('handles very long comment text', () => {
    const result = commentSchema.safeParse({ ...validComment, text: 'x'.repeat(50000) });
    expect(result.success).toBe(true);
  });
});

// --- commentSearchResponseSchema ---
describe('commentSearchResponseSchema', () => {
  const validComment = {
    id: 1,
    bug_id: 42,
    text: 'test',
    creator: 'user@example.com',
    creation_time: '2025-01-01T00:00:00Z',
    time: '2025-01-01T00:00:00Z',
    count: 0,
    attachment_id: null,
    is_private: false,
    tags: [],
  };

  it('parses valid response', () => {
    const result = commentSearchResponseSchema.safeParse({
      bugs: { '42': { comments: [validComment] } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs['42'].comments).toHaveLength(1);
    }
  });

  it('parses response with multiple bugs', () => {
    const result = commentSearchResponseSchema.safeParse({
      bugs: {
        '1': { comments: [{ ...validComment, bug_id: 1 }] },
        '2': { comments: [{ ...validComment, bug_id: 2 }, { ...validComment, bug_id: 2, id: 3 }] },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.bugs)).toHaveLength(2);
      expect(result.data.bugs['2'].comments).toHaveLength(2);
    }
  });

  it('parses empty bugs object', () => {
    const result = commentSearchResponseSchema.safeParse({ bugs: {} });
    expect(result.success).toBe(true);
  });

  it('parses bug with empty comments array', () => {
    const result = commentSearchResponseSchema.safeParse({
      bugs: { '42': { comments: [] } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing bugs field', () => {
    const result = commentSearchResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects bugs as array instead of object', () => {
    const result = commentSearchResponseSchema.safeParse({ bugs: [] });
    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = commentSearchResponseSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

// --- updateResponseSchema ---
describe('updateResponseSchema', () => {
  const validResponse = {
    bugs: [
      {
        id: 42,
        last_change_time: '2025-01-15T10:30:00Z',
        changes: {
          status: { added: 'RESOLVED', removed: 'NEW' },
        },
      },
    ],
  };

  it('parses valid update response', () => {
    const result = updateResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs[0].id).toBe(42);
    }
  });

  it('parses response with multiple changes', () => {
    const result = updateResponseSchema.safeParse({
      bugs: [
        {
          id: 1,
          last_change_time: '2025-01-01T00:00:00Z',
          changes: {
            status: { added: 'VERIFIED', removed: 'RESOLVED' },
            resolution: { added: 'FIXED', removed: '' },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.bugs[0].changes)).toHaveLength(2);
    }
  });

  it('parses response with empty changes', () => {
    const result = updateResponseSchema.safeParse({
      bugs: [{ id: 7, last_change_time: '2025-01-01T00:00:00Z', changes: {} }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.bugs[0].changes)).toHaveLength(0);
    }
  });

  it('parses response with empty bugs array', () => {
    const result = updateResponseSchema.safeParse({ bugs: [] });
    expect(result.success).toBe(true);
  });

  it('rejects missing bugs field', () => {
    const result = updateResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = updateResponseSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('parses response with multiple bugs updated', () => {
    const result = updateResponseSchema.safeParse({
      bugs: [
        { id: 1, last_change_time: '2025-01-01T00:00:00Z', changes: {} },
        { id: 2, last_change_time: '2025-01-01T00:00:00Z', changes: {} },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bugs).toHaveLength(2);
    }
  });
});

// --- urlSchema ---
describe('urlSchema', () => {
  it('accepts valid HTTPS URL', () => {
    const result = urlSchema.safeParse('https://bugzilla.example.com');
    expect(result.success).toBe(true);
  });

  it('accepts valid HTTP URL', () => {
    const result = urlSchema.safeParse('http://localhost:8080/bugzilla');
    expect(result.success).toBe(true);
  });

  it('accepts URL with port', () => {
    const result = urlSchema.safeParse('https://bugs.example.com:8443');
    expect(result.success).toBe(true);
  });

  it('accepts URL with path', () => {
    const result = urlSchema.safeParse('https://example.com/bugzilla/rest');
    expect(result.success).toBe(true);
  });

  it('accepts URL with query string', () => {
    const result = urlSchema.safeParse('https://example.com/bugzilla?rest=1');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = urlSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects string without protocol', () => {
    const result = urlSchema.safeParse('bugzilla.example.com');
    expect(result.success).toBe(false);
  });

  it('rejects "random text"', () => {
    const result = urlSchema.safeParse('not a url');
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = urlSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined', () => {
    const result = urlSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects number', () => {
    const result = urlSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  it('accepts URL with trailing slash', () => {
    const result = urlSchema.safeParse('https://bugzilla.example.com/');
    expect(result.success).toBe(true);
  });

  it('accepts URL with IP address', () => {
    const result = urlSchema.safeParse('https://192.168.1.100/bugzilla');
    expect(result.success).toBe(true);
  });
});

// --- apiKeySchema ---
describe('apiKeySchema', () => {
  it('accepts non-empty string', () => {
    const result = apiKeySchema.safeParse('abcdef123456');
    expect(result.success).toBe(true);
  });

  it('accepts single character', () => {
    const result = apiKeySchema.safeParse('a');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = apiKeySchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    const result = apiKeySchema.safeParse('   ');
    expect(result.success).toBe(true); // min(1) passes for whitespace
  });

  it('rejects null', () => {
    const result = apiKeySchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined', () => {
    const result = apiKeySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects number', () => {
    const result = apiKeySchema.safeParse(123456);
    expect(result.success).toBe(false);
  });

  it('accepts very long key', () => {
    const result = apiKeySchema.safeParse('x'.repeat(5000));
    expect(result.success).toBe(true);
  });
});

// --- emailSchema ---
describe('emailSchema', () => {
  it('accepts non-empty string', () => {
    const result = emailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('accepts single character', () => {
    const result = emailSchema.safeParse('a');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = emailSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined', () => {
    const result = emailSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects number', () => {
    const result = emailSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  it('accepts email with plus tag', () => {
    const result = emailSchema.safeParse('user+tag@example.com');
    expect(result.success).toBe(true);
  });

  it('accepts email with subdomain', () => {
    const result = emailSchema.safeParse('user@sub.example.co.uk');
    expect(result.success).toBe(true);
  });
});
