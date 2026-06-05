# Bugzilla Plugin

Manage Bugzilla bugs from within VS Code. View assigned bugs, read comments, and update bug status — all without leaving your editor.

## Features

- **Tree View** — See all bugs assigned to you in the sidebar with severity icons and color-coded priorities
- **Rich Bug Details** — Click any bug to open a webview panel with formatted fields, severity/priority badges, and a status update form
- **Status Updates** — Change bug status directly from VS Code, including resolution selection for terminal states (RESOLVED, VERIFIED, CLOSED)
- **Comments** — View all comments on a bug with author and timestamp
- **Status Bar Indicator** — Shows connection status at a glance; click to refresh
- **Input Focus Fix** — Credential input boxes stay open even when switching tabs
- **Automatic Retry** — Network errors are retried automatically with exponential backoff
- **Secure Storage** — API keys stored in VS Code SecretStorage, never in plain text
- **Zod Validation** — All API responses are validated at runtime with Zod schemas

## Requirements

- **VS Code** 1.85.0 or later
- **Bugzilla** 5.0+ with the REST API enabled

## Installation

1. Download the `.vsix` file or build from source:

```bash
npm install
npm run compile
npx vsce package
```

2. Install in VS Code:

```bash
code --install-extension bugzilla-vscode-plugin-0.0.1.vsix
```

## Setup

### Getting a Bugzilla API Key

1. Log in to your Bugzilla instance
2. Go to **Preferences** → **API Keys**
3. Click **Generate a new API Key**
4. Copy the generated key

### Configuring the Extension

1. Click the **Bugzilla Plugin** bug icon in the activity bar
2. Click the **key icon** in the tree view header (or run `Bugzilla: Set Credentials`)
3. Enter your Bugzilla Base URL (e.g. `https://bugzilla.example.com`)
4. Enter your API Key
5. Enter your Bugzilla email address (used to find bugs assigned to you)

The extension connects automatically and loads your assigned bugs.

## Usage

### Viewing Bugs

Your assigned bugs appear in the **Assigned to Me** tree view. Bugs are color-coded by severity:

- 🔴 **Critical / Blocker** — Red error icon
- 🟠 **Major** — Orange warning icon
- 🔵 **Normal** — Blue info icon

Click any bug to open the detail panel.

### Updating Bug Status

1. Open a bug's details by clicking it in the tree
2. In the **Details** tab, select a new status from the dropdown
3. If selecting a terminal status (RESOLVED, VERIFIED, CLOSED), choose a resolution
4. Click **Update Status**

The tree refreshes automatically after any update.

### Reading Comments

Switch to the **Comments** tab in the bug detail panel to see all comments chronologically.

### Refreshing

- Click the **refresh icon** in the tree view header
- Click the **Bugzilla** status bar item
- Run `Bugzilla: Refresh Bugs` from the command palette

### Clearing Credentials

- Click the **trash icon** in the tree view header
- Or run `Bugzilla: Clear Credentials` from the command palette

## Commands

| Command | Description |
|---|---|
| `Bugzilla: Set Credentials` | Set or update Bugzilla URL and API key |
| `Bugzilla: Refresh Bugs` | Refresh the assigned bugs list |
| `Bugzilla: Clear Credentials` | Remove saved credentials |
| `Bugzilla: Show Bug Details` | Open bug detail webview (available on tree item right-click) |
