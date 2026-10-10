import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  deleteUser,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { env } from './env';

function ensureApp() {
  const apps = getApps();
  if (apps.length === 0) {
    const app = initializeApp({
      apiKey: env.firebase.apiKey || 'dev-bypass',
      authDomain: env.firebase.authDomain,
      projectId: env.firebase.projectId,
      appId: env.firebase.appId,
    });
    
    if (Platform.OS === 'web') {
      getAuth(app);
    } else {
      initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  }
  return getAuth();
}

export async function signInEmail(email: string, password: string) {
  if (env.authDevBypass) {
    return { uid: `dev-${email}`, token: `dev-${email}`, email };
  }
  const auth = ensureApp();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  return { uid: cred.user.uid, token, email: cred.user.email ?? email };
}

export async function signUpEmail(email: string, password: string) {
  if (env.authDevBypass) {
    return { uid: `dev-${email}`, token: `dev-${email}`, email };
  }
  const auth = ensureApp();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Send verification email immediately after creation
  await sendEmailVerification(cred.user);
  const token = await cred.user.getIdToken();
  return { uid: cred.user.uid, token, email: cred.user.email ?? email };
}

/**
 * Reloads the current user from Firebase to check if their email has been
 * verified. Returns true if verified, false otherwise.
 */
export async function checkEmailVerified(): Promise<boolean> {
  const auth = ensureApp();
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
}

/**
 * Resends a verification email to the currently signed-in user.
 */
export async function resendVerificationEmail(): Promise<void> {
  const auth = ensureApp();
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

/**
 * Permanently deletes the currently signed-in Firebase user.
 * Used when a new user cancels before verifying their email so
 * the unverified account is cleaned up from Firebase Authentication.
 */
export async function deleteCurrentUser(): Promise<void> {
  if (env.authDevBypass) return;
  const auth = ensureApp();
  if (!auth.currentUser) return;
  await deleteUser(auth.currentUser);
}

export async function signOut() {
  if (env.authDevBypass) return;
  const auth = ensureApp();
  await fbSignOut(auth);
}

export async function resetPassword(email: string) {
  if (env.authDevBypass) return;
  const auth = ensureApp();
  await sendPasswordResetEmail(auth, email);
}

import { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';

export async function signInWithGoogle() {
  if (env.authDevBypass) {
    return { uid: `dev-google`, token: `dev-google`, email: 'google@dev.local', isNewUser: true };
  }
  const auth = ensureApp();
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const token = await cred.user.getIdToken();
    const addl = getAdditionalUserInfo(cred);
    return { uid: cred.user.uid, token, email: cred.user.email ?? 'google@user', isNewUser: addl?.isNewUser ?? false };
  } else {
    throw new Error('Google Sign-In is only configured for the web version at the moment.');
  }
}
