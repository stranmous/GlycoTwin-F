// Legacy Firebase stubs replaced by native FastAPI JWT auth (Module M4)
// Kept for backward compatibility without importing firebase/auth SDK

import { useAuthStore } from './authStore';

export const auth = null;

export async function signInEmail(email: string, password: string): Promise<{ token: string; uid: string; email: string }> {
  await useAuthStore.getState().signIn({ email, password });
  const state = useAuthStore.getState();
  return { token: state.token ?? '', uid: state.uid ?? '', email: state.email ?? email };
}

export async function signUpEmail(email: string, password: string): Promise<{ token: string; uid: string; email: string }> {
  await useAuthStore.getState().signUp({ email, password });
  const state = useAuthStore.getState();
  return { token: state.token ?? '', uid: state.uid ?? '', email: state.email ?? email };
}

export async function signInWithGoogle(): Promise<{ token: string; uid: string; email: string }> {
  // For dev demo without Google OAuth credentials, log in with demo account
  await useAuthStore.getState().signIn({ email: 'google_user@glycotwin.local', password: 'Password123!' }).catch(async () => {
    await useAuthStore.getState().signUp({ email: 'google_user@glycotwin.local', password: 'Password123!' });
  });
  const state = useAuthStore.getState();
  return { token: state.token ?? '', uid: state.uid ?? '', email: state.email ?? '' };
}

export async function resetPassword(email: string): Promise<void> {
  // Native password reset stub
  return Promise.resolve();
}

export async function checkEmailVerified(): Promise<boolean> {
  return true;
}

export async function resendVerificationEmail(): Promise<void> {
  return Promise.resolve();
}

export async function signOut(): Promise<void> {
  await useAuthStore.getState().signOut();
}

export async function deleteCurrentUser(): Promise<void> {
  await useAuthStore.getState().deleteAccount();
}
