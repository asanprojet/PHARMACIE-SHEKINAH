import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed:", error);
  }
};
