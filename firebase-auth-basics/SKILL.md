---
name: firebase-auth-basics
description: Guide for Firebase Authentication setup and usage. Use when enabling sign-in providers, implementing client authentication flows, managing tokens, and enforcing auth-based data access.
---

# Firebase Auth Basics

## Prerequisites

- Firebase project already exists.
- Firebase CLI is installed and authenticated.

## Core Concepts

- A signed-in user is identified by unique `uid`.
- Common user fields: `email`, `displayName`, `photoURL`, `emailVerified`.
- ID token (JWT) is short-lived (~1 hour); refresh token renews session.

## Provider Setup

1. Enable supported providers.
2. Use Firebase Console for broader provider support (Google, Apple, GitHub, etc.).
3. Use CLI/config-based setup only where provider support is explicitly available.

## Client Integration (Web)

1. Install SDK:
   ```bash
   npm install firebase
   ```
2. Initialize Auth client.
3. Implement explicit sign-in and sign-out paths.
4. Handle auth state listeners to keep UI and session state synchronized.

## Security Rules Integration

- Use `request.auth` checks in Firestore/Storage rules.
- Block sensitive reads/writes when user is unauthenticated.
- Scope document access by `request.auth.uid` where applicable.
