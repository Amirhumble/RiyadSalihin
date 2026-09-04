import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TelegramCta from '@/components/common/TelegramCta';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { preparePdfAsset } from '@/services/pdfAsset';

const INTRO_DURATION_MS = 4000;

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // replace() so the back button never returns to intro
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/list'), INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  // Start copying the bundled PDF during the intro (file only — no <Pdf> mount).
  useEffect(() => {
    preparePdfAsset().catch(() => {});
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      <View style={styles.ringTopRight} pointerEvents="none" />
      <View style={styles.ringTopRightSmall} pointerEvents="none" />
      <View style={styles.ringBottomLeft} pointerEvents="none" />

      <View style={styles.accentRuleTop} pointerEvents="none" />
      <View style={styles.accentRuleBottom} pointerEvents="none" />

      <View style={styles.content}>
        <Text style={styles.kicker}>Gardens of the Righteous</Text>
        <Text style={styles.arabicTitle}>رياض الصالحين</Text>
        <View style={styles.accentDivider} />
        <Text style={styles.latinTitle}>Riyad as-Salihin</Text>
        <Text style={styles.author}>Imam Yahya ibn Sharaf al-Nawawi</Text>
        <Text style={styles.teacherLabel}>Taught by</Text>
        <Text style={styles.teacher}>በሸይኽ ሙሀመድ አሚን ኢድሪስ</Text>
      </View>

      <View style={styles.footer}>
        <TelegramCta variant="hero" />
        <View style={styles.openingRow}>
          <View style={styles.openingDots}>
            <View style={[styles.dot, styles.dotOn]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.openingText}>Opening lessons</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  ringTopRight: {
    position: 'absolute',
    top: -130,
    right: -130,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: colors.heroRing,
  },
  ringTopRightSmall: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: colors.heroRingMuted,
  },
  ringBottomLeft: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: colors.heroRingMuted,
  },
  accentRuleTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.heroAccent,
    opacity: 0.35,
  },
  accentRuleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.heroAccent,
    opacity: 0.35,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  kicker: {
    fontSize: 12,
    color: colors.heroAccent,
    textAlign: 'center',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  arabicTitle: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 2,
    marginBottom: spacing.md,
    lineHeight: 66,
  },
  accentDivider: {
    width: 56,
    height: 2,
    backgroundColor: colors.heroAccent,
    borderRadius: 1,
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  latinTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 2.2,
    marginBottom: spacing.sm,
  },
  author: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
    marginBottom: spacing.xl,
  },
  teacherLabel: {
    fontSize: 11,
    color: colors.heroMuted,
    textAlign: 'center',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  teacher: {
    fontSize: 18,
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 20,
  },
  openingDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.heroBorder,
  },
  dotOn: {
    backgroundColor: colors.heroAccent,
  },
  openingText: {
    fontSize: 12,
    color: colors.heroMuted,
    letterSpacing: 0.4,
  },
});
