import React, { useMemo, useState } from 'react';
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

const AdminProblematicFoodsScreen = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  React.useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    try {
      unsubscribe = foodSubmissionService.subscribePendingFoodIssueReports(
        rows => {
          setReports(rows);
          setLoading(false);
          setRefreshing(false);
        },
        error => {
          Alert.alert('Hata', error.message || 'Sorunlu besinler yuklenemedi.');
          setLoading(false);
          setRefreshing(false);
        }
      );
    } catch (error) {
      Alert.alert('Hata', error.message || 'Sorunlu besinler yuklenemedi.');
      setLoading(false);
      setRefreshing(false);
    }

    return () => unsubscribe();
  }, []);

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  };

  const filteredReports = useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    if (!q) return reports;
    return reports.filter(item => {
      const foodName = String(item.foodName || '').toLowerCase();
      const reason = String(item.reportReason || '').toLowerCase();
      const email = String(item.reportedByEmail || '').toLowerCase();
      return foodName.includes(q) || reason.includes(q) || email.includes(q);
    });
  }, [reports, search]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const rows = await foodSubmissionService.getPendingFoodIssueReports();
      setReports(rows);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Yenileme basarisiz.');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleTag = (field, disease) => {
    setDetailForm(prev => {
      const currentTags = Array.isArray(prev[field]) ? prev[field] : [];
      const otherField = field === 'diseaseTags' ? 'unsuitableDiseaseTags' : 'diseaseTags';
      const otherTags = Array.isArray(prev[otherField]) ? prev[otherField] : [];
      const isRemoving = currentTags.includes(disease);
      const nextTags = isRemoving ? currentTags.filter(tag => tag !== disease) : [...currentTags, disease];
      const nextOther = isRemoving ? otherTags : otherTags.filter(tag => tag !== disease);
      return { ...prev, [field]: nextTags, [otherField]: nextOther };
    });
  };

  const openDetail = async report => {
    try {
      setSaving(true);
      const food = await foodSubmissionService.getSubmissionById(report.foodSubmissionId);
      setSelectedReport(report);
      setAdminNote('');
      setDetailForm({
        name: food.name || '',
        brandName: food.brandName || '',
        serving: food.serving || '',
        calories: String(food.calories ?? 0),
        protein: String(food.protein ?? 0),
        carbs: String(food.carbs ?? 0),
        fat: String(food.fat ?? 0),
        saturatedFat: String(food.saturatedFat ?? 0),
        fiber: String(food.fiber ?? 0),
        sugar: String(food.sugar ?? 0),
        sodium: String(food.sodium ?? 0),
        potassium: String(food.potassium ?? 0),
        calcium: String(food.calcium ?? 0),
        iron: String(food.iron ?? 0),
        magnesium: String(food.magnesium ?? 0),
        phosphorus: String(food.phosphorus ?? 0),
        zinc: String(food.zinc ?? 0),
        vitaminC: String(food.vitaminC ?? 0),
        vitaminB12: String(food.vitaminB12 ?? 0),
        glycemicIndex: food.glycemicIndex === 0 || food.glycemicIndex ? String(food.glycemicIndex) : '',
        diseaseTags: Array.isArray(food.diseaseTags) ? food.diseaseTags : [],
        unsuitableDiseaseTags: Array.isArray(food.unsuitableDiseaseTags) ? food.unsuitableDiseaseTags : [],
        notes: food.notes || '',
      });
      setDetailVisible(true);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Besin detaylari acilamadi.');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport || !detailForm) return;
    setSaving(true);
    try {
      await foodSubmissionService.updateFoodIssueReportAndFood({
        reportId: selectedReport.id,
        foodSubmissionId: selectedReport.foodSubmissionId,
        foodUpdates: detailForm,
        resolutionStatus: 'resolved',
        adminNote,
      });
      setDetailVisible(false);
      Alert.alert('Basarili', 'Rapor cozuldu. Besin guncellendi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Rapor cozulurken hata olustu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = report => {
    Alert.alert(
      'Raporu sil',
      `"${report.foodName}" raporunu silmek istedigine emin misin?`,
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(report.id);
            try {
              await foodSubmissionService.deleteFoodIssueReport(report.id);
            } catch (error) {
              Alert.alert('Hata', error.message || 'Rapor silinemedi.');
            } finally {
              setDeletingId('');
            }
          },
        },
      ]
    );
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
            <Icon name="arrow-left" size={22} color="#2D5A27" />
          </TouchableOpacity>
          <Text style={styles.title}>Sorunlu Besinler</Text>
        </View>
        <Text style={styles.subtitle}>Kullanicilarin bildirdigi sorunlu besinleri buradan yonetebilirsin.</Text>

        <TextInput
          style={styles.input}
          placeholder="Ara (besin, neden, e-posta)"
          value={search}
          onChangeText={setSearch}
        />

        {filteredReports.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Bekleyen sorun bildirimi yok.</Text>
          </View>
        ) : (
          filteredReports.map(item => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.itemTitle}>{item.foodName}</Text>
              <Text style={styles.itemMeta}>Bildiren: {item.reportedByEmail || item.reportedBy}</Text>
              <Text style={styles.itemMeta}>Tarih: {formatDate(item.createdAtMs)}</Text>
              <Text style={styles.reasonText}>Neden: {item.reportReason}</Text>

              <View style={styles.row}>
                <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openDetail(item)}>
                  <Text style={styles.actionText}>{saving ? '...' : 'Duzenle'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  <Text style={styles.actionText}>{deletingId === item.id ? 'Siliniyor...' : 'Sorunu Sil'}</Text>
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
                <Icon name="arrow-left" size={22} color="#2D5A27" />
              </TouchableOpacity>
              <Text style={styles.title}>Raporu Duzenle</Text>
            </View>
            {detailForm ? (
              <View style={styles.card}>
                <Text style={styles.reportBadgeText}>Rapor: {selectedReport?.reportReason || '-'}</Text>
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
                <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Besin notu" value={detailForm.notes} onChangeText={text => setDetailForm(prev => ({ ...prev, notes: text }))} />
                <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Admin cozum notu" value={adminNote} onChangeText={setAdminNote} />
                <TouchableOpacity style={styles.saveButton} onPress={handleResolve} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Kaydediliyor...' : 'Onayla ve Guncelle'}</Text>
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
  reasonText: { fontSize: 12, color: '#374151', marginTop: 6 },
  reportBadgeText: {
    fontSize: 12,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
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
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: { backgroundColor: '#2D5A27' },
  deleteButton: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '700' },
  emptyText: { color: '#6b7280' },
  smallLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8, marginTop: 2 },
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
});

export default AdminProblematicFoodsScreen;
