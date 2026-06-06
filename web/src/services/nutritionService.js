import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.REACT_APP_USDA_API_KEY || '';

const COMMON_FALLBACK_FOODS = [
  { id: 'fallback-oats', fdcId: null, name: 'Yulaf', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, saturatedFat: 1.2, fiber: 10.6, sugar: 1, sodium: 2, potassium: 429, serving: '100 g' },
  { id: 'fallback-banana', fdcId: null, name: 'Muz', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, saturatedFat: 0.1, fiber: 2.6, sugar: 12.2, sodium: 1, potassium: 358, serving: '100 g' },
  { id: 'fallback-egg', fdcId: null, name: 'Yumurta', calories: 155, protein: 12.6, carbs: 1.1, fat: 11.3, saturatedFat: 3.3, fiber: 0, sugar: 0.4, sodium: 124, potassium: 126, serving: '100 g' },
  { id: 'fallback-chicken', fdcId: null, name: 'Tavuk Gogsu', calories: 165, protein: 31, carbs: 0, fat: 3.6, saturatedFat: 1, fiber: 0, sugar: 0, sodium: 74, potassium: 256, serving: '100 g' },
  { id: 'fallback-whole-bread', fdcId: null, name: 'Tam Bugday Ekmek', calories: 247, protein: 13, carbs: 41, fat: 3.4, saturatedFat: 0.4, fiber: 7, sugar: 6, sodium: 478, potassium: 250, serving: '100 g' },
];
const DEFAULT_DB_FOOD_LIMIT = 10;

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : 0;
};

const toOptionalNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
};

const normalizeText = value => String(value || '').toLowerCase().trim();
const normalizeDiseaseTags = tags =>
  Array.isArray(tags) ? tags.filter(tag => tag === 'diabetes' || tag === 'celiac') : [];

const computeQualityScore = (food, query) => {
  let score = 0;
  const name = normalizeText(food?.description);
  const normalizedQuery = normalizeText(query);
  const dataType = normalizeText(food?.dataType);

  if (food?.brandOwner) score += 25;
  if (food?.householdServingFullText || food?.servingSize) score += 20;
  if (dataType.includes('branded')) score += 20;
  if (dataType.includes('foundation') || dataType.includes('sr legacy')) score += 10;
  if (name.startsWith(normalizedQuery)) score += 20;
  if (name.includes(normalizedQuery)) score += 10;

  return score;
};

const getNutrientName = nutrient => String(nutrient?.nutrientName || nutrient?.nutrient?.name || '').toLowerCase();
const getNutrientValue = nutrient => toNumber(nutrient?.value ?? nutrient?.amount);

const pickNutrient = (nutrients = [], acceptedNames = []) => {
  const lowerNames = acceptedNames.map(name => name.toLowerCase());
  const found = nutrients.find(item => lowerNames.includes(getNutrientName(item)));
  return getNutrientValue(found);
};

const mapUsdaFood = food => {
  const nutrients = food?.foodNutrients || [];
  const servingSize = food?.servingSize ? `${food.servingSize} ${food.servingSizeUnit || ''}`.trim() : '';
  const serving = food?.householdServingFullText || servingSize || '100 g';

  return {
    id: `usda-${food?.fdcId || food?.description || Math.random()}`,
    fdcId: food?.fdcId || null,
    name: food?.description || 'Bilinmeyen Besin',
    calories: pickNutrient(nutrients, ['Energy']),
    protein: pickNutrient(nutrients, ['Protein']),
    carbs: pickNutrient(nutrients, ['Carbohydrate, by difference']),
    fat: pickNutrient(nutrients, ['Total lipid (fat)']),
    saturatedFat: pickNutrient(nutrients, ['Fatty acids, total saturated']),
    fiber: pickNutrient(nutrients, ['Fiber, total dietary']),
    sugar: pickNutrient(nutrients, ['Sugars, total including NLEA']),
    sodium: pickNutrient(nutrients, ['Sodium, Na']),
    potassium: pickNutrient(nutrients, ['Potassium, K']),
    serving,
    source: 'usda',
    dataType: food?.dataType || '',
    brandOwner: food?.brandOwner || '',
    glycemicIndex: null,
    qualityScore: 0,
    isRecommended: false,
  };
};

const dedupeFoods = foods => {
  const seen = new Set();
  return foods.filter(item => {
    const dedupeKey = `${normalizeText(item.name)}|${normalizeText(item.brandOwner)}|${normalizeText(item.serving)}|${normalizeText(item.source)}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
};

const rankFoods = (foods, query) => {
  const withScores = foods.map(item => ({
    ...item,
    qualityScore: item.qualityScore || 0,
  }));

  withScores.sort((a, b) => {
    if (Boolean(b.isTrusted) !== Boolean(a.isTrusted)) return b.isTrusted ? 1 : -1;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    return (b.protein || 0) - (a.protein || 0);
  });

  return withScores.map((item, index) => ({
    ...item,
    isRecommended: index < 3,
  }));
};

const mapApprovedSubmissionFood = docData => ({
  id: `metabolift-${docData.id || Math.random()}`,
  submissionId: docData.id || '',
  fdcId: null,
  name: docData.name || 'Bilinmeyen Besin',
  calories: toNumber(docData.calories),
  protein: toNumber(docData.protein),
  carbs: toNumber(docData.carbs),
  fat: toNumber(docData.fat),
  saturatedFat: toNumber(docData.saturatedFat),
  fiber: toNumber(docData.fiber),
  sugar: toNumber(docData.sugar),
  sodium: toNumber(docData.sodium),
  potassium: toNumber(docData.potassium),
  calcium: toNumber(docData.calcium),
  iron: toNumber(docData.iron),
  magnesium: toNumber(docData.magnesium),
  phosphorus: toNumber(docData.phosphorus),
  zinc: toNumber(docData.zinc),
  vitaminC: toNumber(docData.vitaminC),
  vitaminB12: toNumber(docData.vitaminB12),
  glycemicIndex: toOptionalNumber(docData.glycemicIndex),
  diseaseTags: normalizeDiseaseTags(docData.diseaseTags),
  unsuitableDiseaseTags: normalizeDiseaseTags(docData.unsuitableDiseaseTags),
  serving: docData.serving || '100 g',
  source: 'metabolift_db',
  dataType: 'MetaboLift DB',
  brandOwner: docData.brandName || '',
  qualityScore: 1000,
  isRecommended: false,
  isTrusted: true,
});

const searchFoodsFromMetaboLiftDb = async queryText => {
  const snapshot = await getDocs(
    query(collection(db, 'foodSubmissions'), where('status', '==', 'approved'))
  );
  const lowered = normalizeText(queryText);
  const mapped = snapshot.docs
    .map(docSnap => mapApprovedSubmissionFood({ id: docSnap.id, ...docSnap.data() }))
    .filter(item => normalizeText(item.name).includes(lowered));
  return rankFoods(dedupeFoods(mapped), queryText);
};

const getDefaultFoodsFromMetaboLiftDb = async () => {
  const snapshot = await getDocs(
    query(collection(db, 'foodSubmissions'), where('status', '==', 'approved'))
  );
  const mapped = snapshot.docs.map(docSnap => mapApprovedSubmissionFood({ id: docSnap.id, ...docSnap.data() }));
  const stableSorted = [...mapped].sort((a, b) =>
    normalizeText(a.name).localeCompare(normalizeText(b.name), 'tr')
  );
  return stableSorted.slice(0, DEFAULT_DB_FOOD_LIMIT);
};

const searchFoodsFromUsda = async query => {
  const response = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      pageSize: 20,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'USDA arama istegi basarisiz.');
  }

  const foods = Array.isArray(payload?.foods) ? payload.foods : [];
  const mapped = foods.map(food => ({
    ...mapUsdaFood(food),
    qualityScore: computeQualityScore(food, query),
  }));
  return rankFoods(dedupeFoods(mapped), query);
};

const getFoodDetailsFromUsda = async fdcId => {
  const response = await fetch(`${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'Besin detay istegi basarisiz.');
  }

  const nutrients = Array.isArray(payload?.foodNutrients) ? payload.foodNutrients : [];

  return {
    fdcId: payload?.fdcId || fdcId,
    description: payload?.description || '',
    calories: pickNutrient(nutrients, ['Energy']),
    protein: pickNutrient(nutrients, ['Protein']),
    carbs: pickNutrient(nutrients, ['Carbohydrate, by difference']),
    fat: pickNutrient(nutrients, ['Total lipid (fat)']),
    saturatedFat: pickNutrient(nutrients, ['Fatty acids, total saturated']),
    fiber: pickNutrient(nutrients, ['Fiber, total dietary']),
    sugar: pickNutrient(nutrients, ['Sugars, total including NLEA']),
    sodium: pickNutrient(nutrients, ['Sodium, Na']),
    potassium: pickNutrient(nutrients, ['Potassium, K']),
    micronutrients: {
      calcium: pickNutrient(nutrients, ['Calcium, Ca']),
      iron: pickNutrient(nutrients, ['Iron, Fe']),
      magnesium: pickNutrient(nutrients, ['Magnesium, Mg']),
      phosphorus: pickNutrient(nutrients, ['Phosphorus, P']),
      zinc: pickNutrient(nutrients, ['Zinc, Zn']),
      vitaminC: pickNutrient(nutrients, ['Vitamin C, total ascorbic acid']),
      vitaminB12: pickNutrient(nutrients, ['Vitamin B-12']),
    },
    glycemicIndex: null,
  };
};

export const nutritionService = {
  getSetupState: () => ({
    provider: 'USDA',
    hasApiKey: Boolean(USDA_API_KEY),
  }),

  getFallbackFoods: () => COMMON_FALLBACK_FOODS,

  getInitialFoods: async () => {
    const localApproved = await getDefaultFoodsFromMetaboLiftDb().catch(() => []);
    if (localApproved.length > 0) {
      return localApproved;
    }
    return COMMON_FALLBACK_FOODS.slice(0, DEFAULT_DB_FOOD_LIMIT);
  },

  searchFoods: async query => {
    const normalized = String(query || '').trim();
    if (!normalized) {
      return nutritionService.getInitialFoods();
    }

    const localApproved = await searchFoodsFromMetaboLiftDb(normalized).catch(() => []);

    if (!USDA_API_KEY) {
      const fallbackMatches = COMMON_FALLBACK_FOODS.filter(item =>
        item.name.toLowerCase().includes(normalized.toLowerCase())
      );
      return rankFoods(dedupeFoods([...localApproved, ...fallbackMatches]), normalized);
    }

    const results = await searchFoodsFromUsda(normalized);
    const merged = rankFoods(dedupeFoods([...localApproved, ...results]), normalized);
    if (merged.length > 0) return merged;

    return COMMON_FALLBACK_FOODS.filter(item =>
      item.name.toLowerCase().includes(normalized.toLowerCase())
    );
  },

  getFoodDetails: async fdcId => {
    if (!fdcId) {
      throw new Error('Bu besin icin USDA detay verisi bulunmuyor.');
    }
    if (!USDA_API_KEY) {
      throw new Error('USDA API key tanimli degil.');
    }
    return getFoodDetailsFromUsda(fdcId);
  },
};

