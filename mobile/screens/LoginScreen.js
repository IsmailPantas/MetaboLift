import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserContext } from '../UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../firebase';
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

const LoginScreen = ({ navigation }) => {
  const { setUser } = useContext(UserContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const toUserPayload = (uid, data = {}) => {
    const normalizedPremium = normalizePremium(data.premium);
    return {
      id: uid,
      _id: uid,
      uid,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      birthDate: data.birthDate || '',
      gender: data.gender || '',
      height: data.height || 0,
      weight: data.weight || 0,
      dailyCalories: data.dailyCalories || 0,
      fatPercent: data.fatPercent || 0,
      hasDisease: Boolean(data.hasDisease),
      diseases: Array.isArray(data.diseases) ? data.diseases : [],
      authProvider: data.authProvider || 'password',
      role: data.role || 'user',
      points: Number(data.points) || 0,
      premium: normalizedPremium,
      aiUsage: normalizeAiUsage(data.aiUsage, normalizedPremium),
    };
  };

  const isProfileComplete = userPayload =>
    Boolean(
      userPayload?.firstName &&
        userPayload?.lastName &&
        userPayload?.birthDate &&
        userPayload?.gender &&
        Number(userPayload?.height) > 0 &&
        Number(userPayload?.weight) > 0
    );

  useEffect(() => {
    if (isGoogleClientIdConfigured()) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
      });
    }
  }, []);

  const finalizeLogin = async userPayload => {
    setUser(userPayload);
    await AsyncStorage.setItem('user', JSON.stringify(userPayload));
    if (isProfileComplete(userPayload)) {
      navigation.replace('MainApp', { user: userPayload });
    } else {
      navigation.replace('ProfileSetup');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifre alanlarını doldurun.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', credential.user.uid);
      const userDoc = await getDoc(userRef);

      let userPayload;
      if (userDoc.exists()) {
        userPayload = toUserPayload(credential.user.uid, userDoc.data());
      } else {
        userPayload = toUserPayload(credential.user.uid, {
          email: credential.user.email || email,
          authProvider: 'password',
        });
      }

      await finalizeLogin(userPayload);
    } catch (error) {
      let message = 'Giriş sırasında bir hata oluştu.';
      if (error?.code === 'auth/invalid-credential') message = 'E-posta veya şifre hatalı.';
      if (error?.code === 'auth/invalid-email') message = 'Geçerli bir e-posta adresi girin.';
      if (error?.code === 'auth/too-many-requests') message = 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isGoogleClientIdConfigured()) {
      Alert.alert(
        'Google Giriş Ayarı Eksik',
        'Login ekranındaki GOOGLE_WEB_CLIENT_ID degerini Firebase Web app OAuth client ID ile doldurman gerekiyor.'
      );
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.idToken || signInResult?.data?.idToken;
      if (!idToken) {
        throw new Error('Google idToken alinamadi. Firebase Android SHA ayarlarini kontrol et.');
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
          hasDisease: false,
          diseases: [],
          authProvider: 'google',
        });
      }

      await finalizeLogin(userPayload);
    } catch (error) {
      let message = 'Google ile giriş sırasında bir hata oluştu.';
      if (error?.code === 'auth/account-exists-with-different-credential') {
        message = 'Bu e-posta farkli bir giriş yöntemi ile kayıtlı.';
      }
      if (error?.code === '12501') {
        message = 'Google giriş iptal edildi.';
      }
      if (String(error?.message || '').includes('DEVELOPER_ERROR')) {
        message = 'Google Sign-In ayari eksik. Firebase Android SHA-1/SHA-256 ve webClientId ayarlarini tamamla.';
      }
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#F7F9F5', '#E7EFE6']}
        style={styles.gradient}
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>MetaboLift</Text>
          <Text style={styles.subtitle}>Sağlıklı Yaşam Yolculuğunuza Hoş Geldiniz</Text>

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#B8B8B8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor="#B8B8B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.forgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.googleButton, loading && styles.loginButtonDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <View style={styles.googleButtonContent}>
              <Icon name="google" size={18} color="#2D5A27" style={styles.googleButtonIcon} />
              <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Hesabınız yok mu? </Text>
            <TouchableOpacity disabled={loading} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    width: '90%',
    padding: 20,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D5A27',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#2D5A27',
    fontSize: 14,
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#2D5A27',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#B8B8B8',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#2D5A27',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  googleButtonText: {
    color: '#2D5A27',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonIcon: {
    marginRight: 8,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#2D5A27',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
