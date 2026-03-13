import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { fetchAndActivate, getBoolean, getRemoteConfig } from "firebase/remote-config";
import { debugLog, setVerboseLoggingEnabled, warnLog } from "./logger";

function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy web/.env.example to web/.env and set all VITE_FIREBASE_* values.`,
    );
  }

  return value.trim();
}

const firebaseConfig = {
  apiKey: getRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: getRequiredEnv("VITE_FIREBASE_DATABASE_URL"),
  projectId: getRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRequiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getRequiredEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;

if (typeof window !== "undefined") {
  if (import.meta.env.DEV && window.location.hostname === "localhost") {
    // Local development can use the App Check debug flow.
    const token = typeof appCheckDebugToken === "string" ? appCheckDebugToken.trim() : "";
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      token.length > 0 ? token : true;
  }

  if (typeof appCheckSiteKey === "string" && appCheckSiteKey.trim() !== "") {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    warnLog(
      "firebase",
      "Firebase App Check site key is missing. Set VITE_FIREBASE_APPCHECK_SITE_KEY to call protected functions.",
    );
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

try {
  const remoteConfig = getRemoteConfig(app);
  remoteConfig.settings = {
    minimumFetchIntervalMillis: import.meta.env.DEV ? 0 : 60 * 60 * 1000,
  };
  remoteConfig.defaultConfig = {
    logs_verbose_enabled: false,
  };

  void fetchAndActivate(remoteConfig)
    .then(() => {
      const verboseEnabled = getBoolean(remoteConfig, "logs_verbose_enabled");
      setVerboseLoggingEnabled(verboseEnabled);
      debugLog("remote-config", "Updated logs_verbose_enabled flag", { verboseEnabled });
    })
    .catch((error: unknown) => {
      warnLog("remote-config", "Failed to fetch remote config for logging flag", error);
      setVerboseLoggingEnabled(false);
    });
} catch (error) {
  warnLog("remote-config", "Remote config initialization unavailable; verbose logging disabled", error);
  setVerboseLoggingEnabled(false);
}
