const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../firebaseAdmin');

const PLAN_AI_DAILY_LIMITS = {
  free: 2,
  premium: 12,
  elite_premium: 30,
  elite_premium_plus: 75,
};
const VALID_PREMIUM_PLANS = new Set(Object.keys(PLAN_AI_DAILY_LIMITS));
const VALID_PREMIUM_STATUS = new Set(['inactive', 'active', 'grace', 'canceled']);

const isFiniteNumber = value => Number.isFinite(Number(value));

const normalizePremium = premium => {
  const source = premium && typeof premium === 'object' ? premium : {};
  return {
    plan: VALID_PREMIUM_PLANS.has(source.plan) ? source.plan : 'free',
    status: VALID_PREMIUM_STATUS.has(source.status) ? source.status : 'inactive',
    startedAt: Object.prototype.hasOwnProperty.call(source, 'startedAt') ? source.startedAt : null,
    expiresAt: Object.prototype.hasOwnProperty.call(source, 'expiresAt') ? source.expiresAt : null,
    updatedAt: Object.prototype.hasOwnProperty.call(source, 'updatedAt') ? source.updatedAt : null,
  };
};

const resolveEffectivePlanKey = premium => {
  if (!premium || premium.plan === 'free') return 'free';
  return ['active', 'grace'].includes(premium.status || 'inactive') ? premium.plan : 'free';
};

const normalizeAiUsage = (aiUsage, premium) => {
  const source = aiUsage && typeof aiUsage === 'object' ? aiUsage : {};
  const effectivePlan = resolveEffectivePlanKey(premium);
  const planDailyLimit = PLAN_AI_DAILY_LIMITS[effectivePlan] || PLAN_AI_DAILY_LIMITS.free;
  const rawCount = isFiniteNumber(source.dailyCount) ? Number(source.dailyCount) : 0;
  return {
    dailyCount: Math.max(0, Math.min(rawCount, planDailyLimit)),
    dailyLimit: planDailyLimit,
    lastResetAt: Object.prototype.hasOwnProperty.call(source, 'lastResetAt') ? source.lastResetAt : null,
    updatedAt: Object.prototype.hasOwnProperty.call(source, 'updatedAt') ? source.updatedAt : null,
  };
};

const shallowEqual = (a, b) => {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => a[key] === b[key]);
};

const run = async () => {
  const shouldApply = process.argv.includes('--apply');
  const dryRun = !shouldApply;

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  const docsToUpdate = [];

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const nextPremium = normalizePremium(data.premium);
    const nextAiUsage = normalizeAiUsage(data.aiUsage, nextPremium);

    const premiumChanged = !shallowEqual(data.premium || {}, nextPremium);
    const aiUsageChanged = !shallowEqual(data.aiUsage || {}, nextAiUsage);

    if (premiumChanged || aiUsageChanged) {
      docsToUpdate.push({
        id: docSnap.id,
        ref: docSnap.ref,
        payload: {
          premium: nextPremium,
          aiUsage: nextAiUsage,
        },
      });
    }
  });

  console.log(`Toplam kullanici: ${snapshot.size}`);
  console.log(`Guncellenecek kullanici: ${docsToUpdate.length}`);
  if (docsToUpdate.length > 0) {
    const preview = docsToUpdate.slice(0, 20).map(item => item.id);
    console.log(`Ornek kullanici id'leri: ${preview.join(', ')}`);
    if (docsToUpdate.length > 20) {
      console.log(`... ve ${docsToUpdate.length - 20} kullanici daha`);
    }
  }

  if (dryRun) {
    console.log('Dry-run tamamlandi. Yazmak icin komutu --apply ile calistirin.');
    return;
  }

  let batch = db.batch();
  let opCount = 0;
  let commitCount = 0;

  for (const item of docsToUpdate) {
    batch.update(item.ref, item.payload);
    opCount += 1;

    if (opCount === 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
      commitCount += 1;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    commitCount += 1;
  }

  console.log(`Backfill tamamlandi. Commit sayisi: ${commitCount}`);
  console.log(`Guncellenen kullanici sayisi: ${docsToUpdate.length}`);
};

run().catch(error => {
  console.error('Backfill hatasi:', error.message || error);
  process.exit(1);
});

