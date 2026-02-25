---
name: firebase-firestore-basics
description: Guide for Firestore provisioning, security rules, and SDK usage. Use when setting up Cloud Firestore, defining access rules, troubleshooting queries, or integrating Firestore into application code.
---

# Firestore Basics

## Provisioning

1. Ensure a Firebase project exists and CLI auth is complete.
2. Initialize Firestore in the project:
   ```bash
   firebase init firestore
   ```
3. Confirm generated files include Firestore rules and indexes configuration.

## Security Rules

- Define least-privilege access in Firestore rules.
- Validate rules against expected read/write patterns before deploy.
- Deploy rules explicitly:
  ```bash
  firebase deploy --only firestore:rules
  ```

## SDK Usage (Web Modular)

1. Install Firebase SDK:
   ```bash
   npm install firebase
   ```
2. Initialize app and Firestore client in code.
3. Use structured collection/document paths and explicit converters when schema stability matters.

## Indexes

- Create composite indexes for multi-field query filters or ordered queries.
- Deploy index config when needed:
  ```bash
  firebase deploy --only firestore:indexes
  ```
- Use Firestore error links from failed queries to generate missing index definitions quickly.
