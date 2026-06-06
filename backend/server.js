const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bodyAnalysisRouter = require('./bodyAnalysis');

dotenv.config({ path: path.join(__dirname, '.env') });
const { admin, db } = require('./firebaseAdmin');

const app = express();
const FieldValue = admin.firestore.FieldValue;

const usersRef = db.collection('users');
const mealPlansRef = db.collection('mealPlans');
const exercisePlansRef = db.collection('exercisePlans');
const waterIntakesRef = db.collection('waterIntakes');
const ACTIVE_PREMIUM_STATUSES = new Set(['active', 'grace']);
const PLAN_LIMITS = {
  free: { mealPlanLimit: 3, aiDailyLimit: 2, displayName: 'Free' },
  premium: { mealPlanLimit: 10, aiDailyLimit: 12, displayName: 'Premium' },
  elite_premium: { mealPlanLimit: 30, aiDailyLimit: 30, displayName: 'Elite Premium' },
  elite_premium_plus: { mealPlanLimit: 60, aiDailyLimit: 75, displayName: 'Elite Premium Plus' },
};

const getRequiredEnv = key => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} ortam degiskeni eksik.`);
  }
  return value;
};

const createGeminiModel = () => {
  const genAI = new GoogleGenerativeAI(getRequiredEnv('GEMINI_API_KEY'));
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());

const toSerializable = value => {
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (Array.isArray(value)) {
    return value.map(item => toSerializable(item));
  }
  if (value && typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      output[key] = toSerializable(nestedValue);
    });
    return output;
  }
  return value;
};

const serializeDoc = doc => {
  const data = toSerializable(doc.data() || {});
  return {
    ...data,
    id: doc.id,
    _id: doc.id,
  };
};

const normalizeUser = user => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const getUserById = async userId => {
  const doc = await usersRef.doc(userId).get();
  if (!doc.exists) {
    return null;
  }
  return serializeDoc(doc);
};

const getUserByEmail = async email => {
  const snapshot = await usersRef.where('email', '==', email).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return serializeDoc(snapshot.docs[0]);
};

const hasMealsInPlan = days =>
  Object.values(days || {}).some(day =>
    Object.values(day || {}).some(meals => Array.isArray(meals) && meals.length > 0)
  );

const hasExercisesInPlan = days =>
  Object.values(days || {}).some(day => Array.isArray(day?.exercises) && day.exercises.length > 0);

const toWaterDocId = (userId, date) => `${userId}_${date}`;

const resolveEffectivePlanKey = userData => {
  const premium = userData?.premium || {};
  const rawPlan = typeof premium.plan === 'string' ? premium.plan : 'free';
  const hasPlan = Object.prototype.hasOwnProperty.call(PLAN_LIMITS, rawPlan);
  if (!hasPlan || rawPlan === 'free') return 'free';
  return ACTIVE_PREMIUM_STATUSES.has(premium.status || 'inactive') ? rawPlan : 'free';
};

const toDateOnlyKey = value => {
  if (!value) return '';
  const rawDate = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (!(rawDate instanceof Date) || Number.isNaN(rawDate.getTime())) return '';
  return rawDate.toISOString().slice(0, 10);
};

const getLimitsByUser = userData => PLAN_LIMITS[resolveEffectivePlanKey(userData)] || PLAN_LIMITS.free;

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Yetkisiz istek.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Yetkisiz istek.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const authProfile = await getUserById(decoded.uid);
    req.authUser = decoded;
    req.authProfile = authProfile;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Gecersiz oturum.' });
  }
};

const canAccessUserScope = (req, userId) =>
  req.authUser?.uid === userId || req.authProfile?.role === 'admin';

const enforceMealPlanLimit = async userId => {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('Kullanici bulunamadi.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  const limits = getLimitsByUser(user);
  const existingPlans = await mealPlansRef.where('userId', '==', userId).get();
  if (existingPlans.size >= limits.mealPlanLimit) {
    const error = new Error(`${limits.displayName} plani en fazla ${limits.mealPlanLimit} plan kaydedebilir.`);
    error.code = 'FREE_PLAN_LIMIT';
    throw error;
  }
};

const enforceAndConsumeAiDailyLimit = async userId => {
  const userRef = usersRef.doc(userId);
  await db.runTransaction(async transaction => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      const error = new Error('Kullanici bulunamadi.');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const userData = userDoc.data() || {};
    const limits = getLimitsByUser(userData);
    const aiUsage = userData.aiUsage || {};
    const dailyLimit = limits.aiDailyLimit;
    const previousCount = Number(aiUsage.dailyCount) || 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const lastResetKey = toDateOnlyKey(aiUsage.lastResetAt);
    const currentCount = lastResetKey === todayKey ? previousCount : 0;

    if (currentCount >= dailyLimit) {
      const error = new Error(`${limits.displayName} plani gunde en fazla ${dailyLimit} AI analiz kullanabilir.`);
      error.code = 'FREE_AI_LIMIT';
      throw error;
    }

    transaction.update(userRef, {
      aiUsage: {
        dailyCount: currentCount + 1,
        dailyLimit,
        lastResetAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
};

const safeNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const coerceMealType = value => {
  const key = String(value || '').trim().toLowerCase();
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(key)) return key;
  return 'snack';
};

const coerceTime = value => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '08:00';
  const h = Math.max(0, Math.min(23, Number(match[1])));
  const m = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const normalizeGeneratedDays = days => {
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const source = days && typeof days === 'object' ? days : {};
  return dayKeys.reduce((acc, dayKey) => {
    const dayMeals = Array.isArray(source?.[dayKey]?.meals) ? source[dayKey].meals : [];
    acc[dayKey] = {
      meals: dayMeals.map(slot => {
        const foods = Array.isArray(slot?.foods) ? slot.foods : [];
        return {
          id: String(slot?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          mealType: coerceMealType(slot?.mealType),
          time: coerceTime(slot?.time),
          foods: foods
            .map(food => ({
              id: String(food?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
              name: String(food?.name || 'Besin'),
              servingAmount: Math.max(0.5, safeNumber(food?.servingAmount) || 1),
              servingBaseAmount: Math.max(0.5, safeNumber(food?.servingBaseAmount) || 1),
              servingUnit: String(food?.servingUnit || 'porsiyon'),
              source: 'ai_generator',
              sourceRefId: `ai-${String(food?.name || 'besin').toLowerCase().replace(/\s+/g, '-')}`,
              nutrientsSnapshot: {
                calories: Math.max(0, Math.round(safeNumber(food?.nutrientsSnapshot?.calories || food?.calories))),
                protein: Math.max(0, Math.round(safeNumber(food?.nutrientsSnapshot?.protein || food?.protein))),
                carbs: Math.max(0, Math.round(safeNumber(food?.nutrientsSnapshot?.carbs || food?.carbs))),
              },
            }))
            .filter(food => Boolean(food.name)),
        };
      }),
    };
    return acc;
  }, {});
};

const extractFirstJsonObject = text => {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

app.get('/api', (req, res) => {
  res.json({ message: 'API calisiyor!' });
});

app.use('/api/body-analysis', bodyAnalysisRouter);

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'E-posta ve sifre zorunludur',
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Bu e-posta adresi ile kayitli kullanici bulunamadi',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Hatali sifre',
      });
    }

    res.json({
      success: true,
      message: 'Giris basarili',
      user: normalizeUser(user),
    });
  } catch (error) {
    console.error('Giris hatasi:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatasi olustu',
      error: error.message,
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, birthDate, gender, height, weight } = req.body;
    if (!firstName || !lastName || !email || !password || !birthDate || !gender || !height || !weight) {
      return res.status(400).json({ success: false, message: 'Tum alanlar zorunludur.' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Bu e-posta ile zaten bir kullanici var.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPayload = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      birthDate,
      gender,
      height,
      weight,
      dailyCalories: 0,
      fatPercent: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await usersRef.add(userPayload);
    res.status(201).json({ success: true, message: 'Kayit basarili. Giris yapabilirsiniz.' });
  } catch (error) {
    console.error('Kayit hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi olustu', error: error.message });
  }
});

app.get('/api/meal-plans', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId zorunludur.' });
    }
    if (!canAccessUserScope(req, userId)) {
      return res.status(403).json({ success: false, message: 'Bu kullanicinin planlarina erisemezsiniz.' });
    }

    const snapshot = await mealPlansRef.where('userId', '==', userId).get();
    const plans = snapshot.docs.map(serializeDoc);
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Planlari getirme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/meal-plans', requireAuth, async (req, res) => {
  try {
    const { userId, title, weekStartDate, days } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId zorunludur.' });
    }
    if (!canAccessUserScope(req, userId)) {
      return res.status(403).json({ success: false, message: 'Bu kullanici adina plan olusturamazsiniz.' });
    }
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Plan basligi zorunludur.' });
    }
    if (!days || typeof days !== 'object') {
      return res.status(400).json({ success: false, message: 'Gecerli bir plan yapisi gerekli.' });
    }

    await enforceMealPlanLimit(userId);

    if (!hasMealsInPlan(days)) {
      return res.status(400).json({ success: false, message: 'Plan en az bir ogun icermelidir.' });
    }

    const docRef = await mealPlansRef.add({
      userId,
      title,
      weekStartDate: weekStartDate || '',
      days,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const createdDoc = await docRef.get();

    res.status(201).json({
      success: true,
      message: 'Plan basariyla olusturuldu.',
      mealPlan: serializeDoc(createdDoc),
    });
  } catch (error) {
    console.error('Plan olusturma hatasi:', error);
    if (error?.code === 'FREE_PLAN_LIMIT') {
      return res.status(403).json({ success: false, message: error.message, code: error.code });
    }
    if (error?.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: error.code });
    }
    res.status(500).json({
      success: false,
      message: 'Sunucu hatasi',
      error: error.message,
    });
  }
});

app.put('/api/meal-plans/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, weekStartDate, days } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Plan basligi zorunludur.' });
    }
    if (!days || typeof days !== 'object') {
      return res.status(400).json({ success: false, message: 'Gecerli bir plan yapisi gerekli.' });
    }
    if (!hasMealsInPlan(days)) {
      return res.status(400).json({ success: false, message: 'Plan en az bir ogun icermelidir.' });
    }

    const docRef = mealPlansRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }
    const currentPlan = doc.data() || {};
    if (!canAccessUserScope(req, currentPlan.userId)) {
      return res.status(403).json({ success: false, message: 'Bu plani guncelleyemezsiniz.' });
    }

    await docRef.update({
      title,
      weekStartDate: weekStartDate || currentPlan.weekStartDate || '',
      days,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedDoc = await docRef.get();
    res.json({ success: true, message: 'Plan basariyla guncellendi.', mealPlan: serializeDoc(updatedDoc) });
  } catch (error) {
    console.error('Plan guncelleme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.delete('/api/meal-plans/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = mealPlansRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }
    const currentPlan = doc.data() || {};
    if (!canAccessUserScope(req, currentPlan.userId)) {
      return res.status(403).json({ success: false, message: 'Bu plani silemezsiniz.' });
    }
    await docRef.delete();
    res.json({ success: true, message: 'Plan basariyla silindi.' });
  } catch (error) {
    console.error('Plan silme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/meal-plans/:id/analyze', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyCalories, userId } = req.body;

    if (!dailyCalories) {
      return res.status(400).json({ success: false, message: 'dailyCalories zorunludur.' });
    }

    const planDoc = await mealPlansRef.doc(id).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }

    const mealPlan = serializeDoc(planDoc);
    const ownerId = mealPlan.userId || userId;
    if (!ownerId) {
      return res.status(400).json({ success: false, message: 'Plan sahibi belirlenemedi.' });
    }
    if (!canAccessUserScope(req, ownerId)) {
      return res.status(403).json({ success: false, message: 'Bu plani analiz edemezsiniz.' });
    }
    await enforceAndConsumeAiDailyLimit(ownerId);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    days.forEach(day => {
      const dayMeals = mealPlan.days?.[day] || {};
      ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
        (dayMeals[mealType] || []).forEach(meal => {
          totalCalories += meal.calories || 0;
          totalProtein += meal.protein || 0;
          totalCarbs += meal.carbs || 0;
          totalFat += meal.fat || 0;
        });
      });
    });

    const prompt = `\
Asagidaki beslenme planini, bir diyetisyen gibi kullaniciya dogrudan hitap ederek degerlendir. Cevabinda "sen" zamirini kullan, onerilerini ve analizini sohbet eder gibi, samimi ve motive edici bir dille yaz. Maddeler halinde, Turkce olarak acikla.

- Gunluk kalori ihtiyacin: ${dailyCalories} kcal
- Planin gunluk ortalama degerleri:
  - Kalori: ${Math.round(totalCalories / 7)} kcal
  - Protein: ${Math.round(totalProtein / 7)}g
  - Karbonhidrat: ${Math.round(totalCarbs / 7)}g
  - Yag: ${Math.round(totalFat / 7)}g

Sorular:
1. Bu plan gunluk kalori ihtiyacini karsiliyor mu?
2. Makro besin dagilimi dengeli mi?
3. Plani daha saglikli hale getirmek icin neler onerirsin?
4. Hangi besinleri ekleyebilir veya cikarabilirsin?
`;

    const model = createGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      analysis: text,
      macros: {
        dailyAverageCalories: Math.round(totalCalories / 7),
        dailyAverageProtein: Math.round(totalProtein / 7),
        dailyAverageCarbs: Math.round(totalCarbs / 7),
        dailyAverageFat: Math.round(totalFat / 7),
      },
    });
  } catch (error) {
    console.error('Plan analiz hatasi:', error);
    if (error?.code === 'FREE_AI_LIMIT') {
      return res.status(403).json({ success: false, message: error.message, code: error.code });
    }
    if (error?.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: error.code });
    }
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/meal-plans/generate-weekly', requireAuth, async (req, res) => {
  try {
    const { userId, prompt, profile } = req.body || {};
    const targetUserId = userId || req.authUser?.uid;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId zorunludur.' });
    }
    if (!canAccessUserScope(req, targetUserId)) {
      return res.status(403).json({ success: false, message: 'Bu kullanici adina plan uretemezsiniz.' });
    }
    const normalizedPrompt = String(prompt || '').trim();
    if (!normalizedPrompt) {
      return res.status(400).json({ success: false, message: 'prompt zorunludur.' });
    }

    await enforceAndConsumeAiDailyLimit(targetUserId);
    const userFromDb = await getUserById(targetUserId);
    if (!userFromDb) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    const mergedProfile = {
      ...userFromDb,
      ...(profile && typeof profile === 'object' ? profile : {}),
    };

    const age = (() => {
      const date = new Date(mergedProfile.birthDate || '');
      if (Number.isNaN(date.getTime())) return null;
      const diff = Date.now() - date.getTime();
      return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
    })();
    const diseases = Array.isArray(mergedProfile.diseases) ? mergedProfile.diseases : [];

    const aiPrompt = `
Sen profesyonel bir diyetisyen asistansın.
Kullanıcı bilgileri:
- Cinsiyet: ${mergedProfile.gender || 'bilinmiyor'}
- Yas: ${age ?? 'bilinmiyor'}
- Boy: ${safeNumber(mergedProfile.height) || 'bilinmiyor'} cm
- Kilo: ${safeNumber(mergedProfile.weight) || 'bilinmiyor'} kg
- Gunluk kalori hedefi: ${safeNumber(mergedProfile.dailyCalories) || 'bilinmiyor'} kcal
- Hastalik/aleri bilgileri: ${diseases.length > 0 ? diseases.join(', ') : 'yok'}

Kullanıcı tercihi:
${normalizedPrompt}

KESIN KURAL:
- Hastalık/aleri kısıtı varsa asla riskli besin önerme.
- Tercihler haftaya dengeli dağıtılsın; her gün aynı şeyleri tekrar etme.
- Yüksek protein seçildiyse aşırıya kaçma, sürdürülebilir dengeli plan ver.
- Tatlı tercihi varsa bile her güne tatlı yazma.

SADECE geçerli JSON döndür (markdown/ek metin yok):
{
  "title": "string",
  "weekStartDate": "YYYY-MM-DD",
  "days": {
    "monday": {
      "meals": [
        {
          "mealType": "breakfast|lunch|dinner|snack",
          "time": "HH:MM",
          "foods": [
            { "name": "string", "servingAmount": 1, "servingUnit": "string", "calories": 120, "protein": 12, "carbs": 20 }
          ]
        }
      ]
    },
    "tuesday": { "meals": [] },
    "wednesday": { "meals": [] },
    "thursday": { "meals": [] },
    "friday": { "meals": [] },
    "saturday": { "meals": [] },
    "sunday": { "meals": [] }
  }
}
`;

    const model = createGeminiModel();
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    const text = response.text();
    const parsed = extractFirstJsonObject(text);
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ success: false, message: 'AI yaniti gecersiz formatta geldi.' });
    }

    const normalizedDays = normalizeGeneratedDays(parsed.days);
    const weekStartDate =
      typeof parsed.weekStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.weekStartDate)
        ? parsed.weekStartDate
        : new Date().toISOString().slice(0, 10);

    return res.json({
      success: true,
      generatedPlan: {
        title: String(parsed.title || `AI Plan - ${new Date().toLocaleDateString('tr-TR')}`),
        weekStartDate,
        days: normalizedDays,
      },
    });
  } catch (error) {
    console.error('Haftalik AI plan uretme hatasi:', error);
    if (error?.code === 'FREE_AI_LIMIT') {
      return res.status(403).json({ success: false, message: error.message, code: error.code });
    }
    if (error?.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: error.code });
    }
    return res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.put('/api/users/:id/daily-calories', async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyCalories } = req.body;

    if (!dailyCalories || dailyCalories < 0) {
      return res.status(400).json({ success: false, message: 'Gecerli bir kalori degeri giriniz.' });
    }

    const userRef = usersRef.doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }

    await userRef.update({
      dailyCalories,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedUser = await userRef.get();
    res.json({ success: true, message: 'Gunluk kalori ihtiyaci guncellendi.', user: normalizeUser(serializeDoc(updatedUser)) });
  } catch (error) {
    console.error('Kalori guncelleme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    res.json(normalizeUser(user));
  } catch (error) {
    console.error('Kullanici getirme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.get('/api/exercise-plans', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId zorunludur.' });
    }
    const snapshot = await exercisePlansRef.where('userId', '==', userId).get();
    const plans = snapshot.docs.map(serializeDoc);
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Egzersiz planlarini getirme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/exercise-plans', async (req, res) => {
  try {
    const { userId, title, days } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId zorunludur.' });
    }
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Plan basligi zorunludur.' });
    }
    if (!days || typeof days !== 'object') {
      return res.status(400).json({ success: false, message: 'Gecerli bir plan yapisi gerekli.' });
    }
    if (!hasExercisesInPlan(days)) {
      return res.status(400).json({ success: false, message: 'Plan en az bir egzersiz icermelidir.' });
    }

    const docRef = await exercisePlansRef.add({
      userId,
      title,
      days,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const createdDoc = await docRef.get();

    res.status(201).json({ success: true, message: 'Plan basariyla olusturuldu.', plan: serializeDoc(createdDoc) });
  } catch (error) {
    console.error('Egzersiz plani olusturma hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.put('/api/exercise-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, days } = req.body;
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Plan basligi zorunludur.' });
    }
    if (!days || typeof days !== 'object') {
      return res.status(400).json({ success: false, message: 'Gecerli bir plan yapisi gerekli.' });
    }
    if (!hasExercisesInPlan(days)) {
      return res.status(400).json({ success: false, message: 'Plan en az bir egzersiz icermelidir.' });
    }

    const docRef = exercisePlansRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }

    await docRef.update({
      title,
      days,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updatedDoc = await docRef.get();
    res.json({ success: true, message: 'Plan basariyla guncellendi.', plan: serializeDoc(updatedDoc) });
  } catch (error) {
    console.error('Egzersiz plani guncelleme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.delete('/api/exercise-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = exercisePlansRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }
    await docRef.delete();
    res.json({ success: true, message: 'Plan basariyla silindi.' });
  } catch (error) {
    console.error('Egzersiz plani silme hatasi:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/exercise-plans/:id/analyze', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const planDoc = await exercisePlansRef.doc(id).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadi.' });
    }
    const plan = serializeDoc(planDoc);
    if (!canAccessUserScope(req, plan.userId)) {
      return res.status(403).json({ success: false, message: 'Bu plani analiz edemezsiniz.' });
    }
    await enforceAndConsumeAiDailyLimit(plan.userId);

    let totalExercises = 0;
    let totalSets = 0;
    let totalReps = 0;
    let totalDuration = 0;
    const bodyParts = new Set();
    const targets = new Set();

    Object.values(plan.days || {}).forEach(day => {
      (day.exercises || []).forEach(ex => {
        totalExercises += 1;
        totalSets += ex.sets || 0;
        totalReps += ex.reps || 0;
        totalDuration += ex.duration || 0;
        if (ex.bodyPart) bodyParts.add(ex.bodyPart);
        if (ex.target) targets.add(ex.target);
      });
    });

    const prompt = `Asagida bir haftalik egzersiz plani var. Lutfen bir spor egitmeni gibi kullaniciya dogrudan hitap ederek, plani degerlendir. Eksik veya fazla olan noktalari, kas grubu ve bolge cesitliligini, toplam set/tekrar/sureyi ve genel yeterliligi analiz et. Eksik kas grubu veya bolge varsa oner, motivasyonel ve samimi bir dille yaz.\n\n- Toplam egzersiz: ${totalExercises}\n- Toplam set: ${totalSets}\n- Toplam tekrar: ${totalReps}\n- Toplam sure: ${totalDuration} dakika\n- Calisilan bolgeler: ${Array.from(bodyParts).join(', ') || 'Yok'}\n- Hedef kas gruplari: ${Array.from(targets).join(', ') || 'Yok'}\n\nSorular:\n1. Bu plan genel olarak yeterli mi?\n2. Hangi kas gruplari/bolgeler eksik?\n3. Plani daha iyi ve dengeli yapmak icin neler onerirsin?\n4. Hangi egzersizler eklenebilir veya cikarilabilir?`;

    const model = createGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.json({
      success: true,
      analysis: text,
      summary: {
        totalExercises,
        totalSets,
        totalReps,
        totalDuration,
        bodyParts: Array.from(bodyParts),
        targets: Array.from(targets),
      },
    });
  } catch (error) {
    console.error('Egzersiz plani analiz hatasi:', error);
    if (error?.code === 'FREE_AI_LIMIT') {
      return res.status(403).json({ success: false, message: error.message, code: error.code });
    }
    if (error?.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: error.code });
    }
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.post('/api/water-intake', async (req, res) => {
  try {
    const { userId, date, amount } = req.body;
    const parsedAmount = Number(amount);

    if (!userId || !date || !parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Eksik veya gecersiz parametre' });
    }

    const docId = toWaterDocId(userId, date);
    const waterDocRef = waterIntakesRef.doc(docId);
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    await db.runTransaction(async transaction => {
      const snap = await transaction.get(waterDocRef);
      if (!snap.exists) {
        transaction.set(waterDocRef, {
          userId,
          date,
          amount: parsedAmount,
          logs: [{ time, amount: parsedAmount }],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const current = snap.data();
      const nextAmount = (current.amount || 0) + parsedAmount;
      const nextLogs = [...(current.logs || []), { time, amount: parsedAmount }];

      transaction.update(waterDocRef, {
        amount: nextAmount,
        logs: nextLogs,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const updatedDoc = await waterDocRef.get();
    res.json({ success: true, data: serializeDoc(updatedDoc) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.get('/api/water-intake', async (req, res) => {
  try {
    const { userId, date } = req.query;
    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'Eksik parametre' });
    }
    const docId = toWaterDocId(userId, date);
    const waterDoc = await waterIntakesRef.doc(docId).get();
    res.json({ success: true, data: waterDoc.exists ? serializeDoc(waterDoc) : null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

app.get('/api/water-intake/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Eksik parametre' });
    }

    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const snapshot = await waterIntakesRef
      .where('userId', '==', userId)
      .where('date', 'in', days)
      .get();

    const history = snapshot.docs.map(serializeDoc);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatasi', error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda calisiyor`);
});