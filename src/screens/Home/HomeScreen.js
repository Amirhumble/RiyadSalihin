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
import typography from '@/constants/typography';
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
        {/* ── Branding ──────────────────────────────────────────── */}
        <View style={styles.brandBlock}>
          <Text style={styles.arabicTitle}>رياض الصالحين</Text>
          <Text style={styles.latinTitle}>Riyad as-Salihin</Text>
          <Text style={styles.subtitle}>
            Gardens of the Righteous
          </Text>
          <Text style={styles.description}>
            Compiled by Imam Yahya ibn Sharaf al-Nawawi
          </Text>
        </View>

        {/* ── Search ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/search')}
          activeOpacity={0.8}
          accessibilityRole="search"
          accessibilityLabel="Search hadiths"
          accessibilityHint="Opens the search screen"
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search hadiths…</Text>
        </TouchableOpacity>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            value={chapterCount}
            label="Chapters"
            icon="📚"
          />
          <View style={styles.statDivider} />
          <StatCard
            value={hadithCount}
            label="Hadiths"
            icon="📜"
          />
        </View>

        {/* ── Browse chapters ───────────────────────────────────── */}
        <TouchableOpacity
          style={styles.primaryCard}
          onPress={() => router.push('/chapters')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Browse chapters"
          accessibilityHint="Opens the chapters list"
        >
          <View style={styles.primaryCardInner}>
            <View style={styles.primaryCardIconWrap}>
              <Text style={styles.primaryCardIcon}>📖</Text>
            </View>
            <View style={styles.primaryCardText}>
              <Text style={styles.primaryCardTitle}>Browse Chapters</Text>
              <Text style={styles.primaryCardSub}>
                Read hadiths organised by chapter
              </Text>
            </View>
            <Text style={styles.primaryCardChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Bookmarks shortcut ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => router.push('/(tabs)/bookmarks')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="View bookmarks"
        >
          <Text style={styles.secondaryCardIcon}>🔖</Text>
          <View style={styles.secondaryCardText}>
            <Text style={styles.secondaryCardTitle}>Bookmarks</Text>
            <Text style={styles.secondaryCardSub}>
              Your saved hadiths
            </Text>
          </View>
          <Text style={styles.secondaryCardChevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statNumber}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Branding
  brandBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  arabicTitle: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    letterSpacing: 1,
  },
  latinTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: {
    fontSize: 15,
    color: colors.textMuted,
    flex: 1,
    fontFamily: typography.fontFamily,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
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
  },

  // Primary card (Browse Chapters)
  primaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  primaryCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  primaryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primaryCardIcon: { fontSize: 22 },
  primaryCardText: { flex: 1 },
  primaryCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  primaryCardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  primaryCardChevron: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.6)',
  },

  // Secondary card (Bookmarks)
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  secondaryCardIcon: { fontSize: 22 },
  secondaryCardText: { flex: 1 },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  secondaryCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  secondaryCardChevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
});
