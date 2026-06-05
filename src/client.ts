export interface BugzillaUser {
  id: number;
  name: string;
  real_name: string;
  email: string;
}

export interface Bug {
  id: number;
  summary: string;
  severity: string;
  priority: string;
  status: string;
  assigned_to: string;
  product: string;
  component: string;
}

interface WhoamiResponse {
  id: number;
  name: string;
  real_name: string;
}

interface BugSearchResponse {
  bugs: Bug[];
}

export class BugzillaClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'BugzillaClientError';
  }
}

export class BugzillaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-BUGZILLA-API-KEY': this.apiKey,
      'Accept': 'application/json',
    };

    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BugzillaClientError(`Failed to connect to Bugzilla at ${this.baseUrl}: ${message}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new BugzillaClientError('Authentication failed. Please check your Bugzilla API Key.', 401);
      }
      if (response.status === 404) {
        throw new BugzillaClientError(`Bugzilla endpoint not found at ${url}. Verify your Base URL.`, 404);
      }
      const body = await response.text().catch(() => '');
      throw new BugzillaClientError(
        `Bugzilla API error (${response.status}): ${body || response.statusText}`,
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  async whoami(): Promise<BugzillaUser> {
    const data = await this.request<WhoamiResponse>('/rest/whoami');
    return {
      ...data,
      email: data.name, // Bugzilla typically sets name to the email address
    };
  }

  async getAssignedBugs(email: string): Promise<Bug[]> {
    const params = new URLSearchParams({
      assigned_to: email,
      status: 'NEW',
    });
    params.append('status', 'ASSIGNED');
    params.append('status', 'REOPENED');

    const data = await this.request<BugSearchResponse>(`/rest/bug?${params.toString()}`);
    return data.bugs;
  }
}
