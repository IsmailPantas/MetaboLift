import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';

// API Temel URL'si - FastAPI backend'inizin çalıştığı adrese göre ayarlayın
// Android emülatörü için: 'http://10.0.2.2:8000'
// iOS simülatörü veya fiziksel cihaz (aynı ağda): 'http://<bilgisayarınızın_yerel_ip_adresi>:8000'
const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const ANALYSIS_ENDPOINT = `${API_BASE_URL}/analyze_image/`;

const BodyAnalysisScreen = ({ navigation, route }) => {
  const { user: contextUser, setUser } = useContext(UserContext);
  const [resolvedUser, setResolvedUser] = useState(contextUser || route?.params?.user || null);

  useEffect(() => {
    const routeUser = route?.params?.user;
    if (routeUser) {
      setResolvedUser(routeUser);
      return;
    }

    if (contextUser) {
      setResolvedUser(contextUser);
      return;
    }

    AsyncStorage.getItem('user')
      .then(data => {
        if (!data) {
          navigation.replace('Login');
          return;
        }

        const parsedUser = JSON.parse(data);
        setResolvedUser(parsedUser);
        setUser(parsedUser);
      })
      .catch(() => {
        navigation.replace('Login');
      });
  }, [contextUser, navigation, route?.params?.user, setUser]);

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [gender, setGender] = useState('male');

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home', { user: resolvedUser });
  };

  const selectImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };

    ImagePicker.launchImageLibrary(options, async (response) => {
      if (response.didCancel) {
        console.log('Kullanıcı resim seçmeyi iptal etti');
        return;
      }

      if (response.errorCode) {
        Alert.alert('Hata', `Fotoğraf seçilirken bir hata oluştu: ${response.errorMessage}`);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const selectedImage = response.assets[0];
        setImage(selectedImage);
        await performAnalysis(selectedImage);
      }
    });
  };

  const toggleGender = () => {
    setGender(prevGender => prevGender === 'male' ? 'female' : 'male');
  };

  const performAnalysis = async (selectedImage) => {
    if (!selectedImage) {
      Alert.alert('Uyarı', 'Lütfen önce bir resim seçin.');
      return;
    }

    setLoading(true);
    setAnalysisResults(null);

    const formData = new FormData();
    formData.append('file', {
      uri: selectedImage.uri,
      type: selectedImage.type,
      name: selectedImage.fileName || 'photo.jpg',
    });
    formData.append('gender', gender);

    try {
      const response = await fetch(ANALYSIS_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || `Sunucu hatası: ${response.status}`);
      }
      
      const formattedResults = {
        bodyFatPercentage: responseData["Vücut Yağ Oranı (%)"],
        ratio: responseData["Kalça/Omuz Genişlik Oranı"], 
        shoulderWidth: responseData["Omuz Genişliği (px)"],
        hipWidth: responseData["Kalça Genişliği (px)"],
        height: responseData["Boy Uzunluğu (px)"]
      };
      setAnalysisResults(formattedResults);

    } catch (error) {
      Alert.alert('Analiz Hatası', error.message);
      console.error("Analiz API Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const ResultItem = ({ label, value, unit = '' }) => (
    <View style={styles.resultItem}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value !== undefined && value !== null ? value : 'N/A'}{unit}</Text>
    </View>
  );

  if (!resolvedUser) {
    return (
      <LinearGradient colors={['#2D5A27', '#4D8C8C']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Kullanıcı bilgisi yükleniyor...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2D5A27', '#4D8C8C']} style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Icon name="arrow-left" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Vücut Analizi</Text>
          <TouchableOpacity onPress={toggleGender} style={styles.genderButton}>
              <Icon name={gender === 'male' ? 'gender-male' : 'gender-female'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.imageContainer} onPress={selectImage}>
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.image} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Icon name="camera" size={40} color="#fff" />
                <Text style={styles.placeholderText}>Fotoğraf Seç</Text>
              </View>
            )}
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Analiz yapılıyor...</Text>
            </View>
          )}

          {analysisResults && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Analiz Sonuçları</Text>
              <ResultItem 
                label="Vücut Yağ Oranı" 
                value={analysisResults.bodyFatPercentage} 
                unit="%" 
              />
              <ResultItem 
                label="Kalça/Omuz Oranı"
                value={analysisResults.ratio} 
              />
              <ResultItem 
                label="Omuz Genişliği" 
                value={analysisResults.shoulderWidth} 
                unit=" px" 
              />
              <ResultItem 
                label="Kalça Genişliği" 
                value={analysisResults.hipWidth} 
                unit=" px" 
              />
              <ResultItem 
                label="Boy Uzunluğu (Piksel)"
                value={analysisResults.height} 
                unit=" px" 
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  genderButton: {
    padding: 5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  resultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  resultLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
  },
  resultValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BodyAnalysisScreen; 