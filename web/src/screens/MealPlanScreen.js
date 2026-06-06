import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/api';
import { mealPlanService } from '../services/mealPlanService';
import { nutritionService } from '../services/nutritionService';

const DAY_OPTIONS = [
  { key: 'monday', label: 'Pzt' },
  { key: 'tuesday', label: 'Sal' },
  { key: 'wednesday', label: 'Car' },
  { key: 'thursday', label: 'Per' },
  { key: 'friday', label: 'Cum' },
  { key: 'saturday', label: 'Cmt' },
  { key: 'sunday', label: 'Paz' },
];

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Kahvalti' },
  { key: 'lunch', label: 'Ogle Yemegi' },
  { key: 'dinner', label: 'Aksam Yemegi' },
  { key: 'snack', label: 'Ara Ogun' },
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
            nutrientsSnapshot: meal.nutrientsSnapshot || { calories: 0, protein: 0, carbs: 0 },
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
    acc[dayKey] = { meals: normalizeDaySlots(days?.[dayKey]) };
    return acc;
  }, emptyWeek);
};

const countFoods = days =>
  mealPlanService.getDayKeys().reduce((total, dayKey) => {
    const slots = days?.[dayKey]?.meals || [];
    return total + slots.reduce((slotTotal, slot) => slotTotal + (slot.foods?.length || 0), 0);
  }, 0);

const countMeals = days =>
  mealPlanService.getDayKeys().reduce((total, dayKey) => total + (days?.[dayKey]?.meals?.length || 0), 0);

const toNutrientSnapshot = food => ({
  calories: Number(food?.calories || 0),
  protein: Number(food?.protein || 0),
  carbs: Number(food?.carbs || 0),
});

const timeToMinutes = value => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
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
  if (p <= stops[0].point) return stops[0].color;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const start = stops[i];
    const end = stops[i + 1];
    if (p <= end.point) {
      const t = (p - start.point) / Math.max(1, end.point - start.point);
      return mixColors(start.color, end.color, t);
    }
  }
  return stops[stops.length - 1].color;
};

const getCalorieProgressColors = (rawPercent, hasTarget) => {
  if (!hasTarget) return { textColor: '#1E4B36', gradient: ['#2B6A4B', '#1E4B36'] };
  if (rawPercent > 100) {
    const overRatio = clamp((rawPercent - 100) / 80, 0, 1);
    const overColor = mixColors('#1E4B36', '#DC2626', overRatio);
    return {
      textColor: overColor,
      gradient: [mixColors(overColor, '#FFFFFF', 0.18), overColor],
    };
  }
  const stops = [
    { point: 0, color: '#F3A54A' },
    { point: 20, color: '#D7A86A' },
    { point: 35, color: '#82B4D8' },
    { point: 50, color: '#4B96D1' },
    { point: 70, color: '#4FAF95' },
    { point: 90, color: '#2E7C57' },
    { point: 100, color: '#1E4B36' },
  ];
  const base = getColorFromStops(stops, rawPercent);
  return {
    textColor: base,
    gradient: [mixColors(base, '#FFFFFF', 0.22), mixColors(base, '#0E2B21', 0.08)],
  };
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

const getFoodRefKey = food => {
  const fallback = `${String(food?.source || 'manual')}:${String(food?.name || '').trim().toLowerCase()}`;
  return String(food?.submissionId || food?.fdcId || fallback);
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

function MealPlanScreen() {
  const { t } = useTranslation();
  const currentUser = authService.getCurrentUser();
  const userId = currentUser?.id || currentUser?._id || currentUser?.uid || '';

  const [screenMode, setScreenMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingFood, setSearchingFood] = useState(false);
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState('');
  const [activeDay, setActiveDay] = useState('monday');
  const [planDraft, setPlanDraft] = useState(createDefaultPlanDraft);

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealTypeDraft, setMealTypeDraft] = useState('breakfast');
  const [mealTimeDraft, setMealTimeDraft] = useState('08:00');

  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [foodTargetSlotId, setFoodTargetSlotId] = useState('');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState([]);

  const [analysisByPlanId, setAnalysisByPlanId] = useState({});
  const [info, setInfo] = useState('');

  const userDiseases = useMemo(() => (Array.isArray(currentUser?.diseases) ? currentUser.diseases : []), [currentUser?.diseases]);

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
    const target = Math.max(0, Number(currentUser?.dailyCalories) || 0);
    const rawPercent = target <= 0 ? 100 : (consumed / target) * 100;
    const fillPercent = target <= 0 ? 100 : Math.min(100, rawPercent);
    const colors = getCalorieProgressColors(rawPercent, target > 0);
    return {
      consumed,
      target,
      rawPercent,
      fillPercent,
      textColor: colors.textColor,
      gradient: colors.gradient,
      percentText: `${Math.round(target <= 0 ? 100 : rawPercent)}%`,
      detailText: target > 0 ? `${consumed} / ${Math.round(target)} kcal` : `${consumed} kcal / Hedef belirtilmedi`,
    };
  }, [dayMacros.calories, currentUser?.dailyCalories]);

  const totalFoods = useMemo(() => countFoods(planDraft.days), [planDraft.days]);

  const getSlotsByType = mealType =>
    selectedDaySlots
      .filter(slot => slot.mealType === mealType)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

  const getMealTypeEarliestTime = mealType => {
    const slots = getSlotsByType(mealType);
    return slots.reduce((min, slot) => Math.min(min, timeToMinutes(slot.time)), Number.POSITIVE_INFINITY);
  };

  const sortedMealTypesForDay = useMemo(
    () =>
      MEAL_TYPES
        .filter(type => getSlotsByType(type.key).length > 0)
        .sort((a, b) => {
          const aTime = getMealTypeEarliestTime(a.key);
          const bTime = getMealTypeEarliestTime(b.key);
          if (aTime !== bTime) return aTime - bTime;
          return a.label.localeCompare(b.label, 'tr');
        }),
    [selectedDaySlots]
  );

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
      setInfo(error.message || 'Planlar yuklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [userId]);

  const resetDraft = () => {
    setActivePlanId('');
    setPlanDraft(createDefaultPlanDraft());
    setFoodSearchQuery('');
    setFoodResults([]);
    setActiveDay('monday');
  };

  const openCreatePlanEditor = () => {
    resetDraft();
    setScreenMode('editor');
    setInfo('');
  };

  const selectExistingPlan = plan => {
    setActivePlanId(plan.id);
    setPlanDraft({
      title: plan.title || '',
      weekStartDate: plan.weekStartDate || new Date().toISOString().slice(0, 10),
      days: normalizeDaysForEditor(plan.days),
    });
    setActiveDay('monday');
    setScreenMode('editor');
    setInfo('');
  };

  const handleAddMealSlot = () => {
    if (!mealTimeDraft.trim()) {
      setInfo('Ogun saati zorunlu.');
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
    setMealModalOpen(false);
  };

  const openFoodModalForSlot = slotId => {
    setFoodTargetSlotId(slotId);
    setFoodSearchQuery('');
    setFoodResults([]);
    setFoodModalOpen(true);
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
      setFoodResults(Array.isArray(rows) ? rows.slice(0, 12) : []);
    } catch (error) {
      setInfo(error.message || 'Besin arama basarisiz oldu.');
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
              nutrientsSnapshot: toNutrientSnapshot(food),
            });
          }
        }
        return { ...slot, foods: nextFoods };
      });
      return { ...prev, days: { ...prev.days, [activeDay]: { meals: nextSlots } } };
    });
  };

  const adjustFoodAmountInSlot = (slotId, foodId, delta) => {
    const step = Number(delta) || 0;
    if (!step) return;
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
      return { ...prev, days: { ...prev.days, [activeDay]: { meals: nextSlots } } };
    });
  };

  const removeMealTypeSlots = mealType => {
    if (!window.confirm('Bu ogune ait tum saatleri silmek istiyor musun?')) return;
    setPlanDraft(prev => {
      const currentSlots = normalizeDaySlots(prev.days?.[activeDay]);
      const nextSlots = currentSlots.filter(slot => slot.mealType !== mealType);
      return { ...prev, days: { ...prev.days, [activeDay]: { meals: nextSlots } } };
    });
  };

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
    const times = [...new Set(getSlotsByType(mealType).map(slot => String(slot.time || '').trim()).filter(Boolean))];
    if (times.length === 0) return '--:--';
    return times.join(' • ');
  };

  const handleSavePlan = async () => {
    const totalMeals = countMeals(planDraft.days);
    if (!String(planDraft.title || '').trim()) {
      setInfo('Plan basligi zorunludur.');
      return;
    }
    if (totalMeals === 0) {
      setInfo('Plan en az bir ogun icermelidir.');
      return;
    }
    setSaving(true);
    setInfo('');
    try {
      if (activePlanId) {
        await mealPlanService.updatePlan({
          planId: activePlanId,
          title: planDraft.title.trim(),
          weekStartDate: planDraft.weekStartDate,
          days: planDraft.days,
        });
      } else {
        await mealPlanService.createPlan({
          userId,
          title: planDraft.title.trim(),
          weekStartDate: planDraft.weekStartDate,
          days: planDraft.days,
        });
      }
      await loadPlans();
      resetDraft();
      setScreenMode('list');
    } catch (error) {
      setInfo(error.message || 'Plan kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async planId => {
    if (!window.confirm('Bu plani silmek istiyor musun?')) return;
    try {
      await mealPlanService.deletePlan(planId);
      await loadPlans();
      if (activePlanId === planId) resetDraft();
    } catch (error) {
      setInfo(error.message || 'Plan silinemedi.');
    }
  };

  const handleAnalyzePlan = async plan => {
    try {
      const result = await mealPlanService.analyzePlan({
        planId: plan.id,
        dailyCalories: Number(currentUser?.dailyCalories || 2000),
        userId,
      });
      setAnalysisByPlanId(prev => ({ ...prev, [plan.id]: result.analysis || 'Analiz bulunamadi.' }));
    } catch (error) {
      setInfo(error.message || 'AI analizi basarisiz oldu.');
    }
  };

  if (screenMode === 'list') {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, color: '#1E4B36' }}>
          Beslenme Planlarim
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Kayitli planlarini goruntule veya yeni plan olustur.
        </Typography>

        {info ? <Alert severity="warning" sx={{ mb: 2 }}>{info}</Alert> : null}

        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={30} />
          </Box>
        ) : plans.length === 0 ? (
          <Paper
            onClick={openCreatePlanEditor}
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 3,
              border: '1px dashed #9eb7a7',
              cursor: 'pointer',
              backgroundColor: '#f6faf7',
            }}
          >
            <Typography sx={{ fontWeight: 700, color: '#1E4B36' }}>Henuz planiniz yok</Typography>
            <Typography variant="body2" sx={{ color: '#66726d', mt: 0.5 }}>
              Olusturmak icin tiklayiniz.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {plans.map(plan => (
              <Grid item xs={12} md={6} lg={4} key={plan.id}>
                <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #d8e3dc', backgroundColor: '#fff' }}>
                  <Typography sx={{ fontWeight: 800, color: '#1E4B36' }}>{plan.title}</Typography>
                  <Typography variant="caption" sx={{ color: '#63706b' }}>
                    Hafta: {plan.weekStartDate || '-'} | Ogun: {countMeals(plan.days)}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => selectExistingPlan(plan)}>
                      Duzenle
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => handleDeletePlan(plan.id)}>
                      Sil
                    </Button>
                  </Stack>
                  <Button size="small" startIcon={<AutoAwesomeOutlinedIcon />} sx={{ mt: 0.4 }} onClick={() => handleAnalyzePlan(plan)}>
                    AI Analiz
                  </Button>
                  {analysisByPlanId[plan.id] ? (
                    <Paper variant="outlined" sx={{ mt: 1, p: 1, backgroundColor: '#f8faf8' }}>
                      <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>
                        {analysisByPlanId[plan.id]}
                      </Typography>
                    </Paper>
                  ) : null}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreatePlanEditor}
          sx={{ mt: 3, borderRadius: 99, px: 2.5, backgroundColor: '#1E4B36' }}
        >
          Plan Ekle
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton onClick={() => setScreenMode('list')} size="small">
          <ArrowBackOutlinedIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E4B36' }}>
          {t('mealPlan.title')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('mealPlan.subtitle')}
      </Typography>

      {info ? <Alert severity="warning" sx={{ mb: 2 }}>{info}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
          <Card sx={{ borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Plan Basligi"
                    value={planDraft.title}
                    onChange={event => setPlanDraft(prev => ({ ...prev, title: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Hafta Baslangici"
                    InputLabelProps={{ shrink: true }}
                    value={planDraft.weekStartDate}
                    onChange={event => setPlanDraft(prev => ({ ...prev, weekStartDate: event.target.value }))}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {DAY_OPTIONS.map(day => (
                  <Chip
                    key={day.key}
                    label={day.label}
                    onClick={() => setActiveDay(day.key)}
                    sx={{
                      mb: 1,
                      borderRadius: 2,
                      bgcolor: activeDay === day.key ? '#1E4B36' : '#EEF4EF',
                      color: activeDay === day.key ? '#fff' : '#1E4B36',
                      fontWeight: 700,
                    }}
                  />
                ))}
              </Stack>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fff' }}>
                    <Typography sx={{ color: '#6b7280', fontSize: 13, fontWeight: 700 }}>Toplam Kalori</Typography>
                    <Typography sx={{ color: '#1E4B36', fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>
                      {Math.round(dayMacros.calories)} kcal
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography sx={{ color: '#55606f', fontSize: 12 }}>{calorieProgress.detailText}</Typography>
                      <Typography sx={{ color: calorieProgress.textColor, fontSize: 12, fontWeight: 800 }}>
                        {calorieProgress.percentText}
                      </Typography>
                    </Stack>
                    <Box sx={{ mt: 0.8, height: 8, borderRadius: 99, bgcolor: '#DFE7E3', overflow: 'hidden' }}>
                      <Box
                        sx={{
                          height: '100%',
                          width: `${calorieProgress.fillPercent}%`,
                          borderRadius: 99,
                          background: `linear-gradient(90deg, ${calorieProgress.gradient[0]} 0%, ${calorieProgress.gradient[1]} 100%)`,
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fff' }}>
                    <Typography sx={{ color: '#6b7280', fontSize: 13, fontWeight: 700 }}>Protein</Typography>
                    <Typography sx={{ color: '#1E4B36', fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>
                      {Math.round(dayMacros.protein)} g
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fff' }}>
                    <Typography sx={{ color: '#6b7280', fontSize: 13, fontWeight: 700 }}>Karbonhidrat</Typography>
                    <Typography sx={{ color: '#1E4B36', fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>
                      {Math.round(dayMacros.carbs)} g
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Button
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() => {
                  setMealTypeDraft('breakfast');
                  setMealTimeDraft('08:00');
                  setMealModalOpen(true);
                }}
                sx={{
                  mb: 1.8,
                  borderColor: '#B9D0C2',
                  bgcolor: '#DCE7E1',
                  color: '#1E4B36',
                  fontWeight: 800,
                  '&:hover': { borderColor: '#9db9aa', bgcolor: '#d2e2d9' },
                }}
              >
                Ogun Ekle
              </Button>

              {selectedDaySlots.length === 0 ? (
                <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#EEF4EF', border: '1px solid #C8DAD0' }}>
                  <Typography sx={{ color: '#7B8E81', fontSize: 13 }}>
                    Henuz ogun eklenmedi. Baslamak icin "Ogun Ekle"ye tiklayin.
                  </Typography>
                </Paper>
              ) : (
                sortedMealTypesForDay.map(type => {
                  const slots = getSlotsByType(type.key);
                  return (
                    <Paper
                      key={type.key}
                      sx={{
                        mb: 1.6,
                        p: 1.2,
                        borderRadius: 3,
                        bgcolor: '#1E4B36',
                        border: '1px solid #1E4B36',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ color: '#fff', fontWeight: 800 }}>{type.label}</Typography>
                          <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255,255,255,0.5)' }} />
                          <Typography sx={{ color: '#E6F2EB', fontSize: 12, fontWeight: 700 }}>
                            {getMealTypeTimesLabel(type.key)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.8}>
                          <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
                            {getMealTypeCalories(type.key)} kcal
                          </Typography>
                          <IconButton
                            onClick={() => removeMealTypeSlots(type.key)}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.24)' } }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      {slots.map(slot => (
                        <Paper
                          key={slot.id}
                          sx={{ p: 1.5, mb: 1, borderRadius: 2.5, bgcolor: '#DCEBE1', border: '1px solid #A4BFAE' }}
                        >
                          {(slot.foods || []).length === 0 ? (
                            <Typography sx={{ color: '#35523D', fontSize: 13 }}>Besin eklenmedi.</Typography>
                          ) : (
                            <Stack spacing={0.9}>
                              {(slot.foods || []).map(food => (
                                <Stack key={food.id} direction="row" justifyContent="space-between" alignItems="center">
                                  <Box>
                                    <Typography sx={{ color: '#183A2A', fontWeight: 700, fontSize: 24 }}>{food.name}</Typography>
                                    <Typography sx={{ color: '#6b7280', fontSize: 13 }}>
                                      {formatDisplayAmount(
                                        (Number(food.servingAmount) > 0 ? Number(food.servingAmount) : 1) *
                                        (Number(food.servingBaseAmount) > 0
                                          ? Number(food.servingBaseAmount)
                                          : (String(food.servingUnit || '').toLowerCase() === 'g' || String(food.servingUnit || '').toLowerCase() === 'ml')
                                            ? 100
                                            : 1)
                                      )}{' '}
                                      {food.servingUnit} - {Math.round((food.nutrientsSnapshot?.calories || 0) * (Number(food.servingAmount) || 1))} kcal
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: '#1E4B36', borderRadius: 99, p: 0.5 }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => adjustFoodAmountInSlot(slot.id, food.id, -1)}
                                      sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff' }}
                                    >
                                      <RemoveOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <Typography sx={{ color: '#fff', fontWeight: 800, minWidth: 18, textAlign: 'center' }}>
                                      {Number(food.servingAmount) || 1}
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      onClick={() => adjustFoodAmountInSlot(slot.id, food.id, 1)}
                                      sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff' }}
                                    >
                                      <AddOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                </Stack>
                              ))}
                            </Stack>
                          )}

                          <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => openFoodModalForSlot(slot.id)}
                            sx={{
                              mt: 1.1,
                              borderColor: '#8eb7a1',
                              color: '#355f4a',
                              fontWeight: 800,
                              bgcolor: '#d0e3d8',
                            }}
                          >
                            + Besin Ekle
                          </Button>
                        </Paper>
                      ))}
                    </Paper>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#fff', position: 'sticky', top: 20 }}>
            <Typography sx={{ color: '#1E4B36', fontWeight: 800, mb: 0.4 }}>
              Plan Durumu
            </Typography>
            <Typography sx={{ color: '#6b7280', fontSize: 13 }}>
              Taslaktaki toplam besin: {totalFoods}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSavePlan}
              disabled={saving}
              sx={{ mt: 1.5, borderRadius: 2, bgcolor: '#1E4B36', fontWeight: 800 }}
            >
              {saving ? 'Kaydediliyor...' : activePlanId ? 'Plani Guncelle' : 'Plani Kaydet'}
            </Button>
            <Button fullWidth variant="text" onClick={resetDraft} sx={{ mt: 0.6 }}>
              Taslagi Sifirla
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={mealModalOpen} onClose={() => setMealModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ogun Sec</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
            Hangi ogun ve saat icin slot olusturmak istiyorsun?
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
            {MEAL_TYPES.map(type => (
              <Chip
                key={type.key}
                label={type.label}
                onClick={() => setMealTypeDraft(type.key)}
                sx={{
                  mb: 1,
                  bgcolor: mealTypeDraft === type.key ? '#EAF4ED' : '#fff',
                  border: '1px solid',
                  borderColor: mealTypeDraft === type.key ? '#1E4B36' : '#C7DCCC',
                }}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            label="Saat"
            type="time"
            InputLabelProps={{ shrink: true }}
            value={mealTimeDraft}
            onChange={event => setMealTimeDraft(event.target.value)}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setMealModalOpen(false)}>Vazgec</Button>
            <Button variant="contained" onClick={handleAddMealSlot} sx={{ bgcolor: '#1E4B36' }}>
              Ekle
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={foodModalOpen} onClose={() => setFoodModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Besin Ekle
          <IconButton onClick={() => setFoodModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Besin veya marka ara..."
            value={foodSearchQuery}
            onChange={event => setFoodSearchQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSearchFood();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ color: '#6b7280' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1.5 }}
          />

          <Box sx={{ maxHeight: 460, overflowY: 'auto', pr: 0.5 }}>
            {foodResults.length === 0 ? (
              <Typography sx={{ textAlign: 'center', py: 8, color: '#6b7280' }}>
                {t('mealPlan.emptySearchHint')}
              </Typography>
            ) : null}

            {foodResults.map(food => {
              const currentQuantity = getFoodQuantityForSlot(food);
              const servingDisplay = currentQuantity > 0 ? formatFoodServingWithMultiplier(food, currentQuantity) : (food.serving || '-');
              return (
                <Paper
                  key={food.id}
                  sx={{
                    p: 1.3,
                    mb: 1,
                    borderRadius: 2,
                    bgcolor: '#F5FBF8',
                    border: '1px solid #F5FBF8',
                    boxShadow: '0 2px 8px rgba(15,42,31,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.2,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#1E4B36', fontWeight: 700, fontSize: 19 }}>
                      {food.name}
                    </Typography>
                    <Typography sx={{ color: '#424844', fontSize: 16 }}>
                      {servingDisplay} | {food.calories || 0} kcal
                    </Typography>
                    <Stack direction="row" spacing={0.6} sx={{ mt: 0.8, flexWrap: 'wrap' }}>
                      {food.isTrusted ? (
                        <Chip size="small" label="GUVENLI" sx={{ bgcolor: '#EAF4ED', border: '1px solid #BBD8C2', color: '#2D5A27' }} />
                      ) : null}
                      {getFoodDiseaseSignals(food, userDiseases).map(signal => (
                        <Chip
                          key={`${food.id}-${signal.label}`}
                          size="small"
                          label={signal.label}
                          sx={
                            signal.type === 'ok'
                              ? { bgcolor: 'rgba(74,163,112,0.14)', border: '1px solid rgba(74,163,112,0.35)', color: '#1E6A45' }
                              : { bgcolor: 'rgba(255,179,71,0.16)', border: '1px solid rgba(255,179,71,0.45)', color: '#8A5A13' }
                          }
                        />
                      ))}
                    </Stack>
                  </Box>

                  {currentQuantity > 0 ? (
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ bgcolor: '#1E4B36', borderRadius: 99, p: 0.4 }}>
                      <IconButton
                        size="small"
                        onClick={() => setFoodQuantityForSlot(food, currentQuantity - 1)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff' }}
                      >
                        <RemoveOutlinedIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ color: '#fff', fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                        {currentQuantity}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setFoodQuantityForSlot(food, currentQuantity + 1)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff' }}
                      >
                        <AddOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <IconButton
                      onClick={() => setFoodQuantityForSlot(food, 1)}
                      sx={{ width: 44, height: 44, borderRadius: 99, bgcolor: '#1E4B36', color: '#fff' }}
                    >
                      <AddOutlinedIcon />
                    </IconButton>
                  )}
                </Paper>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default MealPlanScreen;
