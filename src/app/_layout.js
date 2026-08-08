import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, DB_STATUS, useAppContext } from '@/context/AppContext';
import { AudioProvider } from '@/context/AudioContext';

SplashScreen.preventAutoHideAsync();

/**
 * AppShell sits inside AppProvider so it can read DB status.
 * AudioProvider is nested inside here — it will only mount once the DB
 * is ready, which is the correct moment to configure the audio session.
 */
function AppShell() {
  const { dbStatus, dbError, retryInit } = useAppContext();

  useEffect(() => {
    if (dbStatus === DB_STATUS.READY || dbStatus === DB_STATUS.ERROR) {
      SplashScreen.hideAsync();
    }
  }, [dbStatus]);

  if (dbStatus === DB_STATUS.IDLE || dbStatus === DB_STATUS.LOADING) {
    return null; // splash screen still visible
  }

  if (dbStatus === DB_STATUS.ERROR) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Failed to open database</Text>
        <Text style={styles.errorMessage}>{dbError?.message}</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryBtn}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // DB is ready — mount AudioProvider and the navigation stack together.
  return (
    <AudioProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AudioProvider>
  );
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
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#1B6CA8',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
