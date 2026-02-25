---
name: firebase-hosting-basics
description: Skill for Firebase Hosting (Classic). Use when deploying static sites, SPAs, preview channels, redirects, rewrites, headers, and release workflows. Do not use for Firebase App Hosting.
---

# Firebase Hosting Basics

## Choose Hosting Type

Use Firebase Hosting (Classic) for:
- Static sites (HTML/CSS/JS).
- SPAs without SSR/ISR.
- CLI-controlled deploy pipelines.

Use Firebase App Hosting for framework-native SSR/ISR workflows.

## Configuration

1. Initialize hosting:
   ```bash
   firebase init hosting
   ```
2. Configure `firebase.json`:
- `public` for static output directory.
- `rewrites` for SPA routing or backend handoff.
- `redirects` for URL migration.
- `headers` for caching and security.

## Deploying

- Deploy to production:
  ```bash
  firebase deploy --only hosting
  ```
- Create preview channels for review:
  ```bash
  firebase hosting:channel:deploy <channel-name>
  ```
- Promote validated release through normal deploy workflow.

## Local Emulation

Test hosting locally:
```bash
firebase emulators:start --only hosting
```
Default URL: `http://localhost:5000`.
