import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { StatusBar, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProvider } from './UserContext';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import BodyAnalysisScreen from './screens/BodyAnalysisScreen';
import NutritionScreen from './screens/NutritionScreen';
import ExerciseListScreen from './screens/ExerciseListScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import ExercisePlanScreen from './screens/ExercisePlanScreen';
import MealPlanScreen from './screens/MealPlanScreen';
import MealPlanAiPromptScreen from './screens/MealPlanAiPromptScreen';
import WaterTrackingScreen from './screens/WaterTrackingScreen';
import FoodSubmissionScreen from './screens/FoodSubmissionScreen';
import AdminFoodReviewScreen from './screens/AdminFoodReviewScreen';
import AdminFoodDatabaseScreen from './screens/AdminFoodDatabaseScreen';
import AdminProblematicFoodsScreen from './screens/AdminProblematicFoodsScreen';
import FaqScreen from './screens/FaqScreen';
import { SafeAreaView } from 'react-native-safe-area-context';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const isProfileComplete = user =>
  Boolean(
    user?.firstName &&
      user?.lastName &&
      user?.birthDate &&
      user?.gender &&
      Number(user?.height) > 0 &&
      Number(user?.weight) > 0
  );

const resolveCurrentUser = state => {
  if (!state?.routes?.length) return null;
  const activeRoute = state.routes[state.index];
  if (activeRoute?.params?.user) return activeRoute.params.user;
  const nestedState = activeRoute?.state;
  if (nestedState?.routes?.length) {
    const nestedRoute = nestedState.routes[nestedState.index];
    return nestedRoute?.params?.user || null;
  }
  return null;
};

const CustomDrawerContent = ({ navigation, state }) => {
  const user = resolveCurrentUser(state);
  const userId = user?._id;
  return (
    <SafeAreaView style={styles.drawerContent}>
    <View style={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <Icon name="account-circle" size={60} color="#2D5A27" />
        <Text style={styles.drawerHeaderText}>MetaboLift</Text>
      </View>
      <View style={styles.drawerBody}>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('Home', { user, userId })}>
          <Icon name="home" size={24} color="#2D5A27" /> Ana Sayfa
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('BodyAnalysis', { user, userId })}>
          <Icon name="human" size={24} color="#2D5A27" /> Vücut Analizi
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('Nutrition', { user, userId })}>
          <Icon name="food-apple" size={24} color="#2D5A27" /> Besin Değerleri
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('Exercises', { user, userId })}>
          <Icon name="dumbbell" size={24} color="#2D5A27" /> Egzersiz Hareketleri
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('ExercisePlan', { user, userId })}>
          <Icon name="clipboard-text" size={24} color="#2D5A27" /> Egzersiz Planı
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('FoodSubmission', { user, userId })}>
          <Icon name="food-plus" size={24} color="#2D5A27" /> Besin Öneri Merkezi
        </Text>
        <Text style={styles.drawerItem} onPress={() => navigation.navigate('SikcaSorulanSorular', { user, userId })}>
          <Icon name="help-circle-outline" size={24} color="#2D5A27" /> Sikca Sorulan Sorular
        </Text>
        {user?.role === 'admin' ? (
          <>
            <Text style={styles.drawerItem} onPress={() => navigation.navigate('AdminFoodReview', { user, userId })}>
              <Icon name="shield-account" size={24} color="#2D5A27" /> Admin Besin Onay
            </Text>
            <Text style={styles.drawerItem} onPress={() => navigation.navigate('AdminFoodDatabase', { user, userId })}>
              <Icon name="database-cog" size={24} color="#2D5A27" /> Admin Besin Veritabani
            </Text>
            <Text style={styles.drawerItem} onPress={() => navigation.navigate('AdminProblematicFoods', { user, userId })}>
              <Icon name="alert-circle-outline" size={24} color="#2D5A27" /> Sorunlu Besinler
            </Text>
          </>
        ) : null}
        <Text style={styles.drawerItem} onPress={() => console.log('Profil')}>
          <Icon name="account" size={24} color="#2D5A27" /> Profil
        </Text>
        <Text style={styles.drawerItem} onPress={() => console.log('Ayarlar')}>
          <Icon name="cog" size={24} color="#2D5A27" /> Ayarlar
        </Text>
      </View>
    </View>
    </SafeAreaView>
  );
};

const MainDrawer = ({ route }) => {
  const user = route?.params?.user;
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: '#fff',
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} initialParams={{ user }} />
      <Drawer.Screen name="BodyAnalysis" component={BodyAnalysisScreen} initialParams={{ user }} />
      <Drawer.Screen name="Nutrition" component={NutritionScreen} initialParams={{ user }} />
      <Drawer.Screen name="Exercises" component={ExerciseListScreen} initialParams={{ user }} />
      <Drawer.Screen name="ExercisePlan" component={ExercisePlanScreen} initialParams={{ user }} />
      <Drawer.Screen name="MealPlan" component={MealPlanScreen} initialParams={{ user }} />
      <Drawer.Screen name="WaterTracking" component={WaterTrackingScreen} initialParams={{ user }} />
      <Drawer.Screen name="FoodSubmission" component={FoodSubmissionScreen} initialParams={{ user }} />
      <Drawer.Screen name="SikcaSorulanSorular" component={FaqScreen} initialParams={{ user }} />
      <Drawer.Screen name="AdminFoodReview" component={AdminFoodReviewScreen} initialParams={{ user }} />
      <Drawer.Screen name="AdminFoodDatabase" component={AdminFoodDatabaseScreen} initialParams={{ user }} />
      <Drawer.Screen name="AdminProblematicFoods" component={AdminProblematicFoodsScreen} initialParams={{ user }} />
    </Drawer.Navigator>
  );
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootUser, setBootUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadBootUser = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (!mounted) return;
        if (!raw) {
          setBootUser(null);
          return;
        }
        const parsed = JSON.parse(raw);
        setBootUser(parsed && typeof parsed === 'object' ? parsed : null);
      } catch {
        if (mounted) {
          setBootUser(null);
        }
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    };
    loadBootUser();
    return () => {
      mounted = false;
    };
  }, []);

  if (booting) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color="#2D5A27" />
      </View>
    );
  }

  const initialRouteName = bootUser
    ? (isProfileComplete(bootUser) ? 'MainApp' : 'ProfileSetup')
    : 'Login';

  return (
    <UserProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F9F5" />
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#F7F9F5' }
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            initialParams={{ user: bootUser }}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MainApp" 
            component={MainDrawer}
            initialParams={{ user: bootUser }}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MealPlanViewer"
            component={MealPlanScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MealPlanAiPrompt"
            component={MealPlanAiPromptScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ExercisePlan" 
            component={ExercisePlanScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9F5',
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  drawerHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5A27',
    marginTop: 10,
  },
  drawerBody: {
    padding: 15,
  },
  drawerItem: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    marginBottom: 5,
  },
});
