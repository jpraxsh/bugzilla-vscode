import { z } from 'zod';
import {
  Bug,
  Comment,
  bugSearchResponseSchema,
  commentSearchResponseSchema,
  updateResponseSchema,
} from './schemas';

export type { Bug, Comment } from './schemas';

export class BugzillaClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'BugzillaClientError';
  }
}

const RETRY_MAX = 2;
const RETRY_DELAYS = [1000, 2000];

export class BugzillaClient {
  private baseUrl: string;
  private apiKey: string;
  private userEmail: string;

  constructor(baseUrl: string, apiKey: string, email: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.userEmail = email;
  }

  get email(): string {
    return this.userEmail;
  }

  private async request<T>(
    path: string,
    schema: z.ZodSchema<T>,
    init?: RequestInit
  ): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${path}${separator}api_key=${encodeURIComponent(this.apiKey)}`;
    const headers: Record<string, string> = {
      'X-BUGZILLA-API-KEY': this.apiKey,
      'Accept': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { ...init, headers });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = new BugzillaClientError(
          `Failed to connect to Bugzilla at ${this.baseUrl}: ${message}`
        );
        if (attempt < RETRY_MAX) {
          await this.delay(RETRY_DELAYS[attempt]);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new BugzillaClientError(
            'Authentication failed. Please check your Bugzilla API Key.',
            401
          );
        }
        if (response.status === 404) {
          throw new BugzillaClientError(
            `Bugzilla endpoint not found at ${url}. Verify your Base URL.`,
            404
          );
        }

        // Retry on 5xx
        if (response.status >= 500 && attempt < RETRY_MAX) {
          await this.delay(RETRY_DELAYS[attempt]);
          continue;
        }

        const body = await response.text().catch(() => '');
        throw new BugzillaClientError(
          `Bugzilla API error (${response.status}): ${body || response.statusText}`,
          response.status
        );
      }

      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new BugzillaClientError('Failed to parse Bugzilla API response');
      }

      const result = schema.safeParse(raw);
      if (!result.success) {
        throw new BugzillaClientError(
          `Unexpected API response format: ${result.error.message}`
        );
      }

      return result.data;
    }

    throw lastError ?? new BugzillaClientError('Request failed after retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getAssignedBugs(email: string): Promise<Bug[]> {
    const params = new URLSearchParams({
      assigned_to: email,
      status: 'UNCONFIRMED',
    });
    params.append('status', 'CONFIRMED');
    params.append('status', 'NEW');
    params.append('status', 'ASSIGNED');
    params.append('status', 'REOPENED');

    const data = await this.request<{ bugs: Bug[] }>(
      `/rest/bug?${params.toString()}`,
      bugSearchResponseSchema
    );
    return data.bugs;
  }

  async getBugComments(bugId: number): Promise<Comment[]> {
    const data = await this.request<{ bugs: Record<string, { comments: Comment[] }> }>(
      `/rest/bug/${bugId}/comment`,
      commentSearchResponseSchema
    );
    const bugComments = data.bugs[String(bugId)];
    if (!bugComments) {
      return [];
    }
    return bugComments.comments;
  }

  async updateBugStatus(
    bugId: number,
    status: string,
    resolution?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      ids: [bugId],
      status,
    };
    if (resolution) {
      body.resolution = resolution;
    }

    await this.request(
      `/rest/bug/${bugId}`,
      updateResponseSchema,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  }
}
