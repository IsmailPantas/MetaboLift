import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nutritionService } from '../services/nutritionService';
import { foodSubmissionService } from '../services/foodSubmissionService';

const NutritionCard = ({ item, diseases, onReport }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailData, setDetailData] = useState(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const getDiseaseSignals = () => {
    const signals = [];
    const name = String(item?.name || '').toLowerCase();
    const glutenKeywords = ['wheat', 'barley', 'rye', 'bulgur', 'spelt', 'bread'];
    const glutenFreeKeywords = ['gluten free', 'gf'];
    const diseaseTags = Array.isArray(item?.diseaseTags) ? item.diseaseTags : [];
    const unsuitableDiseaseTags = Array.isArray(item?.unsuitableDiseaseTags) ? item.unsuitableDiseaseTags : [];
    const hasTag = (list, tag) => list.includes(tag);

    if (diseases.includes('diabetes')) {
      if (hasTag(unsuitableDiseaseTags, 'diabetes')) {
        signals.push({ label: 'Diyabet icin dikkat', type: 'warn' });
      } else if (hasTag(diseaseTags, 'diabetes')) {
        signals.push({ label: 'Diyabet icin daha uygun', type: 'ok' });
      } else if (item.sugar <= 5 && item.fiber >= 3 && item.carbs <= 25) {
        signals.push({ label: 'Diyabet icin daha uygun', type: 'ok' });
      } else if (item.sugar > 10 || item.carbs > 40) {
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

  const diseaseSignals = getDiseaseSignals();

  const handleLoadDetail = async () => {
    if (detailLoading) return;

    if (detailData) {
      setDetailData(null);
      setDetailError('');
      return;
    }

    setDetailError('');

    if (!item?.fdcId) {
      setDetailData({
        fdcId: null,
        description: item?.name || '',
        calories: Number(item?.calories || 0),
        protein: Number(item?.protein || 0),
        carbs: Number(item?.carbs || 0),
        fat: Number(item?.fat || 0),
        saturatedFat: Number(item?.saturatedFat || 0),
        fiber: Number(item?.fiber || 0),
        sugar: Number(item?.sugar || 0),
        sodium: Number(item?.sodium || 0),
        potassium: Number(item?.potassium || 0),
        micronutrients: {
          calcium: Number(item?.calcium || 0),
          iron: Number(item?.iron || 0),
          magnesium: Number(item?.magnesium || 0),
          phosphorus: Number(item?.phosphorus || 0),
          zinc: Number(item?.zinc || 0),
          vitaminC: Number(item?.vitaminC || 0),
          vitaminB12: Number(item?.vitaminB12 || 0),
        },
        glycemicIndex: item?.glycemicIndex ?? null,
      });
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await nutritionService.getFoodDetails(item.fdcId);
      setDetailData(detail);
    } catch (error) {
      setDetailError(error.message || 'Detay verisi alinamadi.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenReport = () => {
    if (!item?.submissionId) {
      Alert.alert('Bilgi', 'Bu besin harici kaynaktan geldigi icin su an bildirilemez.');
      return;
    }
    setReportReason('');
    setReportVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!String(reportReason || '').trim()) {
      Alert.alert('Uyari', 'Lutfen kisa bir aciklama yaz.');
      return;
    }
    if (typeof onReport !== 'function') return;
    setReportSubmitting(true);
    try {
      await onReport({
        foodSubmissionId: item.submissionId,
        foodName: item.name,
        reportReason,
      });
      setReportVisible(false);
      setReportReason('');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={() => setIsExpanded(!isExpanded)}
      style={styles.card}
      activeOpacity={0.94}
    >
      <LinearGradient
        colors={['#4D8C8C', '#2D5A27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.cardHeaderActions}>
            <TouchableOpacity style={styles.reportIconButton} onPress={handleOpenReport}>
              <Icon name="alert-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </View>
        </View>

        <View style={styles.metaRow}>
          {item.isTrusted ? (
            <View style={styles.safeBadge}>
              <Text style={styles.safeBadgeText}>GUVENLI</Text>
              <Icon name="check-decagram" size={12} color="#2D5A27" style={styles.safeBadgeIcon} />
            </View>
          ) : null}
          {item.isRecommended ? <Text style={styles.recommendedBadge}>ONERILEN</Text> : null}
          {item.dataType ? <Text style={styles.metaBadge}>{item.dataType}</Text> : null}
          {item.brandOwner ? <Text style={styles.metaBadge}>{item.brandOwner}</Text> : null}
        </View>

        {item.serving ? (
          <Text style={styles.servingText}>Porsiyon: {item.serving}</Text>
        ) : null}

        {diseaseSignals.length > 0 && (
          <View style={styles.metaRow}>
            {diseaseSignals.map(signal => (
              <Text
                key={`${item.id}-${signal.label}`}
                style={[styles.signalBadge, signal.type === 'ok' ? styles.signalBadgeOk : styles.signalBadgeWarn]}
              >
                {signal.label}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.mainNutrients}>
          <View style={styles.nutrientItem}>
            <Text style={styles.nutrientValue}>{item.calories}</Text>
            <Text style={styles.nutrientLabel}>Kalori</Text>
          </View>
          <View style={[styles.nutrientItem, styles.middleNutrient]}>
            <Text style={styles.nutrientValue}>{item.protein}g</Text>
            <Text style={styles.nutrientLabel}>Protein</Text>
          </View>
          <View style={styles.nutrientItem}>
            <Text style={styles.nutrientValue}>{item.carbs}g</Text>
            <Text style={styles.nutrientLabel}>Karbonhidrat</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Yağ</Text>
                <Text style={styles.detailValue}>{item.fat}g</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Doymuş Yağ</Text>
                <Text style={styles.detailValue}>{item.saturatedFat}g</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Lif</Text>
                <Text style={styles.detailValue}>{item.fiber}g</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Şeker</Text>
                <Text style={styles.detailValue}>{item.sugar}g</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Sodyum</Text>
                <Text style={styles.detailValue}>{item.sodium}mg</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Potasyum</Text>
                <Text style={styles.detailValue}>{item.potassium}mg</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.detailButton} onPress={handleLoadDetail} disabled={detailLoading}>
              <Text style={styles.detailButtonText}>
                {detailLoading ? 'Detay yukleniyor...' : detailData ? 'Detaylari Gizle' : 'Detaylari Goruntule'}
              </Text>
            </TouchableOpacity>

            {detailError ? <Text style={styles.detailError}>{detailError}</Text> : null}

            {detailData && (
              <View style={styles.micronutrientContainer}>
                <Text style={styles.micronutrientTitle}>Mikro Besinler</Text>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Kalsiyum</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.calcium}mg</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Demir</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.iron}mg</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Magnezyum</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.magnesium}mg</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Fosfor</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.phosphorus}mg</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Cinko</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.zinc}mg</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Vitamin C</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.vitaminC}mg</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Vitamin B12</Text>
                    <Text style={styles.detailValue}>{detailData.micronutrients.vitaminB12}ug</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Glisemik Indeks</Text>
                    <Text style={styles.detailValue}>
                      {Number.isFinite(Number(detailData.glycemicIndex))
                        ? Number(detailData.glycemicIndex)
                        : '-'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
      <Modal
        transparent
        animationType="fade"
        visible={reportVisible}
        onRequestClose={() => setReportVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalCard}>
            <Text style={styles.reportModalTitle}>Sorun Bildir</Text>
            <Text style={styles.reportModalSubtitle}>{item.name}</Text>
            <TextInput
              style={styles.reportInput}
              multiline
              placeholder="Bu besinde hangi degerin neden duzeltilmesi gerektigini yaz..."
              placeholderTextColor="#7b8794"
              value={reportReason}
              onChangeText={setReportReason}
              textAlignVertical="top"
            />
            <View style={styles.reportActions}>
              <TouchableOpacity
                style={[styles.reportActionButton, styles.reportCancelButton]}
                onPress={() => setReportVisible(false)}
                disabled={reportSubmitting}
              >
                <Text style={styles.reportCancelButtonText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportActionButton, styles.reportSubmitButton]}
                onPress={handleSubmitReport}
                disabled={reportSubmitting}
              >
                <Text style={styles.reportSubmitButtonText}>
                  {reportSubmitting ? 'Gonderiliyor...' : 'Bildir'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
};

const NutritionScreen = ({ navigation, route }) => {
  const { user } = route.params || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [nutritionData, setNutritionData] = useState(nutritionService.getFallbackFoods());
  const [infoVisible, setInfoVisible] = useState(false);
  const [sortKey, setSortKey] = useState('recommended');
  const [sortListOpen, setSortListOpen] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [diseaseFilter, setDiseaseFilter] = useState('all');
  const [suitabilityDiseaseFilter, setSuitabilityDiseaseFilter] = useState('all');
  const setup = nutritionService.getSetupState();
  const diseases = Array.isArray(user?.diseases) ? user.diseases : [];
  const supportedDiseases = [
    { key: 'diabetes', label: 'Diyabet' },
    { key: 'celiac', label: 'Colyak' },
  ];

  const sortOptions = [
    { key: 'recommended', label: 'Onerilen' },
    { key: 'caloriesAsc', label: 'Kalori (artan)' },
    { key: 'caloriesDesc', label: 'Kalori (azalan)' },
    { key: 'proteinAsc', label: 'Protein (artan)' },
    { key: 'proteinDesc', label: 'Protein (azalan)' },
    { key: 'carbsAsc', label: 'Karbonhidrat (artan)' },
    { key: 'carbsDesc', label: 'Karbonhidrat (azalan)' },
  ];

  useEffect(() => {
    if (!user) {
      navigation.replace('Login');
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const defaults = await nutritionService.getInitialFoods();
        if (mounted) setNutritionData(defaults);
      } catch {
        if (mounted) setNutritionData(nutritionService.getFallbackFoods());
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigation, user]);

  const searchNutrition = async query => {
    if (!query.trim()) {
      const defaults = await nutritionService.getInitialFoods().catch(() => nutritionService.getFallbackFoods());
      setNutritionData(defaults);
      return;
    }

    setLoading(true);
    try {
      const results = await nutritionService.searchFoods(query);
      setNutritionData(results);
      if (results.length === 0) {
        Alert.alert('Bilgi', 'Sonuc bulunamadi. Farkli bir besin arayin.');
      }
    } catch (error) {
      Alert.alert('Hata', error.message || 'Besin arama sirasinda bir hata olustu.');
      setNutritionData(nutritionService.getFallbackFoods());
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home', { user });
  };

  const handleReportFood = async ({ foodSubmissionId, foodName, reportReason }) => {
    try {
      await foodSubmissionService.submitFoodIssueReport({
        foodSubmissionId,
        foodName,
        reportReason,
      });
      Alert.alert('Tesekkurler', 'Bildirimin admin inceleme listesine eklendi.');
    } catch (error) {
      Alert.alert('Hata', error.message || 'Bildirimin gonderilemedi.');
    }
  };

  const evaluateDiseaseForItem = (item, disease) => {
    const name = String(item?.name || '').toLowerCase();
    const glutenKeywords = ['wheat', 'barley', 'rye', 'bulgur', 'spelt', 'bread'];
    const glutenFreeKeywords = ['gluten free', 'gf'];
    const diseaseTags = Array.isArray(item?.diseaseTags) ? item.diseaseTags : [];
    const unsuitableDiseaseTags = Array.isArray(item?.unsuitableDiseaseTags) ? item.unsuitableDiseaseTags : [];
    const hasTag = (list, tag) => list.includes(tag);

    if (disease === 'diabetes') {
      if (hasTag(unsuitableDiseaseTags, 'diabetes')) {
        return 'warn';
      } else if (hasTag(diseaseTags, 'diabetes')) {
        return 'ok';
      } else if (item.sugar > 10 || item.carbs > 40) {
        return 'warn';
      } else if (item.sugar <= 5 && item.fiber >= 3 && item.carbs <= 25) {
        return 'ok';
      }
      return 'none';
    }

    if (disease === 'celiac') {
      if (hasTag(unsuitableDiseaseTags, 'celiac')) {
        return 'warn';
      } else if (hasTag(diseaseTags, 'celiac')) {
        return 'ok';
      } else if (glutenKeywords.some(keyword => name.includes(keyword))) {
        return 'warn';
      } else if (glutenFreeKeywords.some(keyword => name.includes(keyword))) {
        return 'ok';
      }
      return 'none';
    }

    return 'none';
  };

  const getDiseaseSignalsForFilter = item => {
    const signals = [];
    if (diseases.includes('diabetes')) {
      const diabetesState = evaluateDiseaseForItem(item, 'diabetes');
      if (diabetesState === 'ok') {
        signals.push({ label: 'Diyabet icin daha uygun', type: 'ok' });
      } else if (diabetesState === 'warn') {
        signals.push({ label: 'Diyabet icin dikkat', type: 'warn' });
      }
    }
    if (diseases.includes('celiac')) {
      const celiacState = evaluateDiseaseForItem(item, 'celiac');
      if (celiacState === 'ok') {
        signals.push({ label: 'Glutensiz secenek', type: 'ok' });
      } else if (celiacState === 'warn') {
        signals.push({ label: 'Colyak icin gluten riski', type: 'warn' });
      }
    }
    return signals;
  };

  const displayedData = useMemo(() => {
    let rows = [...nutritionData];

    if (sourceFilter === 'trusted') {
      rows = rows.filter(item => Boolean(item.isTrusted));
    }

    if (diseaseFilter !== 'all') {
      rows = rows.filter(item => {
        const signals = getDiseaseSignalsForFilter(item);
        if (diseaseFilter === 'suitable') return signals.some(signal => signal.type === 'ok');
        if (diseaseFilter === 'warn') return signals.some(signal => signal.type === 'warn');
        return true;
      });
    }

    if (suitabilityDiseaseFilter !== 'all') {
      rows = rows.filter(item => evaluateDiseaseForItem(item, suitabilityDiseaseFilter) === 'ok');
    }

    if (sortKey === 'caloriesAsc') {
      rows.sort((a, b) => Number(a.calories || 0) - Number(b.calories || 0));
    } else if (sortKey === 'caloriesDesc') {
      rows.sort((a, b) => Number(b.calories || 0) - Number(a.calories || 0));
    } else if (sortKey === 'proteinAsc') {
      rows.sort((a, b) => Number(a.protein || 0) - Number(b.protein || 0));
    } else if (sortKey === 'proteinDesc') {
      rows.sort((a, b) => Number(b.protein || 0) - Number(a.protein || 0));
    } else if (sortKey === 'carbsAsc') {
      rows.sort((a, b) => Number(a.carbs || 0) - Number(b.carbs || 0));
    } else if (sortKey === 'carbsDesc') {
      rows.sort((a, b) => Number(b.carbs || 0) - Number(a.carbs || 0));
    }

    return rows;
  }, [nutritionData, sourceFilter, diseaseFilter, suitabilityDiseaseFilter, sortKey, diseases]);

  const selectedSortLabel = useMemo(
    () => sortOptions.find(option => option.key === sortKey)?.label || 'Onerilen',
    [sortOptions, sortKey]
  );

  return (
    <LinearGradient
      colors={['#F7F9F5', '#E7EFE6']}
      style={styles.container}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Icon name="arrow-left" size={24} color="#2D5A27" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Besin Değerleri</Text>
          <TouchableOpacity style={styles.infoButton} onPress={() => setInfoVisible(true)}>
            <Icon name="information-outline" size={22} color="#2D5A27" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="magnify" size={24} color="#2D5A27" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Besin ara..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => searchNutrition(searchQuery)}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity
          style={styles.addFoodButton}
          onPress={() => navigation.navigate('FoodSubmission', { user })}
        >
          <View style={styles.addFoodButtonIconWrap}>
            <Icon name="plus" size={16} color="#2D5A27" />
          </View>
          <Text style={styles.addFoodButtonText}>Aradigin besini bulamiyorsan ekleyip bize destek olabilirsin.</Text>
        </TouchableOpacity>

        {!setup.hasApiKey && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              USDA API key ayarlanmadi. Su an fallback besin verisi gosteriliyor.
            </Text>
          </View>
        )}

        <View style={styles.controlRow}>
          <View style={styles.controlCol}>
            <TouchableOpacity style={styles.controlButton} onPress={() => setFilterVisible(true)}>
              <View style={styles.controlLabelRow}>
                <Icon name="filter-variant" size={13} color="#2D5A27" />
                <Text style={styles.controlLabel}>Filtrele</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setSortListOpen(prev => !prev)}
            >
              <View style={styles.controlLabelRow}>
                <Icon name="sort-variant" size={13} color="#2D5A27" />
                <Text style={styles.controlLabel}>Sirala</Text>
              </View>
            </TouchableOpacity>
            {sortListOpen ? (
              <View style={styles.sortListCard}>
                <ScrollView
                  style={styles.sortListScroll}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.sortListItem, sortKey === option.key && styles.sortListItemActive]}
                      onPress={() => {
                        setSortKey(option.key);
                        setSortListOpen(false);
                      }}
                    >
                      <Text style={[styles.sortListItemText, sortKey === option.key && styles.sortListItemTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!sortListOpen}
        >
          {displayedData.length > 0 ? (
            displayedData.map((item) => (
              <NutritionCard key={item.id} item={item} diseases={diseases} onReport={handleReportFood} />
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Icon name="food-off" size={48} color="#fff" />
              <Text style={styles.noResultsText}>Besin bulunamadı</Text>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={filterVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtre</Text>
                <TouchableOpacity onPress={() => setFilterVisible(false)}>
                  <Icon name="close" size={20} color="#2D5A27" />
                </TouchableOpacity>
              </View>

              <Text style={styles.filterGroupTitle}>Kaynak</Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity style={[styles.filterChip, sourceFilter === 'all' && styles.filterChipActive]} onPress={() => setSourceFilter('all')}>
                  <Text style={[styles.filterChipText, sourceFilter === 'all' && styles.filterChipTextActive]}>Hepsi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, sourceFilter === 'trusted' && styles.filterChipActive]} onPress={() => setSourceFilter('trusted')}>
                  <Text style={[styles.filterChipText, sourceFilter === 'trusted' && styles.filterChipTextActive]}>Guvenli</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterGroupTitle}>Hastalik etiketi</Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity style={[styles.filterChip, diseaseFilter === 'all' && styles.filterChipActive]} onPress={() => setDiseaseFilter('all')}>
                  <Text style={[styles.filterChipText, diseaseFilter === 'all' && styles.filterChipTextActive]}>Hepsi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, diseaseFilter === 'suitable' && styles.filterChipActive]} onPress={() => setDiseaseFilter('suitable')}>
                  <Text style={[styles.filterChipText, diseaseFilter === 'suitable' && styles.filterChipTextActive]}>Uygun</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, diseaseFilter === 'warn' && styles.filterChipActive]} onPress={() => setDiseaseFilter('warn')}>
                  <Text style={[styles.filterChipText, diseaseFilter === 'warn' && styles.filterChipTextActive]}>Dikkat</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterGroupTitle}>Hastalik uygunlugu</Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity style={[styles.filterChip, suitabilityDiseaseFilter === 'all' && styles.filterChipActive]} onPress={() => setSuitabilityDiseaseFilter('all')}>
                  <Text style={[styles.filterChipText, suitabilityDiseaseFilter === 'all' && styles.filterChipTextActive]}>Hepsi</Text>
                </TouchableOpacity>
                {supportedDiseases.map(disease => (
                  <TouchableOpacity
                    key={disease.key}
                    style={[styles.filterChip, suitabilityDiseaseFilter === disease.key && styles.filterChipActive]}
                    onPress={() => setSuitabilityDiseaseFilter(disease.key)}
                  >
                    <Text style={[styles.filterChipText, suitabilityDiseaseFilter === disease.key && styles.filterChipTextActive]}>
                      {disease.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={[styles.reportActionButton, styles.reportCancelButton]}
                  onPress={() => {
                    setSourceFilter('all');
                    setDiseaseFilter('all');
                    setSuitabilityDiseaseFilter('all');
                  }}
                >
                  <Text style={styles.reportCancelButtonText}>Temizle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportActionButton, styles.reportSubmitButton]}
                  onPress={() => setFilterVisible(false)}
                >
                  <Text style={styles.reportSubmitButtonText}>Uygula</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={infoVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Etiketler Ne Anlama Geliyor?</Text>
                <TouchableOpacity onPress={() => setInfoVisible(false)}>
                  <Icon name="close" size={20} color="#2D5A27" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.modalItemRow}>
                  <View style={[styles.modalBadge, styles.modalBadgeSafe]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextSafe]}>GUVENLI</Text>
                  </View>
                  <Text style={styles.modalItem}>MetaboLift veritabaninda onaylanmis kayit.</Text>
                </View>
                <View style={styles.modalItemRow}>
                  <View style={[styles.modalBadge, styles.modalBadgeRecommended]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextRecommended]}>ONERILEN</Text>
                  </View>
                  <Text style={styles.modalItem}>Arama kalitesine gore ustte onerilen ilk sonuclar.</Text>
                </View>
                <View style={styles.modalItemRow}>
                  <View style={[styles.modalBadge, styles.modalBadgeRecommended]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextRecommended]}>Diyabet icin daha uygun</Text>
                  </View>
                  <Text style={styles.modalItem}>Seker dusuk, lif gorece yuksek, karbonhidrat kontrollu.</Text>
                </View>
                <View style={styles.modalItemRow}>
                  <View style={[styles.modalBadge, styles.modalBadgeWarn]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextWarn]}>Diyabet icin dikkat</Text>
                  </View>
                  <Text style={styles.modalItem}>Seker veya karbonhidrat degeri yuksek olabilir.</Text>
                </View>
                <View style={styles.modalItemRow}>
                  <View style={[styles.modalBadge, styles.modalBadgeWarn]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextWarn]}>Colyak icin gluten riski</Text>
                  </View>
                  <Text style={styles.modalItem}>Isimde glutenle iliskili anahtar kelime var.</Text>
                </View>
                <View style={[styles.modalItemRow, styles.modalItemRowLast]}>
                  <View style={[styles.modalBadge, styles.modalBadgeRecommended]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextRecommended]}>Glutensiz secenek</Text>
                  </View>
                  <Text style={styles.modalItem}>Isimde glutensiz oldugunu belirten ifade var.</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D5A27',
    flex: 1,
    marginLeft: 8,
  },
  infoButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  addFoodButton: {
    marginHorizontal: 16,
    marginTop: -6,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#FFFEFB',
    paddingVertical: 11,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#B7D3AF',
    elevation: 2,
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  addFoodButtonIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EAF4E7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7C99F',
  },
  addFoodButtonText: {
    color: '#2D5A27',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'left',
    lineHeight: 16,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardGradient: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportIconButton: {
    padding: 2,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  recommendedBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#14532d',
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d8f0e7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  safeBadgeIcon: {
    marginLeft: 4,
  },
  safeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2D5A27',
  },
  metaBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#312e81',
    backgroundColor: '#e0e7ff',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  signalBadge: {
    fontSize: 9,
    fontWeight: '700',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  signalBadgeOk: {
    color: '#14532d',
    backgroundColor: '#dcfce7',
  },
  signalBadgeWarn: {
    color: '#7f1d1d',
    backgroundColor: '#fee2e2',
  },
  servingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  mainNutrients: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  nutrientItem: {
    flex: 1,
    alignItems: 'center',
  },
  middleNutrient: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
  },
  nutrientValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  nutrientLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
  },
  infoBanner: {
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBannerText: {
    color: '#2D5A27',
    fontSize: 12,
    textAlign: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    gap: 8,
    zIndex: 10,
  },
  controlCol: {
    flex: 1,
    position: 'relative',
  },
  controlButton: {
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#B7D3AF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  controlLabel: {
    color: '#2D5A27',
    fontSize: 14,
    fontWeight: '700',
    opacity: 1,
  },
  controlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortListCard: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#FFFEFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E2D1',
    overflow: 'hidden',
    zIndex: 40,
    elevation: 5,
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  sortListScroll: {
    maxHeight: 180,
  },
  sortListItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5ECE2',
  },
  sortListItemActive: {
    backgroundColor: '#EAF4E7',
  },
  sortListItemText: {
    color: '#4F5F4D',
    fontSize: 13,
    fontWeight: '600',
  },
  sortListItemTextActive: {
    color: '#1F3F1B',
    fontWeight: '700',
  },
  detailButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  detailError: {
    color: '#ffd2d2',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  micronutrientContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  micronutrientTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFEFB',
    borderRadius: 14,
    padding: 16,
    height: 390,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D5A27',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalItem: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 8,
  },
  modalItemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalItemRowLast: {
    borderBottomWidth: 0,
  },
  modalBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalBadgeSafe: {
    backgroundColor: '#d8f0e7',
    borderColor: '#74b89a',
  },
  modalBadgeTextSafe: {
    color: '#2D5A27',
  },
  modalBadgeRecommended: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  modalBadgeTextRecommended: {
    color: '#14532d',
  },
  modalBadgeWarn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  modalBadgeTextWarn: {
    color: '#991b1b',
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  reportModalCard: {
    backgroundColor: '#FFFEFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE5D9',
  },
  filterModalCard: {
    backgroundColor: '#FFFEFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE5D9',
  },
  filterGroupTitle: {
    marginTop: 8,
    marginBottom: 8,
    color: '#2D5A27',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#CFE0CC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#6CA763',
    backgroundColor: '#EAF4E7',
  },
  filterChipText: {
    color: '#4F5F4D',
    fontWeight: '600',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#1F3F1B',
    fontWeight: '700',
  },
  filterActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5A27',
  },
  reportModalSubtitle: {
    marginTop: 4,
    marginBottom: 10,
    color: '#4F5F4D',
    fontWeight: '600',
  },
  reportInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#CFE0CC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  reportActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  reportActionButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reportCancelButton: {
    borderWidth: 1,
    borderColor: '#CFE0CC',
    backgroundColor: '#fff',
  },
  reportCancelButtonText: {
    color: '#4F5F4D',
    fontWeight: '700',
  },
  reportSubmitButton: {
    backgroundColor: '#2D5A27',
  },
  reportSubmitButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default NutritionScreen; 