import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { foodSubmissionService } from '../services/foodSubmissionService';

const initialForm = {
  name: '',
  brandName: '',
  serving: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  saturatedFat: '',
  fiber: '',
  sugar: '',
  sodium: '',
  potassium: '',
  calcium: '',
  iron: '',
  magnesium: '',
  phosphorus: '',
  zinc: '',
  vitaminC: '',
  vitaminB12: '',
  glycemicIndex: '',
  diseaseTags: [],
  unsuitableDiseaseTags: [],
  notes: '',
};

const formatDate = millis =>
  millis ? new Date(millis).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

const statusLabel = {
  pending: 'Beklemede',
  approved: 'Onaylandi',
  rejected: 'Reddedildi',
};

const AppTextInput = props => (
  <TextInput
    placeholderTextColor="#6b7280"
    selectionColor="#2D5A27"
    underlineColorAndroid="transparent"
    {...props}
  />
);

const FoodSubmissionScreen = ({ navigation, route }) => {
  const [form, setForm] = useState(initialForm);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = route.params || {};

  const badgeColorByStatus = useMemo(
    () => ({
      pending: styles.badgePending,
      approved: styles.badgeApproved,
      rejected: styles.badgeRejected,
    }),
    []
  );

  React.useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    try {
      unsubscribe = foodSubmissionService.subscribeMySubmissions(
        myItems => {
          setMySubmissions(myItems);
          setLoading(false);
          setRefreshing(false);
        },
        error => {
          Alert.alert('Hata', error.message || 'Veriler yuklenemedi.');
          setLoading(false);
          setRefreshing(false);
        }
      );
    } catch (error) {
      Alert.alert('Hata', error.message || 'Veriler yuklenemedi.');
      setLoading(false);
      setRefreshing(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      const myItems = await foodSubmissionService.getMySubmissions();
      setMySubmissions(myItems);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Veriler yuklenemedi.');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleDiseaseTag = (field, disease) => {
    setForm(prev => {
      const currentTags = Array.isArray(prev[field]) ? prev[field] : [];
      const otherField = field === 'diseaseTags' ? 'unsuitableDiseaseTags' : 'diseaseTags';
      const otherTags = Array.isArray(prev[otherField]) ? prev[otherField] : [];
      const isRemoving = currentTags.includes(disease);
      const nextTags = isRemoving
        ? currentTags.filter(tag => tag !== disease)
        : [...currentTags, disease];
      const nextOtherTags = isRemoving
        ? otherTags
        : otherTags.filter(tag => tag !== disease);

      return {
        ...prev,
        [field]: nextTags,
        [otherField]: nextOtherTags,
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await foodSubmissionService.submitSuggestion(form);
      setForm(initialForm);
      await loadData();
      Alert.alert('Basarili', 'Besin onerisi admin onayina gonderildi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Besin onerisi gonderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home', { user });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2D5A27" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Icon name="arrow-left" size={22} color="#4c1d95" />
          </TouchableOpacity>
          <Text style={styles.title}>Besin Oneri Merkezi</Text>
        </View>
        <Text style={styles.subtitle}>Aradigin besin yoksa oner, admin onayindan sonra kullanilsin.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Yeni Besin Onerisi</Text>
          <AppTextInput style={styles.input} placeholder="Besin adi" value={form.name} onChangeText={text => setForm(prev => ({ ...prev, name: text }))} />
          <AppTextInput style={styles.input} placeholder="Marka (opsiyonel)" value={form.brandName} onChangeText={text => setForm(prev => ({ ...prev, brandName: text }))} />
          <AppTextInput style={styles.input} placeholder="Porsiyon (100 g, 1 adet)" value={form.serving} onChangeText={text => setForm(prev => ({ ...prev, serving: text }))} />
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Kalori" keyboardType="numeric" value={form.calories} onChangeText={text => setForm(prev => ({ ...prev, calories: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Protein" keyboardType="numeric" value={form.protein} onChangeText={text => setForm(prev => ({ ...prev, protein: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Karb" keyboardType="numeric" value={form.carbs} onChangeText={text => setForm(prev => ({ ...prev, carbs: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Yag" keyboardType="numeric" value={form.fat} onChangeText={text => setForm(prev => ({ ...prev, fat: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Doymus Yag (g)" keyboardType="numeric" value={form.saturatedFat} onChangeText={text => setForm(prev => ({ ...prev, saturatedFat: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Lif (g)" keyboardType="numeric" value={form.fiber} onChangeText={text => setForm(prev => ({ ...prev, fiber: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Seker (g)" keyboardType="numeric" value={form.sugar} onChangeText={text => setForm(prev => ({ ...prev, sugar: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Sodyum (mg)" keyboardType="numeric" value={form.sodium} onChangeText={text => setForm(prev => ({ ...prev, sodium: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Potasyum (mg)" keyboardType="numeric" value={form.potassium} onChangeText={text => setForm(prev => ({ ...prev, potassium: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Kalsiyum (mg)" keyboardType="numeric" value={form.calcium} onChangeText={text => setForm(prev => ({ ...prev, calcium: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Demir (mg)" keyboardType="numeric" value={form.iron} onChangeText={text => setForm(prev => ({ ...prev, iron: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Magnezyum (mg)" keyboardType="numeric" value={form.magnesium} onChangeText={text => setForm(prev => ({ ...prev, magnesium: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Fosfor (mg)" keyboardType="numeric" value={form.phosphorus} onChangeText={text => setForm(prev => ({ ...prev, phosphorus: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Cinko (mg)" keyboardType="numeric" value={form.zinc} onChangeText={text => setForm(prev => ({ ...prev, zinc: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Vitamin C (mg)" keyboardType="numeric" value={form.vitaminC} onChangeText={text => setForm(prev => ({ ...prev, vitaminC: text }))} />
            <AppTextInput style={[styles.input, styles.half]} placeholder="Vitamin B12 (ug)" keyboardType="numeric" value={form.vitaminB12} onChangeText={text => setForm(prev => ({ ...prev, vitaminB12: text }))} />
          </View>
          <View style={styles.row}>
            <AppTextInput style={[styles.input, styles.half]} placeholder="Glisemik indeks" keyboardType="numeric" value={form.glycemicIndex} onChangeText={text => setForm(prev => ({ ...prev, glycemicIndex: text }))} />
          </View>
          <Text style={styles.smallLabel}>Uygun hastalik etiketleri</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.tag, form.diseaseTags.includes('diabetes') && styles.tagActive]}
              onPress={() => toggleDiseaseTag('diseaseTags', 'diabetes')}
            >
              <Text style={[styles.tagText, form.diseaseTags.includes('diabetes') && styles.tagTextActive]}>Diyabet icin uygun</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tag, form.diseaseTags.includes('celiac') && styles.tagActive]}
              onPress={() => toggleDiseaseTag('diseaseTags', 'celiac')}
            >
              <Text style={[styles.tagText, form.diseaseTags.includes('celiac') && styles.tagTextActive]}>Colyak icin uygun</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.smallLabel}>Uygun olmayan hastalik etiketleri</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.tag, form.unsuitableDiseaseTags.includes('diabetes') && styles.tagDanger]}
              onPress={() => toggleDiseaseTag('unsuitableDiseaseTags', 'diabetes')}
            >
              <Text style={[styles.tagText, form.unsuitableDiseaseTags.includes('diabetes') && styles.tagDangerText]}>Diyabet icin uygun degil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tag, form.unsuitableDiseaseTags.includes('celiac') && styles.tagDanger]}
              onPress={() => toggleDiseaseTag('unsuitableDiseaseTags', 'celiac')}
            >
              <Text style={[styles.tagText, form.unsuitableDiseaseTags.includes('celiac') && styles.tagDangerText]}>Colyak icin uygun degil</Text>
            </TouchableOpacity>
          </View>
          <AppTextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="Ek not"
            value={form.notes}
            onChangeText={text => setForm(prev => ({ ...prev, notes: text }))}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? 'Gonderiliyor...' : 'Admin Onayina Gonder'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gonderilerim</Text>
          {mySubmissions.length === 0 ? (
            <Text style={styles.emptyText}>Henuz gonderin yok.</Text>
          ) : (
            mySubmissions.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={[styles.statusBadge, badgeColorByStatus[item.status] || styles.badgePending]}>
                    {statusLabel[item.status] || item.status}
                  </Text>
                </View>
                <Text style={styles.itemMeta}>Porsiyon: {item.serving}</Text>
                <Text style={styles.itemMeta}>Tarih: {formatDate(item.createdAtMs)}</Text>
                {item.reviewNote ? <Text style={styles.itemMeta}>Admin Notu: {item.reviewNote}</Text> : null}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9F5' },
  container: { padding: 16, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  backButton: { padding: 6, marginRight: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#2D5A27' },
  subtitle: { marginTop: 6, marginBottom: 12, color: '#6b7280' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2D5A27', marginBottom: 10 },
  smallLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8, marginTop: -2 },
  input: {
    borderWidth: 1,
    borderColor: '#cddccd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  half: { flex: 1 },
  tag: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#9fc1a2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tagActive: { backgroundColor: '#e6f2ec', borderColor: '#4D8C8C' },
  tagDanger: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  tagText: { color: '#6b7280', fontWeight: '600' },
  tagTextActive: { color: '#2D5A27' },
  tagDangerText: { color: '#991b1b' },
  primaryButton: {
    marginTop: 4,
    backgroundColor: '#2D5A27',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  emptyText: { color: '#6b7280' },
  itemRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitle: { fontWeight: '700', color: '#1f2937' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, fontSize: 11, fontWeight: '700' },
  badgePending: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeApproved: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeRejected: { backgroundColor: '#fee2e2', color: '#991b1b' },
});

export default FoodSubmissionScreen;
