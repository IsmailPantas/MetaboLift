const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { admin, db } = require('../firebaseAdmin');

const DEFAULT_USER_ID = 'zra3Pjd6RCMHgeyuia1Swpb4TsM2';
const ELITE_PREMIUM_AI_DAILY_LIMIT = 30;

const run = async () => {
  const userId = process.argv[2] || DEFAULT_USER_ID;
  if (!userId) {
    throw new Error('Kullanici ID zorunludur.');
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error(`Kullanici bulunamadi: ${userId}`);
  }

  const currentData = userSnap.data() || {};
  const currentDailyCount = Math.max(0, Number(currentData?.aiUsage?.dailyCount) || 0);

  await userRef.update({
    premium: {
      plan: 'elite_premium',
      status: 'active',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    aiUsage: {
      dailyCount: Math.min(currentDailyCount, ELITE_PREMIUM_AI_DAILY_LIMIT),
      dailyLimit: ELITE_PREMIUM_AI_DAILY_LIMIT,
      lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Kullanici elite_premium olarak guncellendi: ${userId}`);
};

run().catch(error => {
  console.error('Script hatasi:', error.message || error);
  process.exit(1);
});
