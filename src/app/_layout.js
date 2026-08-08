import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, DB_STATUS, useAppContext } from '@/context/AppContext';

SplashScreen.preventAutoHideAsync();

/**
 * Inner component — can safely call useAppContext because it is rendered
 * inside AppProvider.
 */
function AppShell() {
  const { dbStatus, dbError, retryInit } = useAppContext();

  // Hide the splash screen once the database is ready (or failed).
  useEffect(() => {
    if (dbStatus === DB_STATUS.READY || dbStatus === DB_STATUS.ERROR) {
      SplashScreen.hideAsync();
    }
  }, [dbStatus]);

  if (dbStatus === DB_STATUS.IDLE || dbStatus === DB_STATUS.LOADING) {
    // Splash screen is still visible — render nothing behind it.
    return null;
  }

  if (dbStatus === DB_STATUS.ERROR) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Failed to open database</Text>
        <Text style={styles.errorMessage}>{dbError?.message}</Text>
        <Text style={styles.retryButton} onPress={retryInit}>
          Tap to retry
        </Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    fontSize: 16,
    color: '#1B6CA8',
    fontWeight: '600',
  },
});
