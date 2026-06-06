import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const GOAL_OPTIONS = [
  { key: 'lose', label: 'Kilo vermek' },
  { key: 'maintain', label: 'Kilo korumak' },
  { key: 'gain', label: 'Kilo almak' },
];

const MEAL_COUNT_OPTIONS = [
  { key: '2', label: '2 ogun' },
  { key: '3', label: '3 ogun' },
  { key: '4', label: '4 ogun' },
  { key: '5', label: '5+ ogun' },
];

const DIET_STYLE_OPTIONS = [
  { key: 'omnivore', label: 'Karisik' },
  { key: 'vegetarian', label: 'Vejetaryen' },
  { key: 'vegan', label: 'Vegan' },
];

const LACTOSE_OPTIONS = [
  { key: 'yes', label: 'Evet' },
  { key: 'no', label: 'Hayir' },
];

const SWEET_OPTIONS = [
  { key: 'yes', label: 'Evet' },
  { key: 'controlled', label: 'Kontrollu' },
  { key: 'no', label: 'Hayir' },
];

const NUTRITION_TYPE_OPTIONS = [
  { key: 'balanced', label: 'Dengeli' },
  { key: 'low_carb', label: 'Dusuk karb.' },
  { key: 'high_protein', label: 'Yuksek protein' },
];

const YES_NO_OPTIONS = [
  { key: 'yes', label: 'Evet' },
  { key: 'no', label: 'Hayir' },
];

const OptionRow = ({ title, value, options, onSelect, disabled }) => {
  const [rowWidth, setRowWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const activeIndex = Math.max(0, options.findIndex(opt => opt.key === value));
  const segmentWidth = rowWidth > 0 && options.length > 0 ? rowWidth / options.length : 0;

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.timing(translateX, {
      toValue: activeIndex * segmentWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, translateX]);

  return (
    <View style={styles.questionWrap}>
      <Text style={styles.questionTitle}>{title}</Text>
      <View
        style={styles.optionRow}
        onLayout={event => {
          const width = event?.nativeEvent?.layout?.width || 0;
          setRowWidth(width);
          if (width > 0 && options.length > 0) {
            const nextSegment = width / options.length;
            translateX.setValue(activeIndex * nextSegment);
          }
        }}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.optionActivePill,
              {
                width: segmentWidth,
                transform: [{ translateX }],
              },
            ]}
          />
        ) : null}
        {options.map((opt, idx) => {
          const active = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionChip, disabled && styles.optionChipDisabled]}
              onPress={() => onSelect(opt.key)}
              disabled={disabled}
              activeOpacity={0.85}
            >
              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.questionDivider} />
    </View>
  );
};

const MealPlanAiPromptScreen = ({ navigation, route }) => {
  const user = route?.params?.user || null;
  const canUseAiPlanner = Boolean(route?.params?.canUseAiPlanner);
  const lockedReason = route?.params?.lockedReason || 'Bu ozellik su an kullanilamiyor.';
  const [prompt, setPrompt] = useState('');
  const [goal, setGoal] = useState('lose');
  const [diseaseCompatible, setDiseaseCompatible] = useState('yes');
  const [mealCount, setMealCount] = useState('4');
  const [dietStyle, setDietStyle] = useState('omnivore');
  const [lactosePreference, setLactosePreference] = useState('no');
  const [sweetPreference, setSweetPreference] = useState('controlled');
  const [nutritionType, setNutritionType] = useState('balanced');
  const [snackPreference, setSnackPreference] = useState('yes');
  const [avoidFoods, setAvoidFoods] = useState('');

  const subtitle = useMemo(
    () =>
      canUseAiPlanner
        ? 'On sorulari sec, istersen not ekle. AI 1 haftalik taslak plan olustursun.'
        : lockedReason,
    [canUseAiPlanner, lockedReason]
  );

  const buildPrompt = () => {
    const goalText =
      goal === 'gain' ? 'Hedef: kilo almak.' : goal === 'maintain' ? 'Hedef: kiloyu korumak.' : 'Hedef: kilo vermek.';
    const diseaseText =
      diseaseCompatible === 'yes'
        ? 'KESIN KURAL: Hastalik ve alerji bilgilerime aykiri hicbir besin/plani dahil etme. Riskli urunler kesinlikle yer almasin.'
        : 'Hastalik ve alerji filtreleri zorunlu degil.';
    const mealText = `Gunluk ogun sayisi: ${mealCount}.`;
    const dietStyleText =
      dietStyle === 'vegan'
        ? 'Beslenme tercihi vegan olsun; hayvansal urun kullanma.'
        : dietStyle === 'vegetarian'
          ? 'Beslenme tercihi vejetaryen olsun; et ve balik kullanma.'
          : 'Beslenme tercihi karisik olabilir. Vegan ya da vejeteryan değilim.';
    const lactoseText =
      lactosePreference === 'yes'
        ? 'Laktoz intoleransi var; aşırı laktoz iceren urun kullanma ya da az olacak şekilde günlere yay.'
        : 'Laktoz intoleransi yok.';
    const sweetText =
      sweetPreference === 'yes'
        ? 'Tatli alternatifi de ekleyebilirsin.'
        : sweetPreference === 'controlled'
          ? 'Tatli secenekleri kontrollu ve dusuk sekerli olsun.'
          : 'Tatli secenegi ekleme.';
    const nutritionTypeText =
      nutritionType === 'low_carb'
        ? 'Beslenme turu: dusuk karbonhidrat.'
        : nutritionType === 'high_protein'
          ? 'Beslenme turu: yuksek protein.'
          : 'Beslenme turu: dengeli.';
    const snackText = snackPreference === 'yes' ? 'Ara ogunler yer alsin.' : 'Ara ogun olmasin.';
    const avoidFoodsText = String(avoidFoods || '').trim()
      ? `Kullanici şu besinleri istemiyor: ${String(avoidFoods || '').trim()}.`
      : '';
    const extraText = String(prompt || '').trim();

    return [
      goalText,
      diseaseText,
      mealText,
      dietStyleText,
      lactoseText,
      sweetText,
      nutritionTypeText,
      snackText,
      avoidFoodsText,
      extraText ? `Ek not: ${extraText}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const handleContinue = () => {
    if (!canUseAiPlanner) {
      Alert.alert('AI Plan Uret', lockedReason);
      return;
    }
    const normalized = buildPrompt();
    navigation.navigate('MainApp', {
      user,
      screen: 'MealPlan',
      params: {
        user,
        aiPromptFromBuilder: normalized,
        aiPromptNonce: Date.now(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#1E4B36" />
          </TouchableOpacity>
          <Text style={styles.title}>AI Plan Uret</Text>
        </View>
        <Text style={[styles.subtitle, !canUseAiPlanner && styles.subtitleLocked]}>{subtitle}</Text>

        <ScrollView contentContainerStyle={styles.content}>
          <OptionRow
            title="Diyet hedefin nedir?"
            value={goal}
            options={GOAL_OPTIONS}
            onSelect={setGoal}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Hastalik veya alerjine uygun olsun mu?"
            value={diseaseCompatible}
            options={YES_NO_OPTIONS}
            onSelect={setDiseaseCompatible}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Gunde kac ogun yer alsin?"
            value={mealCount}
            options={MEAL_COUNT_OPTIONS}
            onSelect={setMealCount}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Beslenme tercihin nedir?"
            value={dietStyle}
            options={DIET_STYLE_OPTIONS}
            onSelect={setDietStyle}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Laktoz intoleransiniz var mi?"
            value={lactosePreference}
            options={LACTOSE_OPTIONS}
            onSelect={setLactosePreference}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Tatli tercihi olsun mu?"
            value={sweetPreference}
            options={SWEET_OPTIONS}
            onSelect={setSweetPreference}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Beslenme turu nasil olsun?"
            value={nutritionType}
            options={NUTRITION_TYPE_OPTIONS}
            onSelect={setNutritionType}
            disabled={!canUseAiPlanner}
          />
          <OptionRow
            title="Ara ogun tercihi?"
            value={snackPreference}
            options={YES_NO_OPTIONS}
            onSelect={setSnackPreference}
            disabled={!canUseAiPlanner}
          />

          <Text style={styles.questionTitle}>Ozellikle istemedigin besin var mi?</Text>
          <TextInput
            style={[styles.input, styles.inputCompact, !canUseAiPlanner && styles.inputLocked]}
            placeholder="Ornek: brokoli, mantar, ton baligi..."
            placeholderTextColor="#6A7A71"
            editable={canUseAiPlanner}
            value={avoidFoods}
            onChangeText={setAvoidFoods}
          />
          <View style={styles.questionDivider} />

          <Text style={styles.questionTitle}>Eklemek istedigin not var mi?</Text>
          <TextInput
            style={[styles.input, !canUseAiPlanner && styles.inputLocked]}
            placeholder="Ornek: kahvalti pratik olsun, aksamlari hafif menu tercih ederim..."
            placeholderTextColor="#6A7A71"
            multiline
            editable={canUseAiPlanner}
            value={prompt}
            onChangeText={setPrompt}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Vazgec</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, !canUseAiPlanner && styles.primaryBtnDisabled]}
            onPress={handleContinue}
            disabled={!canUseAiPlanner}
          >
            <Text style={styles.primaryText}>Plani Uret</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F5' },
  wrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  content: { paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#1E4B36', fontSize: 26, fontWeight: '900', marginLeft: 6 },
  subtitle: { color: '#4F6357', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  subtitleLocked: { color: '#7D6A6A' },
  questionWrap: { marginBottom: 16 },
  questionTitle: { color: '#29493A', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  questionDivider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#DDE7E0',
    width: '100%',
  },
  optionChip: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  optionActivePill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#1E4B36',
  },
  optionChipDisabled: {
    opacity: 0.55,
  },
  optionRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#BFD3C8',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  optionChipText: { color: '#1E4B36', fontWeight: '700', fontSize: 13 },
  optionChipTextActive: { color: '#fff' },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#C1D8CB',
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1C2E25',
    fontSize: 15,
  },
  inputCompact: {
    minHeight: 52,
  },
  inputLocked: {
    backgroundColor: '#ECEFED',
    borderColor: '#D4DAD6',
    color: '#7A8780',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  cancelText: { color: '#6b7280', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#1E4B36',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnDisabled: { backgroundColor: '#A4AEA8' },
  primaryText: { color: '#fff', fontWeight: '800' },
});

export default MealPlanAiPromptScreen;
