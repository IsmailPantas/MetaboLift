import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const parseFirebaseError = error => {
  const code = error?.code || '';
  if (code.includes('popup-closed-by-user')) return 'Google giriş penceresi kapatıldı.';
  if (code.includes('cancelled-popup-request')) return 'Google giriş isteği iptal edildi.';
  if (code.includes('account-exists-with-different-credential')) return 'Bu e-posta başka bir giriş yöntemiyle kayıtlı.';
  if (code.includes('invalid-credential')) return 'E-posta veya şifre hatalı.';
  if (code.includes('email-already-in-use')) return 'Bu e-posta zaten kayıtlı.';
  if (code.includes('weak-password')) return 'Şifre en az 6 karakter olmalı.';
  if (code.includes('invalid-email')) return 'Geçerli bir e-posta adresi girin.';
  if (code.includes('too-many-requests')) return 'Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.';
  return error?.message || 'Beklenmeyen bir hata oluştu.';
};

const VALID_PREMIUM_PLANS = new Set(['free', 'premium', 'elite_premium', 'elite_premium_plus']);
const PLAN_AI_DAILY_LIMITS = {
  free: 2,
  premium: 12,
  elite_premium: 30,
  elite_premium_plus: 75,
};

const normalizePremium = premium => ({
  plan: VALID_PREMIUM_PLANS.has(premium?.plan) ? premium.plan : 'free',
  status: premium?.status || 'inactive',
  startedAt: premium?.startedAt || null,
  expiresAt: premium?.expiresAt || null,
  updatedAt: premium?.updatedAt || null,
});

const normalizeAiUsage = (aiUsage, premium) => ({
  dailyCount: Number(aiUsage?.dailyCount) || 0,
  dailyLimit: Number(aiUsage?.dailyLimit) || PLAN_AI_DAILY_LIMITS[premium?.plan] || 1,
  lastResetAt: aiUsage?.lastResetAt || null,
  updatedAt: aiUsage?.updatedAt || null,
});

const buildUserPayload = (uid, profile = {}) => {
  const normalizedPremium = normalizePremium(profile.premium);
  return {
    id: uid,
    _id: uid,
    uid,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    birthDate: profile.birthDate || '',
    gender: profile.gender || '',
    height: profile.height || 0,
    weight: profile.weight || 0,
    dailyCalories: profile.dailyCalories || 0,
    fatPercent: profile.fatPercent || 0,
    authProvider: profile.authProvider || 'password',
    hasDisease: Boolean(profile.hasDisease),
    diseases: Array.isArray(profile.diseases) ? profile.diseases : [],
    role: profile.role || 'user',
    points: Number(profile.points) || 0,
    premium: normalizedPremium,
    aiUsage: normalizeAiUsage(profile.aiUsage, normalizedPremium),
  };
};

const isProfileComplete = user => {
  if (!user) return false;
  const hasRequiredText = Boolean(user.firstName && user.lastName && user.birthDate && user.gender);
  const hasRequiredNumbers = Number(user.height) > 0 && Number(user.weight) > 0;
  return hasRequiredText && hasRequiredNumbers;
};

const resolveUserProfile = async (firebaseUser, overrides = {}) => {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return buildUserPayload(firebaseUser.uid, snap.data());
  }

  return buildUserPayload(firebaseUser.uid, {
    firstName: overrides.firstName || firebaseUser.firstName || '',
    lastName: overrides.lastName || firebaseUser.lastName || '',
    email: overrides.email || firebaseUser.email || '',
    authProvider: overrides.authProvider || firebaseUser.authProvider || 'password',
    hasDisease: Boolean(overrides.hasDisease),
    diseases: Array.isArray(overrides.diseases) ? overrides.diseases : [],
    role: 'user',
    points: 0,
  });
};

const request = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || 'İstek başarısız oldu.';
    throw new Error(message);
  }
  return payload;
};

export const authService = {
  login: async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdToken();
      const user = await resolveUserProfile(credential.user, {
        email: credential.user.email || email,
        authProvider: 'password',
      });

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);
      localStorage.setItem('profileComplete', isProfileComplete(user) ? 'true' : 'false');

      return { success: true, user };
    } catch (error) {
      throw new Error(parseFirebaseError(error));
    }
  },

  register: async payload => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      const userPayload = buildUserPayload(credential.user.uid, {
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        email: payload.email,
        authProvider: 'password',
        hasDisease: Boolean(payload.hasDisease),
        diseases: Array.isArray(payload.diseases) ? payload.diseases : [],
      });

      const token = await credential.user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userPayload));
      localStorage.setItem('userId', userPayload.id);
      localStorage.setItem('profileComplete', 'false');

      return { success: true, user: userPayload };
    } catch (error) {
      throw new Error(parseFirebaseError(error));
    }
  },

  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const credential = await signInWithPopup(auth, provider);
      const token = await credential.user.getIdToken();
      const fallbackName = credential.user.displayName || '';
      const [firstName = '', ...lastNameParts] = fallbackName.split(' ');
      const user = await resolveUserProfile(credential.user, {
        firstName,
        lastName: lastNameParts.join(' '),
        authProvider: 'google',
      });

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);
      localStorage.setItem('profileComplete', isProfileComplete(user) ? 'true' : 'false');

      return { success: true, user };
    } catch (error) {
      throw new Error(parseFirebaseError(error));
    }
  },

  completeProfile: async profile => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Profil güncellemek için yeniden giriş yapın.');
    }

    const userRef = doc(db, 'users', current.uid);
    const existingSnapshot = await getDoc(userRef);
    const existingDbUser = existingSnapshot.exists() ? existingSnapshot.data() : {};
    const existingLocal = authService.getCurrentUser() || {};
    const nextUser = buildUserPayload(current.uid, {
      ...existingDbUser,
      ...existingLocal,
      ...profile,
      email: existingDbUser.email || existingLocal.email || current.email || '',
      height: Number(profile.height),
      weight: Number(profile.weight),
      hasDisease: Boolean(profile.hasDisease),
      diseases: Array.isArray(profile.diseases) ? profile.diseases : [],
      role: existingDbUser.role || existingLocal.role || 'user',
      points: Number(existingDbUser.points ?? existingLocal.points ?? 0),
    });

    await setDoc(
      userRef,
      {
        ...nextUser,
        createdAt: existingDbUser.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    localStorage.setItem('user', JSON.stringify(nextUser));
    localStorage.setItem('userId', nextUser.id);
    localStorage.setItem('profileComplete', isProfileComplete(nextUser) ? 'true' : 'false');

    return { success: true, user: nextUser };
  },

  logout: async () => {
    await signOut(auth);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('profileComplete');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isProfileComplete,
};

export const bodyAnalysisService = {
  getAnalysis: async (userId) => {
    return request(`/body-analysis/${userId}`, { method: 'GET' });
  },

  saveAnalysis: async (userId, data) => {
    return request(`/body-analysis/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};