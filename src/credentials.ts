import * as vscode from 'vscode';

const URL_KEY = 'bugzilla.baseUrl';
const API_KEY_SECRET = 'bugzilla.apiKey';

export class CredentialsManager {
  constructor(private context: vscode.ExtensionContext) {}

  async setCredentials(): Promise<void> {
    const url = await vscode.window.showInputBox({
      prompt: 'Enter your Bugzilla Base URL',
      placeHolder: 'https://bugzilla.example.com',
      validateInput: (value) => {
        if (!value) {
          return 'Base URL is required';
        }
        try {
          new URL(value);
        } catch {
          return 'Please enter a valid URL';
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
      validateInput: (value) => {
        if (!value) {
          return 'API Key is required';
        }
        return null;
      }
    });

    if (!apiKey) {
      return;
    }

    await this.setBaseUrl(url);
    await this.setApiKey(apiKey);
    vscode.window.showInformationMessage('Bugzilla credentials saved successfully.');
  }

  async setBaseUrl(url: string): Promise<void> {
    await this.context.globalState.update(URL_KEY, url);
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(API_KEY_SECRET, apiKey);
  }

  getBaseUrl(): string | undefined {
    return this.context.globalState.get<string>(URL_KEY);
  }

  async getApiKey(): Promise<string | undefined> {
    return this.context.secrets.get(API_KEY_SECRET);
  }

  async getCredentials(): Promise<{ baseUrl: string; apiKey: string } | undefined> {
    const baseUrl = this.getBaseUrl();
    const apiKey = await this.getApiKey();

    if (!baseUrl || !apiKey) {
      return undefined;
    }

    // Normalize trailing slash
    const normalizedUrl = baseUrl.replace(/\/+$/, '');

    return { baseUrl: normalizedUrl, apiKey };
  }

  hasCredentials(): boolean {
    return !!this.getBaseUrl();
  }

  async clearCredentials(): Promise<void> {
    await this.context.globalState.update(URL_KEY, undefined);
    await this.context.secrets.delete(API_KEY_SECRET);
  }
}
