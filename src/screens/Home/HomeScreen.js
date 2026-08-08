import { useRouter } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { getChapterCount } from '@/database/repositories/chapterRepository';
import { getHadithCount } from '@/database/repositories/hadithRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function HomeScreen() {
  const router = useRouter();

  const { data: chapterCount } = useDbQuery(() => getChapterCount(), []);
  const { data: hadithCount  } = useDbQuery(() => getHadithCount(),  []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.arabicTitle}>رياض الصالحين</Text>
          <Text style={styles.latinTitle}>Riyad as-Salihin</Text>
          <Text style={styles.description}>
            Gardens of the Righteous — a collection of hadiths compiled
            by Imam al-Nawawi.
          </Text>
        </View>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {chapterCount ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Chapters</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {hadithCount ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Hadiths</Text>
          </View>
        </View>

        {/* ── Browse card ────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.browseCard}
          onPress={() => router.push('/chapters')}
          activeOpacity={0.75}
        >
          <View style={styles.browseCardInner}>
            <Text style={styles.browseIcon}>📖</Text>
            <View style={styles.browseTextGroup}>
              <Text style={styles.browseTitle}>Browse Chapters</Text>
              <Text style={styles.browseSubtitle}>
                Read hadiths organised by chapter
              </Text>
            </View>
            <Text style={styles.browseChevron}>›</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: spacing.lg,
  },
  arabicTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  latinTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Browse card
  browseCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  browseCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  browseIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  browseTextGroup: {
    flex: 1,
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  browseSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  browseChevron: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: spacing.sm,
  },
});
