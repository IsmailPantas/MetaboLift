import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ExercisePlanScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Egzersiz Plani</Text>
      <Text style={styles.subtitle}>Bu ekran duzenlenmek uzere hazirlandi.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9F5',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D5A27',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
  },
});

export default ExercisePlanScreen;
