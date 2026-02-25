---
name: firebase-basics
description: Guide for setting up and using Firebase. Use this skill when getting started with Firebase, setting up local environment, using Firebase for the first time, or adding Firebase to an app.
---

## Prerequisites

### Node.js and npm

Use Node.js 20+ and npm to run Firebase CLI commands.

Prefer `nvm` to avoid global install permission issues.

1. Install `nvm`.
2. Install and activate a recent Node.js version.
3. Verify versions with:
   ```bash
   node --version
   npm --version
   ```

## Core Workflow

### 1. Installation

Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```

Verify installation:
   ```bash
   firebase --version
   ```

### 2. Authentication

Log in to Firebase:
   ```bash
   firebase login
   ```

Use `firebase login --no-localhost` in environments where localhost is not available.

### 3. Creating a Project

Create a new Firebase project from CLI:
   ```bash
   firebase projects:create
   ```

Provide:
1. A globally unique Project ID.
2. A display name.

### 4. Initialization

Initialize Firebase services in the project directory:
   ```bash
   mkdir my-project
   cd my-project
   firebase init
   ```

Select required services during init (Firestore, Functions, Hosting, etc.) and generate `firebase.json` with `.firebaserc`.

## Exploring Commands

Use CLI help to discover and inspect commands:

- Global help:
  ```bash
  firebase --help
  ```
- Command help:
  ```bash
  firebase [command] --help
  firebase deploy --help
  firebase firestore:indexes --help
  ```

## SDK Setup

- Web setup guide: See [references/web_setup.md](references/web_setup.md)

## Common Issues

- Resolve `EACCES` errors by using `nvm` (preferred) or elevated install permissions.
- Use `firebase login --no-localhost` if browser-based auth fails.
