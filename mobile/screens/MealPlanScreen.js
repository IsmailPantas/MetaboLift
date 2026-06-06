import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Modal,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  UIManager,
  View,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import { mealPlanService } from '../services/mealPlanService';
import { nutritionService } from '../services/nutritionService';

const DAY_OPTIONS = [
  { key: 'monday', label: 'PZT' },
  { key: 'tuesday', label: 'SAL' },
  { key: 'wednesday', label: 'CAR' },
  { key: 'thursday', label: 'PER' },
  { key: 'friday', label: 'CUM' },
  { key: 'saturday', label: 'CMT' },
  { key: 'sunday', label: 'PAZ' },
];

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Kahvalti', icon: 'white-balance-sunny' },
  { key: 'lunch', label: 'Ogle Yemegi', icon: 'weather-partly-cloudy' },
  { key: 'dinner', label: 'Aksam Yemegi', icon: 'moon-waning-crescent' },
  { key: 'snack', label: 'Ara Ogun', icon: 'leaf' },
];

const createDefaultPlanDraft = () => ({
  title: '',
  weekStartDate: new Date().toISOString().slice(0, 10),
  days: mealPlanService.createEmptyWeek(),
});

const createMealSlot = ({ mealType, time }) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  mealType,
  time,
  foods: [],
});

const normalizeSlot = meal => {
  const hasFoodsArray = Array.isArray(meal?.foods);
  if (hasFoodsArray) {
    return {
      id: meal.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      mealType: meal.mealType || 'snack',
      time: meal.time || '',
      foods: meal.foods,
    };
  }
  return {
    id: meal.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mealType: meal.mealType || 'snack',
    time: meal.time || '',
    foods: meal?.name
      ? [
          {
            id: `legacy-${meal.id || Date.now()}`,
            name: meal.name,
            servingAmount: meal.servingAmount || 1,
            servingBaseAmount: meal.servingBaseAmount || 1,
            servingUnit: meal.servingUnit || 'porsiyon',
            nutrientsSnapshot: meal.nutrientsSnapshot || {
              calories: 0,
              protein: 0,
              carbs: 0,
            },
          },
        ]
      : [],
  };
};

const normalizeDaySlots = day => {
  const meals = Array.isArray(day?.meals) ? day.meals : [];
  return meals.map(normalizeSlot);
};

const normalizeDaysForEditor = days => {
  const emptyWeek = mealPlanService.createEmptyWeek();
  return mealPlanService.getDayKeys().reduce((acc, dayKey) => {
    const dayData = days?.[dayKey] || {};
    acc[dayKey] = {
      meals: normalizeDaySlots(dayData),
    };
    return acc;
  }, emptyWeek);
};

const toTimeValue = value => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  const date = new Date();
  if (!match) {
    date.setHours(8, 0, 0, 0);
    return date;
  }
  const h = Math.max(0, Math.min(23, Number(match[1])));
  const m = Math.max(0, Math.min(59, Number(match[2])));
  date.setHours(h, m, 0, 0);
  return date;
};

const formatTime = date => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const timeToMinutes = value => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
};

const getFoodDiseaseSignals = (food, diseases = []) => {
  const signals = [];
  const name = String(food?.name || '').toLowerCase();
  const glutenKeywords = ['wheat', 'barley', 'rye', 'bulgur', 'spelt', 'bread'];
  const glutenFreeKeywords = ['gluten free', 'gf'];
  const diseaseTags = Array.isArray(food?.diseaseTags) ? food.diseaseTags : [];
  const unsuitableDiseaseTags = Array.isArray(food?.unsuitableDiseaseTags) ? food.unsuitableDiseaseTags : [];
  const hasTag = (list, tag) => list.includes(tag);

  if (diseases.includes('diabetes')) {
    if (hasTag(unsuitableDiseaseTags, 'diabetes')) {
      signals.push({ label: 'Diyabet icin dikkat', type: 'warn' });
    } else if (hasTag(diseaseTags, 'diabetes')) {
      signals.push({ label: 'Diyabet icin daha uygun', type: 'ok' });
    } else if (Number(food?.sugar) <= 5 && Number(food?.fiber) >= 3 && Number(food?.carbs) <= 25) {
      signals.push({ label: 'Diyabet icin daha uygun', type: 'ok' });
    } else if (Number(food?.sugar) > 10 || Number(food?.carbs) > 40) {
      signals.push({ label: 'Diyabet icin dikkat', type: 'warn' });
    }
  }

  if (diseases.includes('celiac')) {
    if (hasTag(unsuitableDiseaseTags, 'celiac')) {
      signals.push({ label: 'Colyak icin gluten riski', type: 'warn' });
    } else if (hasTag(diseaseTags, 'celiac')) {
      signals.push({ label: 'Glutensiz secenek', type: 'ok' });
    } else if (glutenKeywords.some(keyword => name.includes(keyword))) {
      signals.push({ label: 'Colyak icin gluten riski', type: 'warn' });
    } else if (glutenFreeKeywords.some(keyword => name.includes(keyword))) {
      signals.push({ label: 'Glutensiz secenek', type: 'ok' });
    }
  }

  return signals;
};

const getFoodRefKey = food => {
  const fallback = `${String(food?.source || 'manual')}:${String(food?.name || '').trim().toLowerCase()}`;
  return String(food?.submissionId || food?.fdcId || fallback);
};

const parseServingLabel = serving => {
  const normalized = String(serving || '').trim();
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/);
  if (!match) return { amount: 1, unit: normalized || 'porsiyon' };
  const amount = Number(String(match[1]).replace(',', '.'));
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
    unit: String(match[2] || '').trim() || 'porsiyon',
  };
};

const formatDisplayAmount = value => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
};

const formatFoodServingWithMultiplier = (food, multiplier) => {
  const count = Number(multiplier) > 0 ? Number(multiplier) : 1;
  const servingInfo = parseServingLabel(food?.serving || '1 porsiyon');
  const totalAmount = servingInfo.amount * count;
  return `${formatDisplayAmount(totalAmount)} ${servingInfo.unit}`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = hex => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return { r: 30, g: 75, b: 54 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map(channel => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;

const mixColors = (fromHex, toHex, ratio) => {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const t = clamp(Number(ratio) || 0, 0, 1);
  return rgbToHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
};

const getColorFromStops = (stops, percent) => {
  const p = clamp(Number(percent) || 0, 0, 100);
  if (!Array.isArray(stops) || stops.length === 0) return '#1E4B36';
  if (p <= stops[0].point) return stops[0].color;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const start = stops[i];
    const end = stops[i + 1];
    if (p <= end.point) {
      const range = Math.max(1, end.point - start.point);
      const t = (p - start.point) / range;
      return mixColors(start.color, end.color, t);
    }
  }
  return stops[stops.length - 1].color;
};

const getCalorieProgressColors = (rawPercent, hasTarget) => {
  if (!hasTarget) {
    return {
      textColor: '#1E4B36',
      gradientColors: ['#2B6A4B', '#1E4B36'],
    };
  }

  if (rawPercent > 100) {
    const overRatio = clamp((rawPercent - 100) / 80, 0, 1);
    const overColor = mixColors('#1E4B36', '#DC2626', overRatio);
    return {
      textColor: overColor,
      gradientColors: [mixColors(overColor, '#FFFFFF', 0.18), overColor],
    };
  }

  const smoothStops = [
    { point: 0, color: '#F3A54A' },
    { point: 20, color: '#D7A86A' },
    { point: 35, color: '#82B4D8' },
    { point: 50, color: '#4B96D1' },
    { point: 70, color: '#4FAF95' },
    { point: 90, color: '#2E7C57' },
    { point: 100, color: '#1E4B36' },
  ];
  const base = getColorFromStops(smoothStops, rawPercent);
  return {
    textColor: base,
    gradientColors: [mixColors(base, '#FFFFFF', 0.22), mixColors(base, '#0E2B21', 0.08)],
  };
};

const countFoods = days =>
  mealPlanService.getDayKeys().reduce((total, dayKey) => {
    const slots = days?.[dayKey]?.meals || [];
    return total + slots.reduce((slotTotal, slot) => slotTotal + (slot.foods?.length || 0), 0);
  }, 0);

const dayHasPlannedFood = (days, dayKey) => {
  const slots = days?.[dayKey]?.meals || [];
  return slots.some(slot => (slot.foods || []).length > 0);
};

const getAverageDailyMacros = days => {
  const dayKeys = mealPlanService.getDayKeys();
  const dailyTotals = [];

  dayKeys.forEach(dayKey => {
    const slots = days?.[dayKey]?.meals || [];
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let hasFood = false;
    slots.forEach(slot => {
      (slot.foods || []).forEach(food => {
        hasFood = true;
        const amount = Number(food?.servingAmount) > 0 ? Number(food.servingAmount) : 1;
        calories += (Number(food?.nutrientsSnapshot?.calories) || 0) * amount;
        protein += (Number(food?.nutrientsSnapshot?.protein) || 0) * amount;
        carbs += (Number(food?.nutrientsSnapshot?.carbs) || 0) * amount;
      });
    });
    if (hasFood) {
      dailyTotals.push({ calories, protein, carbs });
    }
  });

  if (dailyTotals.length === 0) {
    return { calories: 0, protein: 0, carbs: 0 };
  }

  const divisor = dailyTotals.length;
  const sum = dailyTotals.reduce(
    (acc, d) => ({
      calories: acc.calories + d.calories,
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
    }),
    { calories: 0, protein: 0, carbs: 0 }
  );

  return {
    calories: Math.round(sum.calories / divisor),
    protein: Math.round(sum.protein / divisor),
    carbs: Math.round(sum.carbs / divisor),
  };
};

const getGaugeVisual = ({ value, target, hasTarget = true }) => {
  const safeValue = Math.max(0, Number(value) || 0);
  const safeTarget = Math.max(0, Number(target) || 0);
  const rawPercent = hasTarget && safeTarget > 0 ? (safeValue / safeTarget) * 100 : 100;
  const cappedPercent = hasTarget && safeTarget > 0 ? Math.min(100, rawPercent) : 100;
  const fillPercent = cappedPercent > 0 ? Math.max(6, cappedPercent) : 0;
  const { gradientColors } = getCalorieProgressColors(rawPercent, hasTarget && safeTarget > 0);
  return {
    rawPercent,
    fillPercent,
    gradientColors,
    gaugeColor: gradientColors?.[1] || '#1E4B36',
  };
};

const CALORIE_WARNING_RATIO = 1.25;

const getPlanWarnings = ({ plan, diseases, dailyCalorieTarget }) => {
  const warnings = [];
  const riskyFoods = new Set();

  mealPlanService.getDayKeys().forEach(dayKey => {
    const slots = plan?.days?.[dayKey]?.meals || [];
    slots.forEach(slot => {
      (slot.foods || []).forEach(food => {
        const signals = getFoodDiseaseSignals(food, diseases);
        if (signals.some(signal => signal.type === 'warn')) {
          riskyFoods.add(String(food?.name || 'Bilinmeyen besin'));
        }
      });
    });
  });

  if (riskyFoods.size > 0) {
    const names = Array.from(riskyFoods);
    const preview = names.slice(0, 3).join(', ');
    const extraCount = Math.max(0, names.length - 3);
    warnings.push(
      `${names.length} besin hastalik profilinle celisebilir: ${preview}${extraCount > 0 ? ` +${extraCount} daha` : ''}.`
    );
  }

  const target = Math.max(0, Number(dailyCalorieTarget) || 0);
  if (target > 0) {
    const avg = getAverageDailyMacros(plan?.days);
    const limit = Math.round(target * CALORIE_WARNING_RATIO);
    if (avg.calories > limit) {
      const percent = Math.round((avg.calories / target) * 100);
      warnings.push(`Ortalama kalori hedefin ustunde: ${avg.calories} kcal (hedef ${target} kcal, %${percent}).`);
    }
  }

  return warnings;
};

const createAiFoodItem = ({ name, calories, protein, carbs, serving = '1 porsiyon' }) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name,
  servingAmount: 1,
  servingBaseAmount: 1,
  servingUnit: 'porsiyon',
  source: 'ai_generator',
  sourceRefId: `ai-${String(name || '').toLowerCase()}`,
  serving,
  nutrientsSnapshot: {
    calories: Number(calories) || 0,
    protein: Number(protein) || 0,
    carbs: Number(carbs) || 0,
  },
});

const createUniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createAiWeeklyDays = ({ prompt, diseases }) => {
  const normalizedPrompt = String(prompt || '').toLocaleLowerCase('tr-TR');
  const wantsLowCarb = /(dusuk karbonhidrat|dusuk karb|low carb|keto)/.test(normalizedPrompt);
  const wantsHighProtein = /(yuksek protein|protein|kas|bulk|antrenman|fitness)/.test(normalizedPrompt);
  const diabetes = diseases.includes('diabetes');
  const celiac = diseases.includes('celiac');
  const isVegan = /vegan/.test(normalizedPrompt);
  const isVegetarian = !isVegan && /vejetaryen/.test(normalizedPrompt);
  const hasLactoseIntolerance = /laktoz intoleransi var/.test(normalizedPrompt);
  const sweetMode = /tatli alternatifi/.test(normalizedPrompt)
    ? 'yes'
    : /tatli secenekleri kontrollu/.test(normalizedPrompt)
      ? 'controlled'
      : 'no';
  const snackEnabled = /ara ogunler yer alsin/.test(normalizedPrompt);
  const mealCountMatch = normalizedPrompt.match(/gunluk ogun sayisi:\s*(\d+)/);
  const mealCount = Math.max(2, Math.min(5, Number(mealCountMatch?.[1]) || 4));

  const breakfastPool = wantsLowCarb
    ? [
        [createAiFoodItem({ name: 'Yumurta', calories: 156, protein: 13, carbs: 1 }), createAiFoodItem({ name: 'Avokado', calories: 160, protein: 2, carbs: 9 })],
        [createAiFoodItem({ name: 'Menemen', calories: 220, protein: 12, carbs: 8 }), createAiFoodItem({ name: 'Yesillik', calories: 40, protein: 2, carbs: 6 })],
        [createAiFoodItem({ name: 'Chia Puding', calories: 190, protein: 7, carbs: 10 }), createAiFoodItem({ name: 'Cig Badem', calories: 120, protein: 4, carbs: 4 })],
      ]
    : [
        [createAiFoodItem({ name: celiac ? 'Glutensiz Yulaf' : 'Yulaf', calories: 220, protein: 8, carbs: 34 }), createAiFoodItem({ name: hasLactoseIntolerance ? 'Badem Yogurdu' : 'Yogurt', calories: 110, protein: 8, carbs: 8 })],
        [createAiFoodItem({ name: celiac ? 'Karabuğday Lapasi' : 'Tam Tahilli Tost', calories: 240, protein: 10, carbs: 35 }), createAiFoodItem({ name: 'Haşlanmiş Yumurta', calories: 78, protein: 6, carbs: 1 })],
        [createAiFoodItem({ name: 'Meyve + Yulaf Kasesi', calories: 260, protein: 9, carbs: 42 }), createAiFoodItem({ name: 'Ceviz', calories: 90, protein: 2, carbs: 2 })],
      ];

  const omnivoreProtein = ['Tavuk Gogsu', 'Nohut', 'Izgara Balik', 'Mercimek', 'Hindi', 'Kurufasulye', 'Yumurta'];
  const vegetarianProtein = ['Nohut', 'Mercimek', 'Kinoa', 'Kurufasulye', 'Tofu', 'Bulgur + Yogurt', 'Fasulye'];
  const veganProtein = ['Nohut', 'Mercimek', 'Kinoa', 'Kurufasulye', 'Tofu', 'Bezelye', 'Fasulye'];
  const proteinList = isVegan ? veganProtein : isVegetarian ? vegetarianProtein : omnivoreProtein;
  const carbSide = celiac
    ? ['Kinoa', 'Karabuğday Pilavi', 'Patates Firin']
    : wantsLowCarb || diabetes
      ? ['Bol Yesillik Salata', 'Sebze Sote', 'Zeytinyagli Sebze']
      : ['Bulgur Pilavi', 'Tam Bugday Makarna', 'Esmer Pirinc'];
  const sweetDays = sweetMode === 'yes' ? new Set([1, 4, 6]) : sweetMode === 'controlled' ? new Set([5]) : new Set();
  const proteinBoostDays = wantsHighProtein ? new Set([0, 2, 4, 6]) : new Set();

  const dayKeys = mealPlanService.getDayKeys();
  return dayKeys.reduce((acc, dayKey, idx) => {
    const breakfast = breakfastPool[idx % breakfastPool.length].map(item => ({ ...item, id: createUniqueId() }));
    const mainProteinName = proteinList[idx % proteinList.length];
    const baseProtein = createAiFoodItem({
      name: mainProteinName,
      calories: proteinBoostDays.has(idx) ? 260 : 210,
      protein: proteinBoostDays.has(idx) ? 38 : 28,
      carbs: /nohut|mercimek|fasulye|kinoa|bezelye/i.test(mainProteinName) ? 18 : 4,
    });
    const side = createAiFoodItem({
      name: carbSide[idx % carbSide.length],
      calories: wantsLowCarb || diabetes ? 110 : 190,
      protein: wantsLowCarb || diabetes ? 4 : 6,
      carbs: wantsLowCarb || diabetes ? 12 : 32,
    });
    const dinnerProtein = createAiFoodItem({
      name: proteinList[(idx + 2) % proteinList.length],
      calories: proteinBoostDays.has(idx) ? 240 : 190,
      protein: proteinBoostDays.has(idx) ? 34 : 24,
      carbs: 6,
    });
    const dinnerSide = createAiFoodItem({
      name: diabetes || wantsLowCarb ? 'Sebze Sote' : carbSide[(idx + 1) % carbSide.length],
      calories: diabetes || wantsLowCarb ? 120 : 180,
      protein: 5,
      carbs: diabetes || wantsLowCarb ? 14 : 28,
    });
    const snackBase = createAiFoodItem({
      name: diabetes ? (hasLactoseIntolerance ? 'Badem + Ceviz' : 'Kefir + Badem') : hasLactoseIntolerance ? 'Meyve + Ceviz' : 'Meyve + Yogurt',
      calories: 160,
      protein: 7,
      carbs: diabetes ? 8 : 16,
    });
    const sweetItem = createAiFoodItem({
      name: diabetes ? 'Tarcinli Fit Tatli' : 'Bitter Cikolatali Mini Tatli',
      calories: 130,
      protein: 3,
      carbs: 14,
    });

    const slots = [
      { ...createMealSlot({ mealType: 'breakfast', time: '08:00' }), foods: breakfast },
      { ...createMealSlot({ mealType: 'lunch', time: '13:00' }), foods: [baseProtein, side] },
      { ...createMealSlot({ mealType: 'dinner', time: '19:00' }), foods: [dinnerProtein, dinnerSide] },
    ];
    if (mealCount >= 4 || snackEnabled) {
      const snackFoods = sweetDays.has(idx) ? [snackBase, sweetItem] : [snackBase];
      slots.push({ ...createMealSlot({ mealType: 'snack', time: '16:30' }), foods: snackFoods });
    }
    if (mealCount >= 5) {
      slots.push({
        ...createMealSlot({ mealType: 'snack', time: '21:00' }),
        foods: [createAiFoodItem({ name: 'Gece Ara Ogunu (Hafif)', calories: 110, protein: 5, carbs: 10 })],
      });
    }

    acc[dayKey] = {
      meals: slots,
    };
    return acc;
  }, mealPlanService.createEmptyWeek());
};

const formatPlanMetaDate = value => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${d}.${m}.${y}`;
};

const TextInput = props => (
  <RNTextInput
    placeholderTextColor="#6b7280"
    selectionColor="#2D5A27"
    underlineColorAndroid="transparent"
    {...props}
  />
);

const GAUGE_ARC_RADIUS = 34;
const GAUGE_STROKE_WIDTH = 11;
const GAUGE_SVG_WIDTH = 88;
const GAUGE_SVG_HEIGHT = 60;
const GAUGE_ARC_LENGTH = Math.PI * GAUGE_ARC_RADIUS;
const GAUGE_ARC_PATH = 'M 10 50 A 34 34 0 0 1 78 50';
const ACTIVE_PREMIUM_STATUSES = new Set(['active', 'grace']);
const PLAN_LIMITS = {
  free: { mealPlanLimit: 3, aiDailyLimit: 2 },
  premium: { mealPlanLimit: 10, aiDailyLimit: 12 },
  elite_premium: { mealPlanLimit: 30, aiDailyLimit: 30 },
  elite_premium_plus: { mealPlanLimit: 60, aiDailyLimit: 75 },
};
const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api';

const SavedPlanGaugeArc = ({ fillPercent, color }) => {
  const safePercent = Math.max(0, Math.min(100, Number(fillPercent) || 0));
  const progressLength = (GAUGE_ARC_LENGTH * safePercent) / 100;
  return (
    <Svg
      width={GAUGE_SVG_WIDTH}
      height={GAUGE_SVG_HEIGHT}
      viewBox={`0 0 ${GAUGE_SVG_WIDTH} ${GAUGE_SVG_HEIGHT}`}
      style={styles.savedPlanGaugeArcSvg}
    >
      <Path d={GAUGE_ARC_PATH} stroke="#BFD3C8" strokeWidth={GAUGE_STROKE_WIDTH} fill="none" strokeLinecap="round" />
      <Path
        d={GAUGE_ARC_PATH}
        stroke={color}
        strokeWidth={GAUGE_STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={[progressLength, GAUGE_ARC_LENGTH]}
      />
    </Svg>
  );
};

const computePlanListMenuLayout = anchor => {
  const win = Dimensions.get('window');
  const menuW = 168;
  const rowH = 40;
  const dividerH = 1;
  const menuH = rowH * 3 + dividerH * 2;
  let left = anchor.x + anchor.w - menuW;
  left = Math.max(10, Math.min(left, win.width - menuW - 10));
  let top = anchor.y + anchor.h + 4;
  if (top + menuH > win.height - 20) {
    top = Math.max(16, anchor.y - menuH - 4);
  }
  return { left, top, menuW, menuH, rowH, dividerH };
};

const MealPlanScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isStandaloneViewerRoute = route?.name === 'MealPlanViewer' || Boolean(route?.params?.openAsViewer);
  const [user, setUser] = useState(route?.params?.user || null);
  const [screenMode, setScreenMode] = useState(isStandaloneViewerRoute ? 'viewer' : 'list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState('');
  const [activeDay, setActiveDay] = useState('monday');
  const [planDraft, setPlanDraft] = useState(createDefaultPlanDraft);

  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [mealTypeDraft, setMealTypeDraft] = useState('breakfast');
  const [mealTimeDraft, setMealTimeDraft] = useState('08:00');
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [foodTargetSlotId, setFoodTargetSlotId] = useState('');
  const [searchingFood, setSearchingFood] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState([]);

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [copyingPlanId, setCopyingPlanId] = useState('');
  const [deletingPlanId, setDeletingPlanId] = useState('');
  const [planTitleDraft, setPlanTitleDraft] = useState('');
  const [planListSearchQuery, setPlanListSearchQuery] = useState('');
  const [planListMenu, setPlanListMenu] = useState(null);
  const [planWarningsModal, setPlanWarningsModal] = useState(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [fabMenuRender, setFabMenuRender] = useState(false);
  const [generatingAiPlan, setGeneratingAiPlan] = useState(false);
  const kebabRefMap = useRef({});
  const planListMenuAnim = useRef(new Animated.Value(0)).current;
  const fabMenuAnim = useRef(new Animated.Value(0)).current;
  const fabCloseTimeoutRef = useRef(null);
  const userDiseases = useMemo(() => (Array.isArray(user?.diseases) ? user.diseases : []), [user?.diseases]);
  const filteredPlans = useMemo(() => {
    const q = String(planListSearchQuery || '').trim().toLocaleLowerCase('tr-TR');
    if (!q) return plans;
    return plans.filter(p => String(p.title || '').toLocaleLowerCase('tr-TR').includes(q));
  }, [plans, planListSearchQuery]);
  const limitsSummary = useMemo(() => {
    const premium = user?.premium || {};
    const rawPlan = typeof premium.plan === 'string' ? premium.plan : 'free';
    const hasPlan = Object.prototype.hasOwnProperty.call(PLAN_LIMITS, rawPlan);
    const effectivePlan =
      hasPlan && rawPlan !== 'free' && ACTIVE_PREMIUM_STATUSES.has(premium.status || 'inactive')
        ? rawPlan
        : 'free';
    const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free;
    const planTotal = limits.mealPlanLimit;
    const planUsed = plans.length;
    const planRemaining = Math.max(0, planTotal - planUsed);

    const aiDailyLimit = limits.aiDailyLimit;
    const aiDailyUsed = Math.max(0, Number(user?.aiUsage?.dailyCount) || 0);
    const aiDailyRemaining = Math.max(0, aiDailyLimit - aiDailyUsed);

    return {
      planText: `${planRemaining}/${planTotal}`,
      aiText: `${aiDailyRemaining}/${aiDailyLimit}`,
      planRemaining,
      aiRemaining: aiDailyRemaining,
      aiLimit: aiDailyLimit,
      effectivePlan,
    };
  }, [user?.premium, user?.aiUsage?.dailyCount, plans.length]);

  const userId = user?.id || user?._id || user?.uid || '';

  useEffect(() => {
    if (route?.params?.user) return;
    AsyncStorage.getItem('user').then(raw => {
      if (!raw) return;
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    });
  }, [route?.params?.user]);

  const loadPlans = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await mealPlanService.getPlans(userId);
      setPlans(rows);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Planlar yuklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [userId]);

  useEffect(() => {
    setPlanTitleDraft(planDraft.title || '');
  }, [planDraft.title]);

  useEffect(() => {
    const isFabric = global?.nativeFabricUIManager != null;
    if (Platform.OS === 'android' && !isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!isStandaloneViewerRoute) return;
    const incomingPlan = route?.params?.plan;
    if (!incomingPlan?.id) return;
    setActivePlanId(incomingPlan.id);
    setPlanDraft({
      title: incomingPlan.title || '',
      weekStartDate: incomingPlan.weekStartDate || new Date().toISOString().slice(0, 10),
      days: normalizeDaysForEditor(incomingPlan.days),
    });
    setActiveDay('monday');
    setSaveModalVisible(false);
    setScreenMode('viewer');
  }, [isStandaloneViewerRoute, route?.params?.plan?.id, route?.params?.plan?.updatedAt]);

  const selectedDaySlots = useMemo(
    () => normalizeDaySlots(planDraft.days?.[activeDay]),
    [planDraft.days, activeDay]
  );

  const dayMacros = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0 };
    selectedDaySlots.forEach(slot => {
      (slot.foods || []).forEach(food => {
        const amount = Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1;
        totals.calories += (Number(food.nutrientsSnapshot?.calories) || 0) * amount;
        totals.protein += (Number(food.nutrientsSnapshot?.protein) || 0) * amount;
        totals.carbs += (Number(food.nutrientsSnapshot?.carbs) || 0) * amount;
      });
    });
    return totals;
  }, [selectedDaySlots]);

  const calorieProgress = useMemo(() => {
    const consumed = Math.max(0, Math.round(Number(dayMacros.calories) || 0));
    const target = Math.max(0, Number(user?.dailyCalories) || 0);
    const rawPercent = target <= 0 ? 100 : (consumed / target) * 100;
    const fillPercent = target <= 0 ? 100 : Math.min(100, rawPercent);
    const { textColor, gradientColors } = getCalorieProgressColors(rawPercent, target > 0);
    return {
      consumed,
      target,
      rawPercent,
      fillPercent,
      textColor,
      gradientColors,
      percentText: `${Math.round(target <= 0 ? 100 : rawPercent)}%`,
      detailText: target > 0
        ? `${consumed} / ${Math.round(target)} kcal`
        : `${consumed} kcal / Hedef belirtilmedi`,
    };
  }, [dayMacros.calories, user?.dailyCalories]);

  const totalFoods = useMemo(() => countFoods(planDraft.days), [planDraft.days]);

  const resetDraft = () => {
    setActivePlanId('');
    setPlanDraft(createDefaultPlanDraft());
    setPlanTitleDraft('');
    setFoodResults([]);
    setFoodSearchQuery('');
  };

  const openCreatePlanEditor = () => {
    resetDraft();
    setScreenMode('editor');
  };

  const openFabMenu = () => {
    if (fabCloseTimeoutRef.current) {
      clearTimeout(fabCloseTimeoutRef.current);
      fabCloseTimeoutRef.current = null;
    }
    setFabMenuRender(true);
    setFabMenuOpen(true);
    fabMenuAnim.stopAnimation();
    fabMenuAnim.setValue(0);
    Animated.spring(fabMenuAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    }).start();
  };

  const closeFabMenu = () => {
    setFabMenuOpen(false);
    fabMenuAnim.stopAnimation();
    Animated.timing(fabMenuAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (fabCloseTimeoutRef.current) {
      clearTimeout(fabCloseTimeoutRef.current);
    }
    fabCloseTimeoutRef.current = setTimeout(() => {
      setFabMenuRender(false);
      fabMenuAnim.setValue(0);
      fabCloseTimeoutRef.current = null;
    }, 240);
  };

  const toggleFabMenu = () => {
    if (fabMenuOpen) {
      closeFabMenu();
      return;
    }
    openFabMenu();
  };

  const canUseAiPlanner = limitsSummary.effectivePlan !== 'free' && limitsSummary.aiRemaining > 0;
  const aiPlannerLockedReason =
    limitsSummary.effectivePlan === 'free'
      ? 'AI Plan Uret sadece Premium uyelikte acik.'
      : 'Gunluk AI hakkin doldu. Yarini bekleyebilirsin.';

  const requestAiWeeklyPlan = async promptText => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AI plan uretmek icin yeniden giris yapmalisin.');
    }
    const token = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/meal-plans/generate-weekly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        prompt: promptText,
        profile: {
          dailyCalories: user?.dailyCalories || 0,
          height: user?.height || 0,
          weight: user?.weight || 0,
          gender: user?.gender || '',
          birthDate: user?.birthDate || '',
          diseases: Array.isArray(user?.diseases) ? user.diseases : [],
          hasDisease: Boolean(user?.hasDisease),
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || 'AI plan uretim istegi basarisiz oldu.');
    }
    return payload.generatedPlan;
  };

  const handleGenerateAiPlan = async promptText => {
    if (!canUseAiPlanner) {
      Alert.alert('Plan Uret', aiPlannerLockedReason);
      return;
    }
    const normalizedPrompt = String(promptText || '').trim();
    if (!normalizedPrompt) {
      Alert.alert('Uyari', 'Ne tur bir plan istedigini kisaca yazmalisin.');
      return;
    }
    setGeneratingAiPlan(true);
    try {
      const generated = await requestAiWeeklyPlan(normalizedPrompt);
      const generatedTitle = String(generated?.title || `AI Plan - ${new Date().toLocaleDateString('tr-TR')}`);
      const generatedDays = normalizeDaysForEditor(generated?.days);
      setActivePlanId('');
      setPlanDraft({
        title: generatedTitle,
        weekStartDate: generated?.weekStartDate || new Date().toISOString().slice(0, 10),
        days: generatedDays,
      });
      setActiveDay('monday');
      setPlanTitleDraft(generatedTitle);
      await AsyncStorage.getItem('user').then(raw => {
        if (!raw) return;
        try {
          const latest = JSON.parse(raw);
          setUser(latest);
        } catch {
          // no-op
        }
      });
      setFabMenuOpen(false);
      setScreenMode('editor');
      Alert.alert('Basarili', 'AI taslak plan olusturuldu. Istersen duzenleyip kaydedebilirsin.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'AI plan uretilirken bir sorun olustu.');
    } finally {
      setGeneratingAiPlan(false);
    }
  };

  useEffect(() => {
    const incomingPrompt = route?.params?.aiPromptFromBuilder;
    const nonce = route?.params?.aiPromptNonce;
    if (screenMode !== 'list' || !incomingPrompt || !nonce || generatingAiPlan) {
      return;
    }
    handleGenerateAiPlan(incomingPrompt);
    navigation.setParams({
      aiPromptFromBuilder: null,
      aiPromptNonce: null,
    });
  }, [route?.params?.aiPromptNonce, route?.params?.aiPromptFromBuilder, screenMode, generatingAiPlan]);

  const handleBackPress = () => {
    if (screenMode === 'viewer' && isStandaloneViewerRoute) {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate('MealPlan', { user });
      return;
    }
    if (screenMode === 'editor' || screenMode === 'viewer') {
      setScreenMode('list');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home', { user });
  };

  const openMealModal = () => {
    setMealTypeDraft('breakfast');
    setMealTimeDraft('08:00');
    setMealModalVisible(true);
  };

  const handleAddMealSlot = () => {
    if (!mealTimeDraft.trim()) {
      Alert.alert('Uyari', 'Ogun saati zorunlu.');
      return;
    }
    const slot = createMealSlot({ mealType: mealTypeDraft, time: mealTimeDraft.trim() });
    setPlanDraft(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [activeDay]: {
          meals: [...normalizeDaySlots(prev.days?.[activeDay]), slot],
        },
      },
    }));
    setMealModalVisible(false);
  };

  const handleTimePickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setTimePickerVisible(false);
    }
    if (event?.type === 'dismissed') return;
    if (selectedDate) {
      setMealTimeDraft(formatTime(selectedDate));
    }
  };

  const openFoodModalForSlot = slotId => {
    setFoodTargetSlotId(slotId);
    setFoodSearchQuery('');
    setFoodResults([]);
    setFoodModalVisible(true);
  };

  const handleSearchFood = async () => {
    const normalized = String(foodSearchQuery || '').trim();
    if (!normalized) {
      setFoodResults([]);
      return;
    }
    setSearchingFood(true);
    try {
      const rows = await nutritionService.searchFoods(normalized);
      setFoodResults(Array.isArray(rows) ? rows.slice(0, 8) : []);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Besin arama basarisiz oldu.');
    } finally {
      setSearchingFood(false);
    }
  };

  const getFoodQuantityForSlot = food => {
    const targetSlot = selectedDaySlots.find(slot => slot.id === foodTargetSlotId);
    if (!targetSlot) return 0;
    const refKey = getFoodRefKey(food);
    return (targetSlot.foods || []).reduce((sum, existingFood) => {
      const existingRef = String(existingFood?.sourceRefId || '');
      const fallbackMatch =
        !existingRef &&
        String(existingFood?.name || '').trim().toLowerCase() === String(food?.name || '').trim().toLowerCase() &&
        String(existingFood?.source || 'manual') === String(food?.source || 'manual');
      const isMatch = existingRef === refKey || fallbackMatch;
      if (!isMatch) return sum;
      const amount = Number(existingFood?.servingAmount);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 1);
    }, 0);
  };

  const setFoodQuantityForSlot = (food, nextQuantity) => {
    const normalizedQuantity = Math.max(0, Math.round(Number(nextQuantity) || 0));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setPlanDraft(prev => {
      const currentSlots = normalizeDaySlots(prev.days?.[activeDay]);
      const refKey = getFoodRefKey(food);
      const parsedServing = parseServingLabel(food?.serving || '1 porsiyon');

      const nextSlots = currentSlots.map(slot => {
        if (slot.id !== foodTargetSlotId) return slot;

        const slotFoods = Array.isArray(slot.foods) ? slot.foods : [];
        let matchedFood = null;
        const nextFoods = [];

        slotFoods.forEach(existingFood => {
          const existingRef = String(existingFood?.sourceRefId || '');
          const fallbackMatch =
            !existingRef &&
            String(existingFood?.name || '').trim().toLowerCase() === String(food?.name || '').trim().toLowerCase() &&
            String(existingFood?.source || 'manual') === String(food?.source || 'manual');
          const isMatch = existingRef === refKey || fallbackMatch;
          if (isMatch) {
            if (!matchedFood) matchedFood = existingFood;
            return;
          }
          nextFoods.push(existingFood);
        });

        if (normalizedQuantity > 0) {
          if (matchedFood) {
            nextFoods.push({
              ...matchedFood,
              servingAmount: normalizedQuantity,
              servingBaseAmount: Number(matchedFood?.servingBaseAmount) > 0
                ? Number(matchedFood?.servingBaseAmount)
                : parsedServing.amount,
              servingUnit: matchedFood?.servingUnit || parsedServing.unit || 'porsiyon',
              sourceRefId: refKey,
            });
          } else {
            nextFoods.push({
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              name: food?.name || 'Besin',
              servingAmount: normalizedQuantity,
              servingBaseAmount: parsedServing.amount,
              servingUnit: parsedServing.unit || 'porsiyon',
              source: food?.source || 'manual',
              sourceRefId: refKey,
              nutrientsSnapshot: {
                calories: Number(food?.calories || 0),
                protein: Number(food?.protein || 0),
                carbs: Number(food?.carbs || 0),
              },
            });
          }
        }

        return { ...slot, foods: nextFoods };
      });

      return {
        ...prev,
        days: {
          ...prev.days,
          [activeDay]: { meals: nextSlots },
        },
      };
    });
  };

  const adjustFoodAmountInSlot = (slotId, foodId, delta) => {
    const step = Number(delta) || 0;
    if (!step) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setPlanDraft(prev => {
      const currentSlots = normalizeDaySlots(prev.days?.[activeDay]);
      const nextSlots = currentSlots.map(slot => {
        if (slot.id !== slotId) return slot;
        const nextFoods = (slot.foods || []).flatMap(food => {
          if (food.id !== foodId) return [food];
          const currentAmount = Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1;
          const nextAmount = currentAmount + step;
          if (nextAmount <= 0) return [];
          return [{ ...food, servingAmount: nextAmount }];
        });
        return { ...slot, foods: nextFoods };
      });
      return {
        ...prev,
        days: {
          ...prev.days,
          [activeDay]: { meals: nextSlots },
        },
      };
    });
  };

  const removeMealTypeSlots = mealType => {
    const targetSlots = getSlotsByType(mealType);
    if (targetSlots.length === 0) return;

    Alert.alert('Ogunu Sil', 'Bu ogune ait tum saatleri silmek istiyor musun?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setPlanDraft(prev => {
            const currentSlots = normalizeDaySlots(prev.days?.[activeDay]);
            const nextSlots = currentSlots.filter(slot => slot.mealType !== mealType);
            return {
              ...prev,
              days: {
                ...prev.days,
                [activeDay]: { meals: nextSlots },
              },
            };
          });
        },
      },
    ]);
  };

  const getSlotsByType = mealType =>
    selectedDaySlots
      .filter(slot => slot.mealType === mealType)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

  const getMealTypeCalories = mealType => {
    const slots = getSlotsByType(mealType);
    let total = 0;
    slots.forEach(slot => {
      (slot.foods || []).forEach(food => {
        const amount = Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1;
        total += (Number(food.nutrientsSnapshot?.calories) || 0) * amount;
      });
    });
    return Math.round(total);
  };

  const getMealTypeTimesLabel = mealType => {
    const slots = getSlotsByType(mealType);
    const times = [...new Set(slots.map(slot => String(slot.time || '').trim()).filter(Boolean))];
    if (times.length === 0) return '--:--';
    return times.join(' • ');
  };

  const getMealTypeEarliestTime = mealType => {
    const slots = getSlotsByType(mealType);
    return slots.reduce((min, slot) => Math.min(min, timeToMinutes(slot.time)), Number.POSITIVE_INFINITY);
  };

  const sortedMealTypesForDay = useMemo(() => {
    return MEAL_TYPES
      .filter(type => getSlotsByType(type.key).length > 0)
      .sort((a, b) => {
        const aTime = getMealTypeEarliestTime(a.key);
        const bTime = getMealTypeEarliestTime(b.key);
        if (aTime !== bTime) return aTime - bTime;
        return a.label.localeCompare(b.label, 'tr');
      });
  }, [selectedDaySlots]);

  const openSaveModal = () => {
    setPlanTitleDraft(planDraft.title || '');
    setSaveModalVisible(true);
  };

  const handleSavePlan = async () => {
    const normalizedTitle = String(planTitleDraft || '').trim();
    if (!normalizedTitle) {
      Alert.alert('Uyari', 'Plan ismi zorunlu.');
      return;
    }
    if (totalFoods === 0) {
      Alert.alert('Uyari', 'Plana en az bir besin eklemelisin.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: normalizedTitle,
        weekStartDate: planDraft.weekStartDate,
        days: normalizeDaysForEditor(planDraft.days),
      };
      if (activePlanId) {
        await mealPlanService.updatePlan({
          planId: activePlanId,
          ...payload,
        });
      } else {
        await mealPlanService.createPlan({
          userId,
          ...payload,
        });
      }
      await loadPlans();
      setSaveModalVisible(false);
      resetDraft();
      setScreenMode('list');
      Alert.alert('Basarili', 'Beslenme plani kaydedildi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Plan kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const selectExistingPlan = (plan, mode = 'editor') => {
    setActivePlanId(plan.id);
    setPlanDraft({
      title: plan.title || '',
      weekStartDate: plan.weekStartDate || new Date().toISOString().slice(0, 10),
      days: normalizeDaysForEditor(plan.days),
    });
    setActiveDay('monday');
    setSaveModalVisible(false);
    setScreenMode(mode);
  };

  const openPlanViewer = plan => {
    navigation.navigate('MealPlanViewer', {
      user,
      plan,
      openAsViewer: true,
    });
  };

  const copyPlan = async plan => {
    if (!plan?.id || !userId || copyingPlanId) return;
    setCopyingPlanId(plan.id);
    try {
      await mealPlanService.createPlan({
        userId,
        title: String(plan.title || '').trim() || 'Plan',
        weekStartDate: plan.weekStartDate || new Date().toISOString().slice(0, 10),
        days: normalizeDaysForEditor(plan.days),
      });
      await loadPlans();
      Alert.alert('Basarili', 'Plan kopyalandi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Plan kopyalanamadi.');
    } finally {
      setCopyingPlanId('');
    }
  };

  const confirmCopyPlan = plan => {
    Alert.alert('Plani Kopyala', `"${plan?.title || 'Bu plan'}" icin bir kopya olusturulsun mu?`, [
      { text: 'Vazgec', style: 'cancel' },
      { text: 'Kopyala', onPress: () => copyPlan(plan) },
    ]);
  };

  const deletePlan = async plan => {
    if (!plan?.id || deletingPlanId) return;
    setDeletingPlanId(plan.id);
    try {
      await mealPlanService.deletePlan(plan.id);
      await loadPlans();
      Alert.alert('Basarili', 'Plan silindi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Plan silinemedi.');
    } finally {
      setDeletingPlanId('');
    }
  };

  const confirmDeletePlan = plan => {
    Alert.alert('Plani Sil', `"${plan?.title || 'Bu plan'}" kalici olarak silinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deletePlan(plan) },
    ]);
  };

  const closePlanListMenu = useCallback(() => {
    Animated.timing(planListMenuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPlanListMenu(null);
      }
    });
  }, [planListMenuAnim]);

  useEffect(() => {
    if (!planListMenu) {
      return;
    }
    planListMenuAnim.setValue(0);
    Animated.spring(planListMenuAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 100,
    }).start();
  }, [planListMenu, planListMenuAnim]);

  useEffect(() => {
    return () => {
      if (fabCloseTimeoutRef.current) {
        clearTimeout(fabCloseTimeoutRef.current);
        fabCloseTimeoutRef.current = null;
      }
    };
  }, []);

  const openPlanListMenu = plan => {
    if (planListMenu?.plan?.id === plan.id) {
      closePlanListMenu();
      return;
    }
    const r = kebabRefMap.current[plan.id];
    if (!r) {
      return;
    }
    r.measureInWindow((x, y, w, h) => {
      planListMenuAnim.setValue(0);
      setPlanListMenu({ plan, anchor: { x, y, w, h } });
    });
  };

  const isViewerMode = screenMode === 'viewer';
  const isPlanCreateLocked = limitsSummary.planRemaining <= 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2D5A27" />
      </SafeAreaView>
    );
  }

  if (screenMode === 'list') {
    return (
      <LinearGradient colors={['#F7F9F5', '#E7EFE6']} style={styles.listGradientRoot}>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, styles.listSafeOverGradient]}>
          <View style={styles.wrapper}>
            <View style={styles.headerList}>
              <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
                <Icon name="arrow-left" size={22} color="#1E4B36" />
              </TouchableOpacity>
              <Text style={styles.listTitle}>Beslenme Planlarim</Text>
            </View>
            <View style={styles.listSearchContainer}>
              <Icon name="magnify" size={24} color="#2D5A27" style={styles.listSearchIcon} />
              <TextInput
                style={styles.listSearchInput}
                placeholder="Planda ara..."
                placeholderTextColor="#666"
                value={planListSearchQuery}
                onChangeText={setPlanListSearchQuery}
                returnKeyType="search"
              />
            </View>
            <Text style={styles.listSubtitle}>Kayitli planlarini goruntule veya yeni plan olustur.</Text>
          <View style={styles.limitInfoRow}>
            <View style={styles.limitInfoCard}>
              <View style={styles.limitInfoHeader}>
                <Icon name="calendar-check-outline" size={16} color="#1E4B36" />
                <Text style={styles.limitInfoTitle}>Kalan Plan Hakki</Text>
              </View>
              <Text style={styles.limitInfoValue}>{limitsSummary.planText}</Text>
            </View>
            <View style={styles.limitInfoCard}>
              <View style={styles.limitInfoHeader}>
                <Icon name="brain" size={16} color="#1E4B36" />
                <Text style={styles.limitInfoTitle}>Kalan AI Analiz</Text>
              </View>
              <Text style={styles.limitInfoValue}>{limitsSummary.aiText}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContainer}
            onScrollBeginDrag={() => {
              if (planListMenu) {
                closePlanListMenu();
              }
            }}
          >
            {plans.length === 0 ? (
              <TouchableOpacity style={styles.emptyStateCard} onPress={openCreatePlanEditor}>
                <Icon name="calendar-plus" size={24} color="#1E4B36" />
                <Text style={styles.emptyStateTitle}>Henuz planiniz yok</Text>
                <Text style={styles.emptyStateDesc}>Olusturmak icin tiklayiniz.</Text>
              </TouchableOpacity>
            ) : filteredPlans.length === 0 ? (
              <View style={styles.listSearchEmptyWrap}>
                <Icon name="magnify" size={40} color="#9CA89E" />
                <Text style={styles.listSearchEmptyTitle}>Sonuc bulunamadi</Text>
                <Text style={styles.listSearchEmptyDesc}>Baska bir kelime deneyin veya aramayi temizleyin.</Text>
              </View>
            ) : (
              filteredPlans.map(plan => {
                const avg = getAverageDailyMacros(plan.days);
                const planWarnings = getPlanWarnings({
                  plan,
                  diseases: userDiseases,
                  dailyCalorieTarget: Number(user?.dailyCalories) || 0,
                });
                const hasPlanWarning = planWarnings.length > 0;
                const caloriesGauge = getGaugeVisual({
                  value: avg.calories,
                  target: Number(user?.dailyCalories) || 0,
                  hasTarget: Number(user?.dailyCalories) > 0,
                });
                const proteinGauge = getGaugeVisual({ value: avg.protein, target: 120, hasTarget: true });
                const carbsGauge = getGaugeVisual({ value: avg.carbs, target: 300, hasTarget: true });
                return (
                  <TouchableOpacity key={plan.id} style={styles.savedPlanItem} onPress={() => openPlanViewer(plan)}>
                    {hasPlanWarning ? (
                      <TouchableOpacity
                        style={styles.savedPlanWarningButton}
                        onPress={e => {
                          e?.stopPropagation?.();
                          setPlanWarningsModal({
                            title: plan.title || 'Bu plan',
                            warnings: planWarnings,
                          });
                        }}
                        activeOpacity={0.85}
                        accessibilityLabel="Plan uyarilarini ac"
                      >
                        <Icon name="alert" size={20} color="#E09A12" />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      ref={el => {
                        if (el) {
                          kebabRefMap.current[plan.id] = el;
                        } else {
                          delete kebabRefMap.current[plan.id];
                        }
                      }}
                      style={styles.savedPlanMenuButton}
                      onPress={e => {
                        e?.stopPropagation?.();
                        openPlanListMenu(plan);
                      }}
                      activeOpacity={0.75}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      accessibilityLabel="Plani kopyala, duzenle veya sil"
                    >
                      {copyingPlanId === plan.id || deletingPlanId === plan.id ? (
                        <ActivityIndicator size="small" color="#1E4B36" />
                      ) : (
                        <Icon name="dots-vertical" size={20} color="#1E4B36" />
                      )}
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.savedPlanName,
                        styles.savedPlanNameInList,
                        hasPlanWarning && styles.savedPlanNameWithWarning,
                      ]}
                    >
                      {plan.title}
                    </Text>
                    <View style={styles.savedPlanGaugesRow}>
                      <View style={styles.savedPlanGaugeItem}>
                        <View style={styles.savedPlanGaugeArcWrap}>
                          <SavedPlanGaugeArc fillPercent={caloriesGauge.fillPercent} color={caloriesGauge.gaugeColor} />
                          <View style={styles.savedPlanGaugeCenter}>
                            <Text style={styles.savedPlanGaugeValue}>{avg.calories}</Text>
                            <Text style={styles.savedPlanGaugeUnit}>kcal</Text>
                          </View>
                        </View>
                        <Text style={styles.savedPlanGaugeTitle}>Kalori</Text>
                      </View>

                      <View style={styles.savedPlanGaugeItem}>
                        <View style={styles.savedPlanGaugeArcWrap}>
                          <SavedPlanGaugeArc fillPercent={proteinGauge.fillPercent} color={proteinGauge.gaugeColor} />
                          <View style={styles.savedPlanGaugeCenter}>
                            <Text style={styles.savedPlanGaugeValue}>{avg.protein}</Text>
                            <Text style={styles.savedPlanGaugeUnit}>g</Text>
                          </View>
                        </View>
                        <Text style={styles.savedPlanGaugeTitle}>Protein</Text>
                      </View>

                      <View style={styles.savedPlanGaugeItem}>
                        <View style={styles.savedPlanGaugeArcWrap}>
                          <SavedPlanGaugeArc fillPercent={carbsGauge.fillPercent} color={carbsGauge.gaugeColor} />
                          <View style={styles.savedPlanGaugeCenter}>
                            <Text style={styles.savedPlanGaugeValue}>{avg.carbs}</Text>
                            <Text style={styles.savedPlanGaugeUnit}>g</Text>
                          </View>
                        </View>
                        <Text style={styles.savedPlanGaugeTitle}>Karbonhidrat</Text>
                      </View>
                    </View>
                    <View style={styles.savedPlanWeekRow}>
                      {DAY_OPTIONS.map(day => {
                        const active = dayHasPlannedFood(plan.days, day.key);
                        return (
                          <View
                            key={day.key}
                            style={[styles.savedPlanDayDot, active && styles.savedPlanDayDotActive]}
                          >
                            <Text
                              style={[styles.savedPlanDayDotText, active && styles.savedPlanDayDotTextActive]}
                              numberOfLines={1}
                            >
                              {day.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.savedPlanTapHint}>
                      Son Guncelleme: {formatPlanMetaDate(plan.updatedAt)} • Goruntulemek icin dokun
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Modal
            visible={Boolean(planListMenu)}
            transparent
            animationType="none"
            onRequestClose={closePlanListMenu}
            statusBarTranslucent
          >
            {planListMenu ? (
              <View style={styles.planListMenuRoot}>
                <Pressable style={styles.planListMenuBackdrop} onPress={closePlanListMenu} />
                {(() => {
                  const layout = computePlanListMenuLayout(planListMenu.anchor);
                  const p = planListMenu.plan;
                  return (
                    <Animated.View
                      style={[
                        styles.planListMenuCard,
                        {
                          left: layout.left,
                          top: layout.top,
                          width: layout.menuW,
                          minHeight: layout.menuH,
                          opacity: planListMenuAnim,
                          transform: [
                            {
                              scale: planListMenuAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Pressable
                        style={[styles.planListMenuRow, { minHeight: layout.rowH }]}
                        onPress={() => {
                          setPlanListMenu(null);
                          planListMenuAnim.setValue(0);
                          selectExistingPlan(p, 'editor');
                        }}
                        android_ripple={{ color: 'rgba(30, 75, 54, 0.1)' }}
                      >
                        <Icon name="pencil-outline" size={16} color="#1E4B36" />
                        <Text style={styles.planListMenuRowText}>Duzenle</Text>
                      </Pressable>
                      <View style={[styles.planListMenuDivider, { height: layout.dividerH }]} />
                      <Pressable
                        style={[
                          styles.planListMenuRow,
                          { minHeight: layout.rowH },
                          isPlanCreateLocked && styles.planListMenuRowDisabled,
                        ]}
                        disabled={isPlanCreateLocked || copyingPlanId === p.id}
                        onPress={() => {
                          if (isPlanCreateLocked) {
                            return;
                          }
                          setPlanListMenu(null);
                          planListMenuAnim.setValue(0);
                          confirmCopyPlan(p);
                        }}
                        android_ripple={{ color: 'rgba(30, 75, 54, 0.1)' }}
                      >
                        {copyingPlanId === p.id ? (
                          <ActivityIndicator size="small" color="#1E4B36" />
                        ) : isPlanCreateLocked ? (
                          <Icon name="lock-outline" size={16} color="#6A7A71" />
                        ) : (
                          <Icon name="content-copy" size={16} color="#1E4B36" />
                        )}
                        <Text
                          style={[
                            styles.planListMenuRowText,
                            (isPlanCreateLocked || copyingPlanId === p.id) && styles.planListMenuRowTextMuted,
                          ]}
                        >
                          Kopyala
                        </Text>
                      </Pressable>
                      <View style={[styles.planListMenuDivider, { height: layout.dividerH }]} />
                      <Pressable
                        style={({ pressed }) => [
                          styles.planListMenuRow,
                          { minHeight: layout.rowH },
                          (pressed || deletingPlanId === p.id) && styles.planListMenuRowDeletePressed,
                        ]}
                        disabled={deletingPlanId === p.id}
                        onPress={() => {
                          setPlanListMenu(null);
                          planListMenuAnim.setValue(0);
                          confirmDeletePlan(p);
                        }}
                        android_ripple={{ color: 'rgba(138, 31, 31, 0.12)' }}
                      >
                        {deletingPlanId === p.id ? (
                          <ActivityIndicator size="small" color="#8A1F1F" />
                        ) : (
                          <Icon name="trash-can-outline" size={16} color="#8A1F1F" />
                        )}
                        <Text style={styles.planListMenuRowTextDestructive}>Sil</Text>
                      </Pressable>
                    </Animated.View>
                  );
                })()}
              </View>
            ) : null}
          </Modal>

          <Modal
            visible={Boolean(planWarningsModal)}
            transparent
            animationType="fade"
            onRequestClose={() => setPlanWarningsModal(null)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.planWarningBackdrop} onPress={() => setPlanWarningsModal(null)} />
              {planWarningsModal ? (
                <View style={styles.planWarningModalCard}>
                  <View style={styles.planWarningModalHeader}>
                    <Icon name="alert-outline" size={20} color="#B8791B" />
                    <Text style={styles.planWarningModalTitle}>Plan Uyarilari</Text>
                  </View>
                  <Text style={styles.planWarningModalPlanName}>{planWarningsModal.title}</Text>
                  {planWarningsModal.warnings.map((warning, idx) => (
                    <View key={`${warning}-${idx}`} style={styles.planWarningRow}>
                      <Icon name="minus" size={14} color="#B8791B" />
                      <Text style={styles.planWarningText}>{warning}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.planWarningModalCloseButton} onPress={() => setPlanWarningsModal(null)}>
                    <Text style={styles.planWarningModalCloseText}>Tamam</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </Modal>

          {fabMenuRender ? (
          <Animated.View
            pointerEvents={fabMenuOpen ? 'auto' : 'none'}
            style={[
              styles.fabMenuWrap,
              {
                opacity: fabMenuAnim,
                transform: [
                  {
                    translateY: fabMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: fabMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
              <TouchableOpacity
                style={[
                  styles.fabActionButton,
                  (isPlanCreateLocked || generatingAiPlan) && styles.fabActionButtonDisabled,
                ]}
                onPress={() => {
                  if (isPlanCreateLocked || generatingAiPlan) {
                    return;
                  }
                  closeFabMenu();
                  openCreatePlanEditor();
                }}
                disabled={isPlanCreateLocked || generatingAiPlan}
              >
                <Icon
                  name={isPlanCreateLocked ? 'lock-outline' : 'calendar-plus'}
                  size={16}
                  color={isPlanCreateLocked || generatingAiPlan ? '#6A7A71' : '#fff'}
                />
                <Text style={[styles.fabActionText, (isPlanCreateLocked || generatingAiPlan) && styles.fabActionTextDisabled]}>
                  Plan Ekle
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabActionButton, (!canUseAiPlanner || generatingAiPlan) && styles.fabActionButtonDisabled]}
                onPress={() => {
                  closeFabMenu();
                  navigation.navigate('MealPlanAiPrompt', {
                    user,
                    canUseAiPlanner,
                    lockedReason: aiPlannerLockedReason,
                  });
                }}
                disabled={!canUseAiPlanner || generatingAiPlan}
              >
                <Icon
                  name={canUseAiPlanner ? 'brain' : 'lock-outline'}
                  size={16}
                  color={canUseAiPlanner && !generatingAiPlan ? '#fff' : '#6A7A71'}
                />
                <Text style={[styles.fabActionText, (!canUseAiPlanner || generatingAiPlan) && styles.fabActionTextDisabled]}>
                  AI Plan Uret
                </Text>
              </TouchableOpacity>
          </Animated.View>
          ) : null}
          <TouchableOpacity style={styles.listFabPlusButton} onPress={toggleFabMenu} activeOpacity={0.85}>
            <Icon name={fabMenuOpen ? 'close' : 'plus'} size={24} color="#fff" />
          </TouchableOpacity>

        </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.wrapper}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Icon name="arrow-left" size={22} color="#1E4B36" />
            </TouchableOpacity>
            <Text style={styles.title}>{isViewerMode ? 'Plan Takvimi' : t('mealPlan.title')}</Text>
          </View>
          <Text style={styles.subtitle}>
            {isViewerMode ? 'Goruntuleme modu: Karttan gun gun planini inceleyebilirsin.' : t('mealPlan.subtitle')}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
            {DAY_OPTIONS.map(day => (
              <TouchableOpacity
                key={day.key}
                style={[styles.dayCard, activeDay === day.key && styles.dayCardActive]}
                onPress={() => setActiveDay(day.key)}
              >
                <Text style={[styles.dayLabel, activeDay === day.key && styles.dayLabelActive]}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.macroCard}>
            <Text style={styles.macroTitle}>Toplam Kalori</Text>
            <Text style={styles.macroValue}>{Math.round(dayMacros.calories)} kcal</Text>
            <View style={styles.calorieProgressRow}>
              <Text style={styles.calorieProgressDetail}>{calorieProgress.detailText}</Text>
              <Text style={[styles.calorieProgressPercent, { color: calorieProgress.textColor }]}>
                {calorieProgress.percentText}
              </Text>
            </View>
            <View style={styles.calorieProgressTrack}>
              <LinearGradient
                style={[
                  styles.calorieProgressFill,
                  { width: `${calorieProgress.fillPercent}%` },
                ]}
                colors={calorieProgress.gradientColors}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            </View>
          </View>
          <View style={styles.macroCard}>
            <Text style={styles.macroTitle}>Protein</Text>
            <Text style={styles.macroValue}>{Math.round(dayMacros.protein)} g</Text>
          </View>
          <View style={styles.macroCard}>
            <Text style={styles.macroTitle}>Karbonhidrat</Text>
            <Text style={styles.macroValue}>{Math.round(dayMacros.carbs)} g</Text>
          </View>

          {!isViewerMode ? (
            <TouchableOpacity style={styles.addMealButton} onPress={openMealModal}>
              <Icon name="plus-circle-outline" size={18} color="#1E4B36" />
              <Text style={styles.addMealButtonText}>Ogun Ekle</Text>
            </TouchableOpacity>
          ) : null}

          {selectedDaySlots.length === 0 ? (
            <View style={styles.emptyDayCard}>
              <Text style={styles.emptyDayText}>
                {isViewerMode ? 'Bu gunde planlanmis ogun bulunmuyor.' : 'Henuz ogun eklenmedi. Baslamak icin "Ogun Ekle"ye dokun.'}
              </Text>
            </View>
          ) : (
            sortedMealTypesForDay.map(type => {
              const slots = getSlotsByType(type.key);
              return (
                <View key={type.key} style={styles.mealSection}>
                  <View style={styles.mealSectionHeader}>
                    <View style={styles.mealSectionTitleWrap}>
                      <Icon name={type.icon} size={16} color="#FFFFFF" />
                      <Text style={styles.mealSectionTitle}>{type.label}</Text>
                      <View style={styles.mealTimeDivider} />
                      <Text style={styles.mealTimeInlineText}>{getMealTypeTimesLabel(type.key)}</Text>
                    </View>
                    <View style={styles.mealHeaderRight}>
                      <Text style={styles.mealCaloriesText}>{getMealTypeCalories(type.key)} kcal</Text>
                      {!isViewerMode ? (
                        <TouchableOpacity style={styles.removeMealIconButton} onPress={() => removeMealTypeSlots(type.key)}>
                          <Icon name="trash-can-outline" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {slots.map(slot => (
                    <View key={slot.id} style={styles.slotCard}>
                      {(slot.foods || []).length === 0 ? (
                        <Text style={styles.emptySlotText}>Besin eklenmedi.</Text>
                      ) : (
                        (slot.foods || []).map(food => (
                          <View key={food.id} style={styles.foodRow}>
                            <View>
                              <Text style={styles.foodName}>{food.name}</Text>
                              <Text style={styles.foodMeta}>
                                {formatDisplayAmount(
                                  (Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1) *
                                  (Number(food.servingBaseAmount) > 0
                                    ? Number(food.servingBaseAmount)
                                    : (String(food.servingUnit || '').toLowerCase() === 'g' || String(food.servingUnit || '').toLowerCase() === 'ml')
                                      ? 100
                                      : 1)
                                )}{' '}
                                {food.servingUnit} - {Math.round((food.nutrientsSnapshot?.calories || 0) * (Number(food.servingAmount) || 1))} kcal
                              </Text>
                            </View>
                            {isViewerMode ? (
                              <View style={styles.foodInlineQtyReadonly}>
                                <Text style={styles.foodInlineQtyReadonlyText}>x{Number(food.servingAmount) || 1}</Text>
                              </View>
                            ) : (
                              <View style={styles.foodInlineQtyControl}>
                                <TouchableOpacity
                                  style={styles.foodInlineQtyButton}
                                  onPress={() => adjustFoodAmountInSlot(slot.id, food.id, -1)}
                                >
                                  <Icon name="minus" size={14} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.foodInlineQtyText}>{Number(food.servingAmount) || 1}</Text>
                                <TouchableOpacity
                                  style={styles.foodInlineQtyButton}
                                  onPress={() => adjustFoodAmountInSlot(slot.id, food.id, 1)}
                                >
                                  <Icon name="plus" size={14} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ))
                      )}
                      {!isViewerMode ? (
                        <TouchableOpacity style={styles.addFoodButton} onPress={() => openFoodModalForSlot(slot.id)}>
                          <Text style={styles.addFoodButtonText}>+ Besin Ekle</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })
          )}

        </ScrollView>

        {!isViewerMode ? (
          <TouchableOpacity style={styles.fabSaveButton} onPress={openSaveModal}>
            <Icon name="content-save-outline" size={20} color="#fff" />
            <Text style={styles.fabSaveText}>Kaydet</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={mealModalVisible} transparent animationType="fade" onRequestClose={() => setMealModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ogun Sec</Text>
            <Text style={styles.modalSubtitle}>Hangi ogun icin saat belirlemek istiyorsun?</Text>
            <View style={styles.modalChipRow}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.modalChip, mealTypeDraft === type.key && styles.modalChipActive]}
                  onPress={() => setMealTypeDraft(type.key)}
                >
                  <Text style={[styles.modalChipText, mealTypeDraft === type.key && styles.modalChipTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Saat (HH:MM)"
              value={mealTimeDraft}
              editable={false}
            />
            <TouchableOpacity style={styles.pickTimeButton} onPress={() => setTimePickerVisible(true)}>
              <Icon name="clock-outline" size={16} color="#1E4B36" />
              <Text style={styles.pickTimeButtonText}>Saat Sec</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setMealModalVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleAddMealSlot}>
                <Text style={styles.modalPrimaryText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {timePickerVisible ? (
        <DateTimePicker
          value={toTimeValue(mealTimeDraft)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimePickerChange}
        />
      ) : null}

      <Modal visible={foodModalVisible} transparent animationType="slide" onRequestClose={() => setFoodModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setFoodModalVisible(false)} />
          <View style={styles.bottomSheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.modalTitle}>Besin Ekle</Text>
              <TouchableOpacity onPress={() => setFoodModalVisible(false)} style={styles.sheetCloseButton}>
                <Icon name="close" size={20} color="#1E4B36" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputShell}>
              <Icon name="magnify" size={20} color="#6b7280" style={styles.searchInputIcon} />
              <TextInput
                style={styles.searchInputField}
                placeholder="Besin veya marka ara..."
                value={foodSearchQuery}
                onChangeText={setFoodSearchQuery}
                onSubmitEditing={handleSearchFood}
                returnKeyType="search"
              />
            </View>
            <ScrollView
              style={styles.searchResults}
              contentContainerStyle={styles.searchResultsContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {foodResults.length === 0 ? (
                <View style={styles.foodResultsEmptyWrap}>
                  <Text style={styles.foodResultsEmptyText}>
                    {t('mealPlan.emptySearchHint')}
                  </Text>
                </View>
              ) : null}
              {foodResults.map(food => {
                const currentQuantity = getFoodQuantityForSlot(food);
                const servingDisplay = currentQuantity > 0
                  ? formatFoodServingWithMultiplier(food, currentQuantity)
                  : (food.serving || '-');

                return (
                  <View key={food.id} style={styles.foodResultItem}>
                    <View style={styles.foodResultTextWrap}>
                      <Text style={styles.foodResultName}>{food.name}</Text>
                      <Text style={styles.foodResultMeta}>{servingDisplay} | {food.calories || 0} kcal</Text>
                      <View style={styles.foodTagRow}>
                        {food.isTrusted ? (
                          <View style={styles.foodSafeBadge}>
                            <Text style={styles.foodSafeBadgeText}>GUVENLI</Text>
                            <Icon name="check-decagram" size={11} color="#2D5A27" style={styles.foodSafeBadgeIcon} />
                          </View>
                        ) : null}
                        {getFoodDiseaseSignals(food, userDiseases).map(signal => (
                          <Text
                            key={`${food.id}-${signal.label}`}
                            style={[styles.foodSignalBadge, signal.type === 'ok' ? styles.foodSignalBadgeOk : styles.foodSignalBadgeWarn]}
                          >
                            {signal.label}
                          </Text>
                        ))}
                      </View>
                    </View>

                    {currentQuantity > 0 ? (
                      <View style={styles.foodQtyControl}>
                        <TouchableOpacity
                          style={styles.foodQtyButton}
                          onPress={() => setFoodQuantityForSlot(food, currentQuantity - 1)}
                        >
                          <Icon name="minus" size={16} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.foodQtyText}>{currentQuantity}</Text>
                        <TouchableOpacity
                          style={styles.foodQtyButton}
                          onPress={() => setFoodQuantityForSlot(food, currentQuantity + 1)}
                        >
                          <Icon name="plus" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.foodAddInlineButton} onPress={() => setFoodQuantityForSlot(food, 1)}>
                        <Icon name="plus" size={21} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Plani Kaydet</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Plan ismi"
              value={planTitleDraft}
              onChangeText={setPlanTitleDraft}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSavePlan} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{saving ? 'Kaydediliyor...' : activePlanId ? 'Guncelle' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F5' },
  listSafeOverGradient: { backgroundColor: 'transparent' },
  listGradientRoot: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9F5' },
  wrapper: { flex: 1 },
  headerList: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  listSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  listSearchIcon: { marginRight: 8 },
  listSearchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  listSearchEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  listSearchEmptyTitle: {
    marginTop: 12,
    color: '#174634',
    fontSize: 16,
    fontWeight: '800',
  },
  listSearchEmptyDesc: {
    marginTop: 6,
    color: '#5D7267',
    fontSize: 13,
    textAlign: 'center',
  },
  listTitle: { fontSize: 28, fontWeight: '800', color: '#1E4B36' },
  listSubtitle: { color: '#4F5F4D', marginTop: 2, marginBottom: 10, paddingHorizontal: 16 },
  limitInfoRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  limitInfoCard: {
    flex: 1,
    backgroundColor: '#EAF4EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7DDD0',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  limitInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitInfoTitle: {
    marginLeft: 6,
    color: '#3F5E4E',
    fontSize: 12,
    fontWeight: '700',
  },
  limitInfoValue: {
    marginTop: 6,
    color: '#174634',
    fontSize: 20,
    fontWeight: '800',
  },
  listContainer: { paddingHorizontal: 16, paddingBottom: 128 },
  container: { paddingHorizontal: 16, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  backButton: { padding: 6, marginRight: 6 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2D5A27' },
  subtitle: { color: '#4F5F4D', marginBottom: 14, marginTop: 2 },
  daysRow: { marginBottom: 14 },
  dayCard: {
    width: 98,
    height: 92,
    borderRadius: 18,
    backgroundColor: '#EEF4EF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCardActive: {
    backgroundColor: '#1E4B36',
  },
  dayLabel: { color: '#476351', fontWeight: '800', fontSize: 22, textAlign: 'center' },
  dayLabelActive: { color: '#DCECE0' },
  macroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  macroTitle: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  macroValue: { color: '#1E4B36', fontSize: 29, fontWeight: '800', marginTop: 2 },
  calorieProgressRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieProgressDetail: { color: '#55606f', fontSize: 11, fontWeight: '600' },
  calorieProgressPercent: { color: '#1E4B36', fontSize: 11, fontWeight: '800' },
  calorieProgressTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DFE7E3',
    overflow: 'hidden',
  },
  calorieProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1E4B36',
  },
  addMealButton: {
    backgroundColor: '#DCE7E1',
    borderWidth: 1,
    borderColor: '#B9D0C2',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: 12,
  },
  addMealButtonText: { color: '#1E4B36', fontWeight: '800', marginLeft: 8, fontSize: 14 },
  emptyDayCard: {
    backgroundColor: '#EEF4EF',
    borderWidth: 1,
    borderColor: '#C8DAD0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  emptyDayText: { color: '#7B8E81', fontSize: 12 },
  mealSection: {
    marginBottom: 14,
    backgroundColor: '#1E4B36',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E4B36',
    padding: 10,
    shadowColor: '#1E4B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  mealSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mealSectionTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  mealSectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 6 },
  mealTimeDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  mealTimeInlineText: { color: '#E6F2EB', fontSize: 12, fontWeight: '700' },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  mealCaloriesText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', opacity: 0.95 },
  removeMealIconButton: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotCard: {
    backgroundColor: '#D4E5DA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A9C3B2',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  emptySlotText: { color: '#35523D', fontSize: 12 },
  slotCard: {
    backgroundColor: '#DCEBE1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A4BFAE',
    padding: 12,
    marginBottom: 8,
  },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  foodInlineQtyControl: {
    minWidth: 92,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E4B36',
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  foodInlineQtyButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodInlineQtyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
  foodInlineQtyReadonly: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E4B36',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  foodInlineQtyReadonlyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  foodName: { color: '#183A2A', fontSize: 13, fontWeight: '600' },
  foodMeta: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  addFoodButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#98B7A4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#CFE2D5',
  },
  addFoodButtonText: { color: '#3D5C4B', fontWeight: '700', fontSize: 12 },
  savedPlansCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginTop: 6 },
  savedPlansTitle: { color: '#1E4B36', fontWeight: '700', marginBottom: 8 },
  savedPlansEmpty: { color: '#6b7280', fontSize: 12 },
  savedPlanItem: {
    backgroundColor: '#E6F1EA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C1D8CB',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    position: 'relative',
  },
  savedPlanMenuButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCEBE1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B7D1C3',
    zIndex: 2,
  },
  savedPlanWarningButton: {
    position: 'absolute',
    top: 10,
    right: 46,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FAEDC8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C98A08',
    zIndex: 2,
  },
  planListMenuRoot: {
    flex: 1,
  },
  planListMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 35, 28, 0.22)',
  },
  planListMenuCard: {
    position: 'absolute',
    backgroundColor: '#F9FBFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C1D8CB',
    overflow: 'hidden',
    shadowColor: '#0F2A1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  planListMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  planListMenuRowText: { color: '#174634', fontSize: 13, fontWeight: '600' },
  planListMenuRowTextDestructive: { color: '#8A1F1F', fontSize: 13, fontWeight: '600' },
  planListMenuRowTextMuted: { color: '#6A7A71' },
  planListMenuRowDisabled: { opacity: 0.55 },
  planListMenuRowDeletePressed: { backgroundColor: 'rgba(138, 31, 31, 0.08)' },
  planListMenuDivider: {
    backgroundColor: 'rgba(30, 75, 54, 0.12)',
    width: '100%',
  },
  savedPlanName: { color: '#174634', fontWeight: '800', fontSize: 18 },
  savedPlanNameInList: { paddingRight: 44 },
  savedPlanNameWithWarning: { paddingRight: 78 },
  planWarningBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  planWarningModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5D6B6',
    zIndex: 2,
  },
  planWarningModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  planWarningModalTitle: {
    color: '#7A5A1A',
    fontWeight: '800',
    fontSize: 18,
  },
  planWarningModalPlanName: {
    color: '#174634',
    fontWeight: '700',
    marginBottom: 10,
  },
  planWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  planWarningText: {
    flex: 1,
    color: '#5E5A4A',
    fontSize: 13,
    lineHeight: 18,
  },
  planWarningModalCloseButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#B8791B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  planWarningModalCloseText: {
    color: '#fff',
    fontWeight: '800',
  },
  savedPlanMeta: { color: '#385B49', fontSize: 14, marginTop: 4, fontWeight: '600' },
  savedPlanWeekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginTop: 10,
    paddingHorizontal: 0,
    gap: 10,
  },
  savedPlanDayDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFD3C8',
    backgroundColor: '#EEF4EF',
  },
  savedPlanDayDotActive: {
    backgroundColor: '#024D35',
    borderColor: '#024D35',
  },
  savedPlanDayDotText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5D7267',
  },
  savedPlanDayDotTextActive: {
    color: '#FFFFFF',
  },
  savedPlanGaugesRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedPlanGaugeItem: {
    flex: 1,
    alignItems: 'center',
  },
  savedPlanGaugeArcWrap: {
    width: 122,
    height: 92,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  savedPlanGaugeArcSvg: {
    position: 'absolute',
    top: 0,
  },
  savedPlanGaugeCenter: {
    position: 'absolute',
    bottom: 12,
    alignItems: 'center',
  },
  savedPlanGaugeValue: {
    color: '#184734',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  savedPlanGaugeUnit: {
    color: '#496555',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  savedPlanGaugeTitle: {
    marginTop: 3,
    color: '#2F5C48',
    fontSize: 12,
    fontWeight: '700',
  },
  savedPlanTapHint: { color: '#5D7267', fontSize: 12, marginTop: 5 },
  emptyStateCard: {
    backgroundColor: '#EEF4EF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  emptyStateTitle: { marginTop: 8, color: '#1E4B36', fontSize: 18, fontWeight: '800' },
  emptyStateDesc: { marginTop: 4, color: '#5F7468', fontSize: 13 },
  listFabPlusButton: {
    position: 'absolute',
    right: 18,
    bottom: 34,
    backgroundColor: '#1E4B36',
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuWrap: {
    position: 'absolute',
    right: 18,
    bottom: 98,
    alignItems: 'flex-end',
    gap: 10,
  },
  fabActionButton: {
    minWidth: 176,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E4B36',
    borderWidth: 1,
    borderColor: '#1A3F2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  fabActionButtonDisabled: {
    backgroundColor: '#E4EBE7',
    borderColor: '#CFDAD3',
  },
  fabActionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  fabActionTextDisabled: {
    color: '#6A7A71',
  },
  fabSaveButton: {
    position: 'absolute',
    right: 18,
    bottom: 30,
    backgroundColor: '#1E4B36',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabSaveText: { color: '#fff', fontWeight: '800', marginLeft: 7 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 25, 21, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  modalCardLarge: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 25, 21, 0.28)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    height: '65%',
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D4DDD8',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4EF',
  },
  modalTitle: { color: '#1E4B36', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  modalSubtitle: { color: '#6b7280', fontSize: 12, marginBottom: 8 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  modalChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7DCCC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  modalChipActive: { backgroundColor: '#EAF4ED', borderColor: '#1E4B36' },
  modalChipText: { color: '#476351', fontWeight: '700', fontSize: 12 },
  modalChipTextActive: { color: '#1E4B36' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d3dfd4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#111827',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  pickTimeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7DCCC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    backgroundColor: '#F6FBF8',
  },
  pickTimeButtonText: {
    color: '#1E4B36',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalCancelBtn: { paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  modalCancelText: { color: '#6b7280', fontWeight: '700' },
  modalPrimaryBtn: { backgroundColor: '#1E4B36', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  modalPrimaryText: { color: '#fff', fontWeight: '800' },
  searchInputShell: {
    marginBottom: 8,
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d4dfd4',
    borderRadius: 12,
    backgroundColor: '#E2EAE7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInputIcon: { marginRight: 6 },
  searchInputField: { flex: 1, fontSize: 18, color: '#6C7280', paddingVertical: 12 },
  searchResults: { flex: 1, marginTop: 10, marginBottom: 4 },
  searchResultsContent: { paddingBottom: 8, flexGrow: 1 },
  foodResultsEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  foodResultsEmptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
  },
  foodResultItem: {
    borderWidth: 1,
    borderColor: '#F5FBF8',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F5FBF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f2a1f',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  foodResultTextWrap: { flex: 1, marginRight: 10 },
  foodResultName: { color: '#1E4B36', fontWeight: '700', fontSize: 17 },
  foodResultMeta: { color: '#424844', fontSize: 15, marginTop: 3 },
  foodTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  foodSafeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4ED',
    borderColor: '#BBD8C2',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  foodSafeBadgeText: { color: '#2D5A27', fontSize: 10, fontWeight: '800' },
  foodSafeBadgeIcon: { marginLeft: 3 },
  foodSignalBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  foodSignalBadgeOk: {
    backgroundColor: 'rgba(74, 163, 112, 0.14)',
    color: '#1E6A45',
    borderColor: 'rgba(74, 163, 112, 0.35)',
  },
  foodSignalBadgeWarn: {
    backgroundColor: 'rgba(255, 179, 71, 0.16)',
    color: '#8A5A13',
    borderColor: 'rgba(255, 179, 71, 0.45)',
  },
  foodAddInlineButton: {
    backgroundColor: '#1E4B36',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodQtyControl: {
    minWidth: 118,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E4B36',
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodQtyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodQtyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
});

export default MealPlanScreen;
