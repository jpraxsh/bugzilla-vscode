import * as vscode from 'vscode';
import { urlSchema, apiKeySchema, emailSchema } from './schemas';

const URL_KEY = 'bugzilla.baseUrl';
const API_KEY_SECRET = 'bugzilla.apiKey';
const EMAIL_KEY = 'bugzilla.email';

export class CredentialsManager {
  constructor(private context: vscode.ExtensionContext) {}

  async setCredentials(): Promise<void> {
    const url = await vscode.window.showInputBox({
      prompt: 'Enter your Bugzilla Base URL',
      placeHolder: 'https://bugzilla.example.com',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Base URL is required';
        }
        const result = urlSchema.safeParse(value);
        if (!result.success) {
          return result.error.errors[0].message;
        }
        return null;
      }
    });

    if (!url) {
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Bugzilla API Key',
      placeHolder: 'Your API Key',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'API Key is required';
        }
        const result = apiKeySchema.safeParse(value);
        if (!result.success) {
          return result.error.errors[0].message;
        }
        return null;
      }
    });

    if (!apiKey) {
      return;
    }

    const email = await vscode.window.showInputBox({
      prompt: 'Enter your Bugzilla email address',
      placeHolder: 'you@example.com',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Email is required';
        }
        const result = emailSchema.safeParse(value);
        if (!result.success) {
          return result.error.errors[0].message;
        }
        return null;
      }
    });

    if (!email) {
      return;
    }

    await this.setBaseUrl(url);
    await this.setApiKey(apiKey);
    await this.setEmail(email);
    vscode.window.showInformationMessage('Bugzilla credentials saved successfully.');
  }

  async setBaseUrl(url: string): Promise<void> {
    await this.context.globalState.update(URL_KEY, url);
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(API_KEY_SECRET, apiKey);
  }

  async setEmail(email: string): Promise<void> {
    await this.context.globalState.update(EMAIL_KEY, email);
  }

  getBaseUrl(): string | undefined {
    return this.context.globalState.get<string>(URL_KEY);
  }

  async getApiKey(): Promise<string | undefined> {
    return this.context.secrets.get(API_KEY_SECRET);
  }

  getEmail(): string | undefined {
    return this.context.globalState.get<string>(EMAIL_KEY);
  }

  async getCredentials(): Promise<{ baseUrl: string; apiKey: string; email: string } | undefined> {
    const baseUrl = this.getBaseUrl();
    const apiKey = await this.getApiKey();
    const email = this.getEmail();

    if (!baseUrl || !apiKey || !email) {
      return undefined;
    }

    const normalizedUrl = baseUrl.replace(/\/+$/, '');

    return { baseUrl: normalizedUrl, apiKey, email };
  }

  hasCredentials(): boolean {
    return !!this.getBaseUrl() && !!this.getEmail();
  }

  async clearCredentials(): Promise<void> {
    await this.context.globalState.update(URL_KEY, undefined);
    await this.context.globalState.update(EMAIL_KEY, undefined);
    await this.context.secrets.delete(API_KEY_SECRET);
    vscode.window.showInformationMessage('Bugzilla credentials cleared.');
  }
}
