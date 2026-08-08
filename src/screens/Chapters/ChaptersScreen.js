import { useRouter } from 'expo-router';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/common/EmptyState';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { getAllChaptersWithCounts } from '@/database/repositories/chapterRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function ChaptersScreen() {
  const router = useRouter();

  const {
    data: chapters,
    loading,
    error,
    refetch,
  } = useDbQuery(() => getAllChaptersWithCounts(), []);

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError message={error.message} onRetry={refetch} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chapters</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ChapterRow
            chapter={item}
            onPress={() => router.push(`/chapter/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No chapters yet"
            subtitle="Content will appear here once the database is populated."
          />
        }
        contentContainerStyle={
          chapters?.length === 0 ? styles.emptyContainer : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ─── ChapterRow ───────────────────────────────────────────────────────────────

function ChapterRow({ chapter, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Chapter ${chapter.chapter_number}: ${chapter.english_title}`}
      accessibilityHint="Opens hadith list for this chapter"
    >
      {/* Chapter number circle */}
      <View style={styles.chapterNumberCircle}>
        <Text style={styles.chapterNumberText}>{chapter.chapter_number}</Text>
      </View>

      {/* Text content */}
      <View style={styles.chapterInfo}>
        <Text
          style={styles.arabicTitle}
          numberOfLines={2}
          accessibilityLanguage="ar"
        >
          {chapter.arabic_title}
        </Text>
        <Text style={styles.englishTitle} numberOfLines={2}>
          {chapter.english_title}
        </Text>
        {chapter.hadith_count != null && (
          <View style={styles.countRow}>
            <Text style={styles.hadithCount}>
              {chapter.hadith_count}{' '}
              {chapter.hadith_count === 1 ? 'hadith' : 'hadiths'}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  backButton: { minWidth: 64 },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  // List
  list: { paddingVertical: spacing.xs },
  emptyContainer: { flex: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: spacing.md + 52,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    minHeight: 72,
  },

  // Chapter number circle
  chapterNumberCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  // Text content
  chapterInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  arabicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: 3,
  },
  englishTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    marginBottom: 3,
  },
  countRow: {
    flexDirection: 'row',
  },
  hadithCount: {
    fontSize: 11,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },

  // Chevron
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    flexShrink: 0,
  },
});
