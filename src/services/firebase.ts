import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore, type FirestoreSettings } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
// Web only: keep Firestore Listen on long-polling XHR instead of the streaming
// WebChannel. Chrome keeps trying HTTP/3 (QUIC) for googleapis, which drops
// with ERR_QUIC_PROTOCOL_ERROR.QUIC_TOO_MANY_RTOS on flaky campus networks and
// kills realtime listeners. experimentalForceLongPolling disables the stream
// entirely — auto-detect alone can still pick streaming when QUIC is present.
// Options are ignored on native (the mobile SDK doesn't read them).
export const db: Firestore = (() => {
  const settings: FirestoreSettings =
    Platform.OS === "web" ? { experimentalForceLongPolling: true } : {};
  try {
    return initializeFirestore(app, settings);
  } catch {
    // Already initialized (HMR re-evaluation, or an earlier default init):
    // return the existing instance instead of throwing "has already been
    // called with different options". Long-polling is a best-effort transport
    // improvement, not a hard requirement.
    return getFirestore(app);
  }
})();
export const storage = getStorage(app);

export function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user;
}
