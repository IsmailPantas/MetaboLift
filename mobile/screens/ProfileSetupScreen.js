import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentUserOrThrow } from '../services/authSession';
import { UserContext } from '../UserContext';

const isProfileComplete = user =>
  Boolean(
    user?.firstName &&
      user?.lastName &&
      user?.birthDate &&
      user?.gender &&
      Number(user?.height) > 0 &&
      Number(user?.weight) > 0
  );

const TextInput = props => (
  <RNTextInput
    placeholderTextColor="#6b7280"
    selectionColor="#2D5A27"
    underlineColorAndroid="transparent"
    {...props}
  />
);

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

const ProfileSetupScreen = ({ navigation }) => {
  const { setUser } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    height: '',
    weight: '',
    hasDisease: false,
    diseases: [],
  });

  useEffect(() => {
    const loadUser = async () => {
      let current;
      try {
        current = await getCurrentUserOrThrow('Oturum bulunamadi.');
      } catch {
        navigation.replace('Login');
        return;
      }

      const snapshot = await getDoc(doc(db, 'users', current.uid));
      const cachedRaw = await AsyncStorage.getItem('user');
      const cachedUser = cachedRaw ? JSON.parse(cachedRaw) : {};
      const user = snapshot.exists() ? snapshot.data() : cachedUser;
      if (isProfileComplete(user)) {
        setUser(user);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        navigation.replace('MainApp', { user });
        return;
      }

      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        birthDate: user.birthDate || '',
        gender: user.gender || '',
        height: user.height ? String(user.height) : '',
        weight: user.weight ? String(user.weight) : '',
        hasDisease: Boolean(user.hasDisease),
        diseases: Array.isArray(user.diseases) ? user.diseases : [],
      });
    };

    loadUser();
  }, [navigation, setUser]);

  const handleChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      setForm(prev => ({ ...prev, birthDate: iso }));
    }
  };

  const toggleDisease = disease => {
    const nextDiseases = form.diseases.includes(disease)
      ? form.diseases.filter(item => item !== disease)
      : [...form.diseases, disease];
    setForm(prev => ({ ...prev, diseases: nextDiseases }));
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.birthDate || !form.gender || !form.height || !form.weight) {
      Alert.alert('Hata', 'Lütfen tüm profil alanlarını doldurun.');
      return;
    }
    if (Number(form.height) <= 0 || Number(form.weight) <= 0) {
      Alert.alert('Hata', 'Boy ve kilo 0dan büyük olmalı.');
      return;
    }
    if (form.hasDisease && form.diseases.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir hastalık seçin.');
      return;
    }

    setLoading(true);
    try {
      const current = await getCurrentUserOrThrow('Oturum bulunamadi.');

      const userRef = doc(db, 'users', current.uid);
      const snapshot = await getDoc(userRef);
      const currentData = snapshot.exists() ? snapshot.data() : {};
      const normalizedPremium = normalizePremium(currentData.premium);
      const userPayload = {
        id: current.uid,
        _id: current.uid,
        uid: current.uid,
        email: current.email || currentData.email || '',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate,
        gender: form.gender,
        height: Number(form.height),
        weight: Number(form.weight),
        dailyCalories: Number(currentData.dailyCalories || 0),
        fatPercent: Number(currentData.fatPercent || 0),
        hasDisease: form.hasDisease,
        diseases: form.hasDisease ? form.diseases : [],
        authProvider: currentData.authProvider || 'password',
        role: currentData.role || 'user',
        points: Number(currentData.points) || 0,
        premium: normalizedPremium,
        aiUsage: normalizeAiUsage(currentData.aiUsage, normalizedPremium),
      };

      await setDoc(
        userRef,
        {
          ...userPayload,
          createdAt: currentData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setUser(userPayload);
      await AsyncStorage.setItem('user', JSON.stringify(userPayload));
      navigation.replace('MainApp', { user: userPayload });
    } catch (error) {
      Alert.alert('Hata', error.message || 'Profil kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profil Tamamlama</Text>
      <Text style={styles.subtitle}>Boy, kilo ve temel sağlık bilgilerini tamamla.</Text>

      <TextInput style={styles.input} placeholder="Ad" value={form.firstName} onChangeText={v => handleChange('firstName', v)} />
      <TextInput style={styles.input} placeholder="Soyad" value={form.lastName} onChangeText={v => handleChange('lastName', v)} />

      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input} activeOpacity={0.8}>
        <Text style={{ color: form.birthDate ? '#333' : '#aaa' }}>{form.birthDate || 'Doğum Tarihi Seç'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={form.birthDate ? new Date(form.birthDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      <View style={[styles.input, { paddingHorizontal: 0, justifyContent: 'center', height: 56 }]}>
        <Picker
          selectedValue={form.gender}
          onValueChange={v => handleChange('gender', v)}
          style={{ width: '100%', height: 56, color: form.gender ? '#333' : '#aaa' }}
          dropdownIconColor="#2D5A27"
        >
          <Picker.Item label="Cinsiyet Seçin" value="" color="#aaa" />
          <Picker.Item label="Erkek" value="male" color="#333" />
          <Picker.Item label="Kadın" value="female" color="#333" />
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Boy (cm)"
        value={form.height}
        onChangeText={v => handleChange('height', v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        maxLength={3}
      />
      <TextInput
        style={styles.input}
        placeholder="Kilo (kg)"
        value={form.weight}
        onChangeText={v => handleChange('weight', v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        maxLength={3}
      />

      <Text style={styles.sectionTitle}>Tanılı hastalığınız var mı?</Text>
      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[styles.choiceButton, !form.hasDisease && styles.choiceButtonActive]}
          onPress={() => handleChange('hasDisease', false)}
        >
          <Text style={[styles.choiceText, !form.hasDisease && styles.choiceTextActive]}>Hayır</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choiceButton, form.hasDisease && styles.choiceButtonActive]}
          onPress={() => handleChange('hasDisease', true)}
        >
          <Text style={[styles.choiceText, form.hasDisease && styles.choiceTextActive]}>Evet</Text>
        </TouchableOpacity>
      </View>

      {form.hasDisease && (
        <View style={styles.diseaseBox}>
          <Text style={styles.diseaseTitle}>Hastalık seçimi (birden fazla seçebilirsin)</Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[styles.tag, form.diseases.includes('diabetes') && styles.tagActive]}
              onPress={() => toggleDisease('diabetes')}
            >
              <Text style={[styles.tagText, form.diseases.includes('diabetes') && styles.tagTextActive]}>Diyabet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tag, form.diseases.includes('celiac') && styles.tagActive]}
              onPress={() => toggleDisease('celiac')}
            >
              <Text style={[styles.tagText, form.diseases.includes('celiac') && styles.tagTextActive]}>Çölyak</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Profili Kaydet</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F7F9F5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: '#2D5A27' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    marginBottom: 12,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  button: { backgroundColor: '#2D5A27', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { width: '100%', fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 4 },
  choiceRow: { width: '100%', flexDirection: 'row', gap: 10, marginBottom: 10 },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  choiceButtonActive: { borderColor: '#2D5A27', backgroundColor: '#EAF3E8' },
  choiceText: { color: '#666', fontWeight: '600' },
  choiceTextActive: { color: '#2D5A27' },
  diseaseBox: { width: '100%', padding: 12, borderRadius: 10, backgroundColor: '#F1F6F0', marginBottom: 10 },
  diseaseTitle: { color: '#2D5A27', fontWeight: '600', marginBottom: 8 },
  tag: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tagActive: { borderColor: '#2D5A27', backgroundColor: '#E6F2EC' },
  tagText: { color: '#374151', fontWeight: '600' },
  tagTextActive: { color: '#2D5A27' },
});

export default ProfileSetupScreen;
