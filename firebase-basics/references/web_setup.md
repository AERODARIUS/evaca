# Firebase Web Setup

## Install SDK

Install the Firebase Web SDK:

```bash
npm install firebase
```

## Create Firebase App Config

1. Open Firebase Console and select the project.
2. Register a Web app if one does not exist.
3. Copy the Firebase config object.

## Initialize in Code

Create a module (for example `src/firebase.ts`) and initialize services used by the app.

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
```

## Environment and Safety

- Keep config in environment variables where possible.
- Do not commit secrets or service account keys to the repository.
- Restrict access with Firebase security rules.
