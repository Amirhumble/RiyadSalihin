/**
 * IntroScreen — book identity / cover screen.
 *
 * Shown once on cold launch, then automatically navigates to /list.
 * The user never returns to this screen through normal navigation.
 *
 * Visual design:
 *   Full-screen dark Islamic blue. Arabic title large and centred.
 *   Amharic subtitle. Author line. Decorative shapes from RN primitives.
 *   No buttons, no statistics, no technical content.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

const INTRO_DURATION_MS = 2600;

export default function IntroScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(() => {
      // replace so pressing "back" from the list never returns here
      router.replace('/list');
    }, INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      {/* Decorative corner arcs — built from RN shapes, no images */}
      <View style={styles.arcTopRight} pointerEvents="none" />
      <View style={styles.arcTopRightInner} pointerEvents="none" />
      <View style={styles.arcBottomLeft} pointerEvents="none" />

      {/* Gold top rule */}
      <View style={styles.goldRuleTop} pointerEvents="none" />

      {/* Centre content */}
      <View style={styles.content}>
        {/* Arabic title */}
        <Text style={styles.arabicTitle}>رياض الصالحين</Text>

        {/* Gold divider */}
        <View style={styles.goldDivider} />

        {/* Amharic / transliterated title */}
        <Text style={styles.amharicTitle}>Riyad as-Salihin</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Gardens of the Righteous</Text>

        {/* Author */}
        <Text style={styles.author}>
          Imam Yahya ibn Sharaf al-Nawawi
        </Text>
      </View>

      {/* Gold bottom rule */}
      <View style={styles.goldRuleBottom} pointerEvents="none" />
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

  // ── Decorative shapes ──────────────────────────────────────────────
  arcTopRight: {
    position: 'absolute',
    top: -140,
    right: -140,
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  arcTopRightInner: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  arcBottomLeft: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  goldRuleTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.55,
  },
  goldRuleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.55,
  },

  // ── Text content ───────────────────────────────────────────────────
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  arabicTitle: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 1.5,
    marginBottom: spacing.lg,
  },

  goldDivider: {
    width: 72,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
    marginBottom: spacing.lg,
  },

  amharicTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },

  subtitle: {
    fontSize: 15,
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
  },

  author: {
    fontSize: 13,
    color: colors.heroMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
});
