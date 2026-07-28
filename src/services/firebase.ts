import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
export const db = getFirestore(app);
export const storage = getStorage(app);

export function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user;
}
