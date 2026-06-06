import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../firebase';
import { UserContext } from '../UserContext';
import { GOOGLE_WEB_CLIENT_ID, isGoogleClientIdConfigured } from '../config/googleAuth';

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

const RegisterScreen = ({ navigation }) => {
  const { setUser } = useContext(UserContext);
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [loading, setLoading] = useState(false);

  const toUserPayload = (uid, data = {}) => {
    const normalizedPremium = normalizePremium(data.premium);
    return {
      id: uid,
      _id: uid,
      uid,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || form.email || '',
      birthDate: '',
      gender: '',
      height: 0,
      weight: 0,
      dailyCalories: 0,
      fatPercent: 0,
      hasDisease: false,
      diseases: [],
      authProvider: data.authProvider || 'password',
      role: data.role || 'user',
      points: Number(data.points) || 0,
      premium: normalizedPremium,
      aiUsage: normalizeAiUsage(data.aiUsage, normalizedPremium),
    };
  };

  const handleChange = (name, value) => {
    setForm({ ...form, [name]: value });
  };

  const validateEmail = email => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const persistAndContinue = async userPayload => {
    setUser(userPayload);
    await AsyncStorage.setItem('user', JSON.stringify(userPayload));
    navigation.replace('ProfileSetup');
  };

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.passwordConfirm) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (!validateEmail(form.email)) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const userPayload = toUserPayload(credential.user.uid);

      await persistAndContinue(userPayload);
    } catch (err) {
      let message = 'Kayıt sırasında bir hata oluştu.';
      if (err?.code === 'auth/email-already-in-use') message = 'Bu e-posta zaten kayıtlı.';
      if (err?.code === 'auth/weak-password') message = 'Şifre en az 6 karakter olmalı.';
      if (err?.code === 'auth/invalid-email') message = 'Geçerli bir e-posta adresi girin.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!isGoogleClientIdConfigured()) {
      Alert.alert(
        'Google Kayıt Ayarı Eksik',
        'config/googleAuth.js dosyasindaki GOOGLE_WEB_CLIENT_ID degerini Firebase Web app OAuth client ID ile doldur.'
      );
      return;
    }

    setLoading(true);
    try {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.idToken || signInResult?.data?.idToken;

      if (!idToken) {
        throw new Error('Google idToken alinamadi. Firebase SHA ayarlarini kontrol et.');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const credential = await signInWithCredential(auth, googleCredential);
      const userRef = doc(db, 'users', credential.user.uid);
      const userDoc = await getDoc(userRef);
      let userPayload;

      if (userDoc.exists()) {
        userPayload = toUserPayload(credential.user.uid, userDoc.data());
      } else {
        const fullName = credential.user.displayName || '';
        const [firstName = '', ...lastNameParts] = fullName.split(' ');
        userPayload = toUserPayload(credential.user.uid, {
          firstName,
          lastName: lastNameParts.join(' '),
          email: credential.user.email || '',
          authProvider: 'google',
        });
      }

      await persistAndContinue(userPayload);
    } catch (error) {
      let message = 'Google ile kayıt sırasında hata oluştu.';
      if (error?.code === '12501') message = 'Google kayıt işlemi iptal edildi.';
      if (String(error?.message || '').includes('DEVELOPER_ERROR')) {
        message = 'Google Sign-In ayari eksik. Firebase SHA-1/SHA-256 ve webClientId ayarlarini tamamla.';
      }
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Kayıt Ol</Text>
      <Text style={styles.subtitle}>Google veya e-posta ile kayıt ol, sonra profil formunu doldur.</Text>
      <TextInput
        style={styles.input}
        placeholder="E-posta"
        value={form.email}
        onChangeText={v => handleChange('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput style={styles.input} placeholder="Şifre" value={form.password} onChangeText={v => handleChange('password', v)} secureTextEntry />
      <TextInput
        style={styles.input}
        placeholder="Şifre Tekrar"
        value={form.passwordConfirm}
        onChangeText={v => handleChange('passwordConfirm', v)}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>E-posta ile Devam Et</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleRegister} disabled={loading}>
        <View style={styles.googleButtonContent}>
          <Icon name="google" size={18} color="#2D5A27" style={styles.googleButtonIcon} />
          <Text style={styles.googleButtonText}>Google ile Devam Et</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 16 }}>
        <Text style={styles.link}>Zaten hesabınız var mı? Giriş Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F7F9F5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#2D5A27' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 14, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 0, marginBottom: 12, backgroundColor: '#fff', height: 56 },
  button: { backgroundColor: '#2D5A27', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#2D5A27', marginTop: 16, textDecorationLine: 'underline' },
  googleButton: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2D5A27',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  googleButtonText: { color: '#2D5A27', fontWeight: '700', fontSize: 16 },
  googleButtonContent: { flexDirection: 'row', alignItems: 'center' },
  googleButtonIcon: { marginRight: 8 },
});

export default RegisterScreen; 