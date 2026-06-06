import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { foodSubmissionService } from '../services/foodSubmissionService';

const formatDate = millis =>
  millis ? new Date(millis).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

const TextInput = props => (
  <RNTextInput
    placeholderTextColor="#6b7280"
    selectionColor="#2D5A27"
    underlineColorAndroid="transparent"
    {...props}
  />
);

const AdminFoodReviewScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [reviewNoteById, setReviewNoteById] = useState({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [savingDetail, setSavingDetail] = useState(false);

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const pending = await foodSubmissionService.getPendingSubmissions();
      setItems(pending);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Bekleyen oneriler yenilenemedi.');
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    try {
      unsubscribe = foodSubmissionService.subscribePendingSubmissions(
        pending => {
          setItems(pending);
          setLoading(false);
          setRefreshing(false);
        },
        error => {
          Alert.alert('Hata', error.message || 'Bekleyen oneriler yuklenemedi.');
          setLoading(false);
          setRefreshing(false);
        }
      );
    } catch (error) {
      Alert.alert('Hata', error.message || 'Bekleyen oneriler yuklenemedi.');
      setLoading(false);
      setRefreshing(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleReview = async (submissionId, status) => {
    setActionLoadingId(submissionId);
    try {
      await foodSubmissionService.reviewSubmission({
        submissionId,
        status,
        reviewNote: reviewNoteById[submissionId] || '',
        pointsAwarded: 0,
      });
    } catch (error) {
      Alert.alert('Hata', error.message || 'Onay islemi basarisiz oldu.');
    } finally {
      setActionLoadingId('');
    }
  };

  const openDetail = item => {
    setSelectedItem(item);
    setDetailForm({
      name: item.name || '',
      brandName: item.brandName || '',
      serving: item.serving || '',
      calories: String(item.calories ?? 0),
      protein: String(item.protein ?? 0),
      carbs: String(item.carbs ?? 0),
      fat: String(item.fat ?? 0),
      saturatedFat: String(item.saturatedFat ?? 0),
      fiber: String(item.fiber ?? 0),
      sugar: String(item.sugar ?? 0),
      sodium: String(item.sodium ?? 0),
      potassium: String(item.potassium ?? 0),
      calcium: String(item.calcium ?? 0),
      iron: String(item.iron ?? 0),
      magnesium: String(item.magnesium ?? 0),
      phosphorus: String(item.phosphorus ?? 0),
      zinc: String(item.zinc ?? 0),
      vitaminC: String(item.vitaminC ?? 0),
      vitaminB12: String(item.vitaminB12 ?? 0),
      glycemicIndex: item.glycemicIndex === 0 || item.glycemicIndex ? String(item.glycemicIndex) : '',
      diseaseTags: Array.isArray(item.diseaseTags) ? item.diseaseTags : [],
      unsuitableDiseaseTags: Array.isArray(item.unsuitableDiseaseTags) ? item.unsuitableDiseaseTags : [],
      notes: item.notes || '',
    });
    setDetailVisible(true);
  };

  const toggleTag = (field, disease) => {
    setDetailForm(prev => {
      const currentTags = Array.isArray(prev[field]) ? prev[field] : [];
      const otherField = field === 'diseaseTags' ? 'unsuitableDiseaseTags' : 'diseaseTags';
      const otherTags = Array.isArray(prev[otherField]) ? prev[otherField] : [];
      const isRemoving = currentTags.includes(disease);
      const nextTags = isRemoving
        ? currentTags.filter(tag => tag !== disease)
        : [...currentTags, disease];
      const nextOther = isRemoving ? otherTags : otherTags.filter(tag => tag !== disease);
      return { ...prev, [field]: nextTags, [otherField]: nextOther };
    });
  };

  const saveDetail = async () => {
    if (!selectedItem || !detailForm) return;
    setSavingDetail(true);
    try {
      await foodSubmissionService.updateSubmissionDetails({
        submissionId: selectedItem.id,
        updates: detailForm,
      });
      setDetailVisible(false);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Detaylar guncellenemedi.');
    } finally {
      setSavingDetail(false);
    }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleManualRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Icon name="arrow-left" size={22} color="#4c1d95" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Besin Onay</Text>
        </View>
        <Text style={styles.subtitle}>Kullanicilarin gonderdigi bekleyen besin onerilerini buradan yonetebilirsin.</Text>

        {items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Bekleyen oneriler bos.</Text>
          </View>
        ) : (
          items.map(item => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemMeta}>Gonderen: {item.submittedByEmail || item.submittedBy}</Text>
              <Text style={styles.itemMeta}>Tarih: {formatDate(item.createdAtMs)}</Text>
              <Text style={styles.itemMeta}>Porsiyon: {item.serving}</Text>
              <Text style={styles.itemMeta}>
                Kalori: {item.calories} | Protein: {item.protein}g | Karb: {item.carbs}g | Yag: {item.fat}g
              </Text>
              <Text style={styles.itemMeta}>Kalsiyum: {item.calcium || 0} | Demir: {item.iron || 0} | Magnezyum: {item.magnesium || 0}</Text>
              <Text style={styles.itemMeta}>Glisemik indeks: {Number.isFinite(Number(item.glycemicIndex)) ? Number(item.glycemicIndex) : '-'}</Text>
              <TouchableOpacity style={styles.detailButton} onPress={() => openDetail(item)}>
                <Text style={styles.detailButtonText}>Detay / Duzenle</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Admin notu"
                value={reviewNoteById[item.id] || ''}
                onChangeText={text => setReviewNoteById(prev => ({ ...prev, [item.id]: text }))}
              />

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  disabled={actionLoadingId === item.id}
                  onPress={() => handleReview(item.id, 'approved')}
                >
                  <Icon name="check" color="#fff" size={16} />
                  <Text style={styles.actionText}>{actionLoadingId === item.id ? '...' : 'Onayla'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  disabled={actionLoadingId === item.id}
                  onPress={() => handleReview(item.id, 'rejected')}
                >
                  <Icon name="close" color="#fff" size={16} />
                  <Text style={styles.actionText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => setDetailVisible(false)}>
                <Icon name="arrow-left" size={22} color="#4c1d95" />
              </TouchableOpacity>
              <Text style={styles.title}>Istek Detay / Duzenle</Text>
            </View>
            {detailForm ? (
              <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Besin adi" value={detailForm.name} onChangeText={text => setDetailForm(prev => ({ ...prev, name: text }))} />
                <TextInput style={styles.input} placeholder="Marka" value={detailForm.brandName} onChangeText={text => setDetailForm(prev => ({ ...prev, brandName: text }))} />
                <TextInput style={styles.input} placeholder="Porsiyon" value={detailForm.serving} onChangeText={text => setDetailForm(prev => ({ ...prev, serving: text }))} />
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Kalori" value={detailForm.calories} onChangeText={text => setDetailForm(prev => ({ ...prev, calories: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Protein" value={detailForm.protein} onChangeText={text => setDetailForm(prev => ({ ...prev, protein: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Karb" value={detailForm.carbs} onChangeText={text => setDetailForm(prev => ({ ...prev, carbs: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Yag" value={detailForm.fat} onChangeText={text => setDetailForm(prev => ({ ...prev, fat: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Doymus Yag" value={detailForm.saturatedFat} onChangeText={text => setDetailForm(prev => ({ ...prev, saturatedFat: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Lif" value={detailForm.fiber} onChangeText={text => setDetailForm(prev => ({ ...prev, fiber: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Seker" value={detailForm.sugar} onChangeText={text => setDetailForm(prev => ({ ...prev, sugar: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Sodyum" value={detailForm.sodium} onChangeText={text => setDetailForm(prev => ({ ...prev, sodium: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Potasyum" value={detailForm.potassium} onChangeText={text => setDetailForm(prev => ({ ...prev, potassium: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Kalsiyum" value={detailForm.calcium} onChangeText={text => setDetailForm(prev => ({ ...prev, calcium: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Demir" value={detailForm.iron} onChangeText={text => setDetailForm(prev => ({ ...prev, iron: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Magnezyum" value={detailForm.magnesium} onChangeText={text => setDetailForm(prev => ({ ...prev, magnesium: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Fosfor" value={detailForm.phosphorus} onChangeText={text => setDetailForm(prev => ({ ...prev, phosphorus: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Cinko" value={detailForm.zinc} onChangeText={text => setDetailForm(prev => ({ ...prev, zinc: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Vitamin C" value={detailForm.vitaminC} onChangeText={text => setDetailForm(prev => ({ ...prev, vitaminC: text }))} /><TextInput style={[styles.input, styles.half]} placeholder="Vitamin B12" value={detailForm.vitaminB12} onChangeText={text => setDetailForm(prev => ({ ...prev, vitaminB12: text }))} /></View>
                <View style={styles.row}><TextInput style={[styles.input, styles.half]} placeholder="Glisemik indeks" value={detailForm.glycemicIndex} onChangeText={text => setDetailForm(prev => ({ ...prev, glycemicIndex: text }))} /></View>
                <Text style={styles.smallLabel}>Uygun etiketler</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.tag, detailForm.diseaseTags.includes('diabetes') && styles.tagActive]} onPress={() => toggleTag('diseaseTags', 'diabetes')}><Text style={[styles.tagText, detailForm.diseaseTags.includes('diabetes') && styles.tagTextActive]}>Diyabet icin uygun</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tag, detailForm.diseaseTags.includes('celiac') && styles.tagActive]} onPress={() => toggleTag('diseaseTags', 'celiac')}><Text style={[styles.tagText, detailForm.diseaseTags.includes('celiac') && styles.tagTextActive]}>Colyak icin uygun</Text></TouchableOpacity>
                </View>
                <Text style={styles.smallLabel}>Uygun olmayan etiketler</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.tag, detailForm.unsuitableDiseaseTags.includes('diabetes') && styles.tagDanger]} onPress={() => toggleTag('unsuitableDiseaseTags', 'diabetes')}><Text style={[styles.tagText, detailForm.unsuitableDiseaseTags.includes('diabetes') && styles.tagDangerText]}>Diyabet icin uygun degil</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tag, detailForm.unsuitableDiseaseTags.includes('celiac') && styles.tagDanger]} onPress={() => toggleTag('unsuitableDiseaseTags', 'celiac')}><Text style={[styles.tagText, detailForm.unsuitableDiseaseTags.includes('celiac') && styles.tagDangerText]}>Colyak icin uygun degil</Text></TouchableOpacity>
                </View>
                <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Not" value={detailForm.notes} onChangeText={text => setDetailForm(prev => ({ ...prev, notes: text }))} />
                <TouchableOpacity style={styles.saveButton} onPress={saveDetail} disabled={savingDetail}>
                  <Text style={styles.saveButtonText}>{savingDetail ? 'Kaydediliyor...' : 'Degisiklikleri Kaydet'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  itemTitle: { fontWeight: '700', color: '#1f2937', fontSize: 16, marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  detailButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailButtonText: { color: '#2D5A27', fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cddccd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  half: { flex: 1 },
  smallLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8, marginTop: 2 },
  tag: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tagActive: { backgroundColor: '#e6f2ec', borderColor: '#4D8C8C' },
  tagDanger: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  tagText: { color: '#6b7280', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  tagTextActive: { color: '#2D5A27' },
  tagDangerText: { color: '#991b1b' },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  saveButton: {
    marginTop: 4,
    backgroundColor: '#2D5A27',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  approveButton: { backgroundColor: '#16a34a' },
  rejectButton: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '700' },
  emptyText: { color: '#6b7280' },
});

export default AdminFoodReviewScreen;
