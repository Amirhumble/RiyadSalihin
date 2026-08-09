/**
 * HomeScreen — Islamic book identity + primary navigation.
 *
 * Visual philosophy:
 *   - Full-width dark-blue hero with Arabic title, transliteration,
 *     subtitle and author (inspired by reference screenshot 1)
 *   - Clean white section below with large, obvious action buttons
 *   - No developer-style statistics or dashboard cards
 *   - Non-technical: every element communicates "Islamic reading app"
 */

import { useRouter } from 'expo-router';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

export default function HomeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ────────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          {/* Decorative arcs — built from React Native shapes, no images */}
          <View style={styles.decArcOuter} pointerEvents="none" />
          <View style={styles.decArcInner} pointerEvents="none" />
          <View style={styles.decBottomBar} pointerEvents="none" />

          {/* Identity */}
          <Text style={styles.arabicTitle}>رياض الصالحين</Text>
          <Text style={styles.latinTitle}>Riyad as-Salihin</Text>
          <View style={styles.goldDivider} />
          <Text style={styles.subtitle}>Gardens of the Righteous</Text>
          <Text style={styles.author}>
            Imam Yahya ibn Sharaf al-Nawawi
          </Text>
        </View>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          {/* Primary — Read / Browse Chapters */}
          <ActionButton
            label="Browse Chapters"
            sublabel="Start reading"
            onPress={() => router.push('/chapters')}
            primary
            accessibilityLabel="Browse chapters"
          />

          {/* Secondary row */}
          <View style={styles.secondaryRow}>
            <ActionButton
              label="Bookmarks"
              onPress={() => router.push('/(tabs)/bookmarks')}
              flex
              accessibilityLabel="Saved hadiths"
            />
            <View style={styles.secondaryGap} />
            <ActionButton
              label="Search"
              onPress={() => router.push('/search')}
              flex
              accessibilityLabel="Search hadiths"
            />
          </View>

          {/* Tertiary */}
          <ActionButton
            label="Read PDF"
            sublabel="Full book"
            onPress={() => router.push('/pdf')}
            accessibilityLabel="Read as PDF"
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({
  label,
  sublabel,
  onPress,
  primary,
  flex,
  accessibilityLabel,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        flex  && styles.actionBtnFlex,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text
        style={[
          styles.actionBtnLabel,
          primary && styles.actionBtnLabelPrimary,
        ]}
      >
        {label}
      </Text>
      {!!sublabel && (
        <Text
          style={[
            styles.actionBtnSub,
            primary && styles.actionBtnSubPrimary,
          ]}
        >
          {sublabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Hero ────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: colors.hero,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
    overflow: 'hidden',
  },

  // Decorative shapes — no images, no downloads
  decArcOuter: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  decArcInner: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  decBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.6,
  },

  arabicTitle: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  latinTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  goldDivider: {
    width: 60,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 15,
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: 13,
    color: colors.heroMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Actions ────────────────────────────────────────────────────────
  actionsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
  },
  secondaryGap: {
    width: spacing.md,
  },

  actionBtn: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 56,
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    paddingVertical: spacing.lg,
    minHeight: 64,
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  actionBtnLabelPrimary: {
    color: colors.heroText,
    fontSize: 18,
  },
  actionBtnSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  actionBtnSubPrimary: {
    color: colors.heroSubtext,
  },
});
