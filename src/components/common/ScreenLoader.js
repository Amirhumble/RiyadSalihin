import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

function SkeletonRow() {
  return (
    <View style={styles.skelRow}>
      <View style={styles.skelBadge} />
      <View style={styles.skelInfo}>
        <View style={[styles.skelLine, styles.skelTitle]} />
        <View style={[styles.skelLine, styles.skelMeta]} />
      </View>
      <View style={styles.skelPlay} />
    </View>
  );
}

export default function ScreenLoader({ message = 'Loading…', variant = 'default' }) {
  if (variant === 'lessons') {
    return (
      <View style={styles.lessonsRoot}>
        <SafeAreaView style={styles.headerSafe} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerGoldRule} />
            <Text style={styles.headerArabic}>رياض الصالحين</Text>
            <Text style={styles.headerLatin}>Riyad as-Salihin</Text>
            <View style={styles.headerDivider} />
            <View style={styles.openingRow}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={styles.headerMessage}>{message}</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.skelList}>
          <SkeletonRow />
          <View style={styles.skelSep} />
          <SkeletonRow />
          <View style={styles.skelSep} />
          <SkeletonRow />
          <View style={styles.skelSep} />
          <SkeletonRow />
          <View style={styles.skelSep} />
          <SkeletonRow />
          <View style={styles.skelSep} />
          <SkeletonRow />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
  },
  lessonsRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafe: {
    backgroundColor: colors.hero,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerGoldRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.55,
  },
  headerArabic: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  headerLatin: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 2,
  },
  headerDivider: {
    width: 36,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.5,
    marginVertical: spacing.sm,
    borderRadius: 1,
  },
  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 20,
  },
  headerMessage: {
    fontSize: 12,
    color: colors.heroMuted,
    letterSpacing: 0.3,
  },
  skelList: {
    paddingTop: spacing.sm,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 76,
  },
  skelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    marginRight: spacing.md,
  },
  skelInfo: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 8,
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.backgroundSecondary,
  },
  skelTitle: {
    width: '72%',
    height: 12,
  },
  skelMeta: {
    width: '44%',
  },
  skelPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  skelSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 72 + spacing.md,
  },
});
