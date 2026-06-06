import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const mealPlansRef = collection(db, 'mealPlans');
const usersRef = collection(db, 'users');

const emptyDay = () => ({ meals: [] });

const ensureDaysShape = days => {
  const source = days && typeof days === 'object' ? days : {};
  return DAY_KEYS.reduce((acc, dayKey) => {
    const dayData = source[dayKey] && typeof source[dayKey] === 'object' ? source[dayKey] : {};
    acc[dayKey] = {
      meals: Array.isArray(dayData.meals) ? dayData.meals : [],
    };
    return acc;
  }, {});
};

const normalizePlan = raw => ({
  id: raw?.id || raw?._id || '',
  userId: raw?.userId || '',
  title: String(raw?.title || ''),
  weekStartDate: String(raw?.weekStartDate || ''),
  days: ensureDaysShape(raw?.days),
  createdAt: raw?.createdAt || null,
  updatedAt: raw?.updatedAt || null,
});

const ensureCurrentUser = async () => {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Islem icin once giris yapmalisin.');
  }
  return current.uid;
};

const toSerializableTime = value =>
  value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value || null;

const mapDocToPlan = snapshot => {
  const data = snapshot.data() || {};
  return normalizePlan({
    id: snapshot.id,
    ...data,
    createdAt: toSerializableTime(data.createdAt),
    updatedAt: toSerializableTime(data.updatedAt),
  });
};

const ACTIVE_PREMIUM_STATUSES = new Set(['active', 'grace']);
const PLAN_LIMITS = {
  free: { mealPlanLimit: 3, aiDailyLimit: 2, displayName: 'Free' },
  premium: { mealPlanLimit: 10, aiDailyLimit: 12, displayName: 'Premium' },
  elite_premium: { mealPlanLimit: 30, aiDailyLimit: 30, displayName: 'Elite Premium' },
  elite_premium_plus: { mealPlanLimit: 60, aiDailyLimit: 75, displayName: 'Elite Premium Plus' },
};

const resolveEffectivePlanKey = userData => {
  const premium = userData?.premium || {};
  const rawPlan = typeof premium.plan === 'string' ? premium.plan : 'free';
  const hasPlan = Object.prototype.hasOwnProperty.call(PLAN_LIMITS, rawPlan);
  if (!hasPlan || rawPlan === 'free') return 'free';
  return ACTIVE_PREMIUM_STATUSES.has(premium.status || 'inactive') ? rawPlan : 'free';
};

const enforceFreePlanLimitIfNeeded = async userId => {
  const userDoc = await getDoc(doc(usersRef, userId));
  const userData = userDoc.exists() ? userDoc.data() : {};
  const limits = PLAN_LIMITS[resolveEffectivePlanKey(userData)] || PLAN_LIMITS.free;
  const existing = await getDocs(query(mealPlansRef, where('userId', '==', userId)));
  if (existing.size >= limits.mealPlanLimit) {
    throw new Error(`${limits.displayName} plani en fazla ${limits.mealPlanLimit} plan kaydedebilir.`);
  }
};

export const mealPlanService = {
  createEmptyWeek: () =>
    DAY_KEYS.reduce((acc, dayKey) => {
      acc[dayKey] = emptyDay();
      return acc;
    }, {}),

  getDayKeys: () => DAY_KEYS,

  getPlans: async userId => {
    const authUid = await ensureCurrentUser();
    const targetUserId = userId || authUid;
    if (targetUserId !== authUid) {
      throw new Error('Sadece kendi planlarini gorebilirsin.');
    }
    const snapshot = await getDocs(query(mealPlansRef, where('userId', '==', targetUserId)));
    return snapshot.docs.map(mapDocToPlan).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },

  createPlan: async ({ userId, title, weekStartDate, days }) => {
    const authUid = await ensureCurrentUser();
    const targetUserId = userId || authUid;
    if (targetUserId !== authUid) {
      throw new Error('Bu kullanici adina plan olusturamazsin.');
    }
    if (!String(title || '').trim()) {
      throw new Error('Plan basligi zorunludur.');
    }
    await enforceFreePlanLimitIfNeeded(targetUserId);
    const createdRef = await addDoc(mealPlansRef, {
      userId: targetUserId,
      title: String(title || '').trim(),
      weekStartDate: weekStartDate || '',
      days: ensureDaysShape(days),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const createdDoc = await getDoc(createdRef);
    return mapDocToPlan(createdDoc);
  },

  updatePlan: async ({ planId, title, weekStartDate, days }) => {
    const authUid = await ensureCurrentUser();
    const ref = doc(mealPlansRef, planId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      throw new Error('Plan bulunamadi.');
    }
    const current = snapshot.data() || {};
    if (current.userId !== authUid) {
      throw new Error('Bu plani guncelleyemezsin.');
    }
    await updateDoc(ref, {
      title: String(title || '').trim(),
      weekStartDate: weekStartDate || '',
      days: ensureDaysShape(days),
      updatedAt: serverTimestamp(),
    });
    const updatedDoc = await getDoc(ref);
    return mapDocToPlan(updatedDoc);
  },

  deletePlan: async planId => {
    const authUid = await ensureCurrentUser();
    const ref = doc(mealPlansRef, planId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      throw new Error('Plan bulunamadi.');
    }
    const current = snapshot.data() || {};
    if (current.userId !== authUid) {
      throw new Error('Bu plani silemezsin.');
    }
    await deleteDoc(ref);
    return true;
  },

  analyzePlan: async ({ planId, dailyCalories }) => {
    const authUid = await ensureCurrentUser();
    const snapshot = await getDoc(doc(mealPlansRef, planId));
    if (!snapshot.exists()) {
      throw new Error('Plan bulunamadi.');
    }
    const plan = mapDocToPlan(snapshot);
    if (plan.userId !== authUid) {
      throw new Error('Bu plani analiz edemezsin.');
    }
    const slots = mealPlanService.getDayKeys().flatMap(day => plan.days?.[day]?.meals || []);
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    slots.forEach(slot => {
      (slot.foods || []).forEach(food => {
        const amount = Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1;
        calories += (Number(food.nutrientsSnapshot?.calories) || 0) * amount;
        protein += (Number(food.nutrientsSnapshot?.protein) || 0) * amount;
        carbs += (Number(food.nutrientsSnapshot?.carbs) || 0) * amount;
      });
    });
    const daily = {
      calories: Math.round(calories / 7),
      protein: Math.round(protein / 7),
      carbs: Math.round(carbs / 7),
    };
    const target = Number(dailyCalories) || 2000;
    const diff = daily.calories - target;
    const calorieLine =
      Math.abs(diff) <= 120
        ? 'Gunluk kalori hedefinle genel olarak uyumlu.'
        : diff > 0
          ? 'Kalori hedefinin uzerindesin, porsiyonlari biraz azaltabilirsin.'
          : 'Kalori hedefinin altindasin, bir ara ogun eklemek faydali olur.';
    return {
      success: true,
      analysis: `Ortalama gunluk degerler: ${daily.calories} kcal, ${daily.protein} g protein, ${daily.carbs} g karbonhidrat. ${calorieLine}`,
      summary: daily,
    };
  },
};

