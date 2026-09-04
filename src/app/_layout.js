import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import { AppProvider, DB_STATUS, useAppContext } from '@/context/AppContext';
import { AudioProvider } from '@/context/AudioContext';
import { PdfSessionProvider } from '@/context/PdfSessionContext';

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { dbStatus, dbError, retryInit } = useAppContext();

  useEffect(() => {
    if (dbStatus === DB_STATUS.READY || dbStatus === DB_STATUS.ERROR) {
      SplashScreen.hideAsync();
    }
  }, [dbStatus]);

  // Keep native splash visible while the database is initialising
  if (dbStatus === DB_STATUS.IDLE || dbStatus === DB_STATUS.LOADING) {
    return null;
  }

  if (dbStatus === DB_STATUS.ERROR) {
    if (dbError) console.error('[AppShell] DB init error:', dbError);
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorIcon}>📖</Text>
        <Text style={styles.errorTitle}>
          Something went wrong while opening the book.
        </Text>
        <Text style={styles.errorMsg}>Please try again.</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryBtn} activeOpacity={0.8}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AudioProvider>
      <PdfSessionProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="list" options={{ animation: 'fade' }} />
          <Stack.Screen name="downloads" options={{ animation: 'slide_from_right' }} />
          {/* Fade keeps the persistent Pdf host aligned with the slot.
              slide_from_bottom left the native view at the final frame
              while the chrome was still animating. */}
          <Stack.Screen
            name="reader"
            options={{
              animation: 'fade',
              contentStyle: { backgroundColor: colors.backgroundSecondary },
            }}
          />
        </Stack>
      </PdfSessionProvider>
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
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorIcon: { fontSize: 44, marginBottom: 16 },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  retryText: { color: colors.textInverse, fontSize: 16, fontWeight: '600' },
});
