/**
 * ChaptersScreen — large-button chapter selection.
 *
 * Visual philosophy (reference screenshot 2):
 *   - Dark blue header with title
 *   - Large vertically-stacked chapter buttons
 *   - Immediate clarity: user knows to tap a chapter
 *   - Chapter number badge is prominent
 *   - Arabic title is the primary label
 *   - English title is secondary
 *   - Hadith count is small and unobtrusive
 */

import { useRouter } from 'expo-router';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import DarkHeader from '@/components/common/DarkHeader';
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

  const { data: chapters, loading, error, refetch } = useDbQuery(
    () => getAllChaptersWithCounts(),
    []
  );

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError onRetry={refetch} />;

  return (
    <View style={styles.root}>
      <DarkHeader
        onBack={() => router.back()}
        title="Chapters"
      />

      <FlatList
        data={chapters}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <ChapterButton
            chapter={item}
            index={index}
            onPress={() => router.push(`/chapter/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No chapters yet"
            subtitle="The book content will appear here."
          />
        }
        contentContainerStyle={
          chapters?.length === 0 ? styles.emptyContainer : styles.list
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── ChapterButton ────────────────────────────────────────────────────────────

function ChapterButton({ chapter, onPress }) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Chapter ${chapter.chapter_number}: ${chapter.english_title}`}
      accessibilityHint="Opens hadith list"
    >
      {/* Number badge */}
      <View style={styles.numBadge}>
        <Text style={styles.numText}>{chapter.chapter_number}</Text>
      </View>

      {/* Text */}
      <View style={styles.btnText}>
        <Text style={styles.arabicTitle} numberOfLines={2} accessibilityLanguage="ar">
          {chapter.arabic_title}
        </Text>
        <Text style={styles.englishTitle} numberOfLines={2}>
          {chapter.english_title}
        </Text>
        {chapter.hadith_count > 0 && (
          <Text style={styles.hadithCount}>
            {chapter.hadith_count} {chapter.hadith_count === 1 ? 'hadith' : 'hadiths'}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  list: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },

  // Chapter button — large, obvious, easy to tap
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  numBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(27,94,123,0.15)',
  },
  numText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },

  btnText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  arabicTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    lineHeight: 26,
    marginBottom: 3,
  },
  englishTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    lineHeight: 19,
    marginBottom: 2,
  },
  hadithCount: {
    fontSize: 11,
    color: colors.textMuted,
  },

  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    flexShrink: 0,
  },
});
