/**
 * IntroScreen — branded cover screen shown once on cold launch.
 *
 * Automatically navigates to /list after INTRO_DURATION_MS.
 * router.replace() is used so back never returns here.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

const INTRO_DURATION_MS = 2600;

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/list'), INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      {/* Subtle corner rings — pure RN shapes, no images */}
      <View style={styles.ringTopRight} pointerEvents="none" />
      <View style={styles.ringTopRightSmall} pointerEvents="none" />
      <View style={styles.ringBottomLeft} pointerEvents="none" />

      {/* Gold top & bottom rules */}
      <View style={styles.goldRuleTop} pointerEvents="none" />
      <View style={styles.goldRuleBottom} pointerEvents="none" />

      {/* Centre content */}
      <View style={styles.content}>
        <Text style={styles.arabicTitle}>رياض الصالحين</Text>

        <View style={styles.goldDivider} />

        <Text style={styles.latinTitle}>Riyad as-Salihin</Text>
        <Text style={styles.subtitle}>Gardens of the Righteous</Text>

        <Text style={styles.author}>
          Imam Yahya ibn Sharaf al-Nawawi
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Decorative rings
  ringTopRight: {
    position: 'absolute',
    top: -130,
    right: -130,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ringTopRightSmall: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ringBottomLeft: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Gold rules
  goldRuleTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.6,
  },
  goldRuleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.6,
  },

  // Content
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  arabicTitle: {
    fontSize: 54,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 2,
    marginBottom: spacing.lg,
    lineHeight: 68,
  },
  goldDivider: {
    width: 64,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
    marginBottom: spacing.lg,
    opacity: 0.85,
  },
  latinTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 2.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.xl + spacing.sm,
  },
  author: {
    fontSize: 13,
    color: colors.heroMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
});
