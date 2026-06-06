import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

let authBootstrapPromise = null;

export const waitForAuthBootstrap = (timeoutMs = 4000) => {
  if (auth.currentUser) return Promise.resolve();
  if (authBootstrapPromise) return authBootstrapPromise;

  authBootstrapPromise = new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe();
      finish();
    });

    setTimeout(() => {
      unsubscribe();
      finish();
    }, timeoutMs);
  }).finally(() => {
    authBootstrapPromise = null;
  });

  return authBootstrapPromise;
};

export const getCurrentUserOrThrow = async (
  message = 'Islem icin once giris yapmalisin.',
  timeoutMs = 4000
) => {
  await waitForAuthBootstrap(timeoutMs);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error(message);
  }
  return currentUser;
};

