import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

const FaqScreen = ({ navigation }) => {
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  };

  return (
    <LinearGradient colors={['#F7F9F5', '#E7EFE6']} style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="arrow-left" size={22} color="#2D5A27" />
          </TouchableOpacity>
          <Text style={styles.title}>Sikca Sorulan Sorular</Text>
          <View style={styles.placeholderRight} />
        </View>

        <View style={styles.contentCard}>
          <Icon name="information-outline" size={34} color="#2D5A27" />
          <Text style={styles.contentTitle}>Bu sayfa hazirlaniyor</Text>
          <Text style={styles.contentText}>
            Uygulamanin kullanim adimlari ve ozellik aciklamalari yakinda burada yer alacak.
          </Text>
        </View>
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
    paddingBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#2D5A27',
  },
  placeholderRight: {
    width: 36,
    height: 36,
  },
  contentCard: {
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#DDE6D9',
    alignItems: 'center',
  },
  contentTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5A27',
  },
  contentText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4F5F4D',
    textAlign: 'center',
    lineHeight: 21,
  },
});

export default FaqScreen;
