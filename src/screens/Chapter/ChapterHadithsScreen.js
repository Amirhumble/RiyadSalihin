import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { addBookmark, isBookmarked, removeBookmark } from '@/database/repositories/bookmarkRepository';
import { getChapterById } from '@/database/repositories/chapterRepository';
import { getHadithsByChapter } from '@/database/repositories/hadithRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useCallback, useEffect, useState } from 'react';

export default function ChapterHadithsScreen() {
  const router = useRouter();
  const { chapterId } = useLocalSearchParams();
  const id = Number(chapterId);

  const {
    data: chapter,
    loading: chapterLoading,
    error: chapterError,
  } = useDbQuery(() => getChapterById(id), [id]);

  const {
    data: hadiths,
    loading: hadithsLoading,
    error: hadithsError,
    refetch,
  } = useDbQuery(() => getHadithsByChapter(id), [id]);

  const loading = chapterLoading || hadithsLoading;
  const error   = chapterError  || hadithsError;

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError message={error.message} onRetry={refetch} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          {chapter && (
            <>
              <Text style={styles.headerArabic} numberOfLines={1}>
                {chapter.arabic_title}
              </Text>
              <Text style={styles.headerEnglish} numberOfLines={1}>
                {chapter.english_title}
              </Text>
            </>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={hadiths}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HadithCard
            hadith={item}
            onPress={() => router.push(`/hadith/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📜"
            title="No hadiths in this chapter"
            subtitle="Content will appear here once the database is populated."
          />
        }
        contentContainerStyle={
          hadiths?.length === 0 ? styles.emptyContainer : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function HadithCard({ hadith, onPress }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBookmarked(hadith.id).then((val) => {
      if (!cancelled) setBookmarked(val);
    });
    return () => { cancelled = true; };
  }, [hadith.id]);

  const toggleBookmark = useCallback(async (e) => {
    e.stopPropagation?.();
    try {
      if (bookmarked) {
        await removeBookmark(hadith.id);
        setBookmarked(false);
      } else {
        await addBookmark(hadith.id);
        setBookmarked(true);
      }
    } catch (err) {
      console.error('[HadithCard] bookmark error:', err);
    }
  }, [bookmarked, hadith.id]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Number + actions row */}
      <View style={styles.cardTopRow}>
        <View style={styles.hadithNumberBadge}>
          <Text style={styles.hadithNumberText}>{hadith.hadith_number}</Text>
        </View>
        <View style={styles.cardActions}>
          {/* Audio placeholder */}
          <TouchableOpacity style={[styles.iconButton, styles.audioButton]} disabled>
            <Text style={styles.iconButtonText}>🎧</Text>
          </TouchableOpacity>
          {/* Bookmark */}
          <TouchableOpacity style={styles.iconButton} onPress={toggleBookmark} activeOpacity={0.7}>
            <Text style={styles.iconButtonText}>{bookmarked ? '🔖' : '🏷️'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Arabic text */}
      <Text style={styles.arabicText}>{hadith.arabic_text}</Text>

      {/* English translation */}
      <Text style={styles.englishText} numberOfLines={3}>{hadith.english_text}</Text>

      <Text style={styles.readMore}>Read full hadith ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
  },
  headerArabic: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    writingDirection: 'rtl',
  },
  headerEnglish: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },

  // List
  list: {
    padding: spacing.md,
  },
  emptyContainer: {
    flex: 1,
  },
  separator: {
    height: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  hadithNumberBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  hadithNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.xs,
  },
  audioButton: {
    opacity: 0.35,
  },
  iconButtonText: {
    fontSize: 18,
  },

  // Text
  arabicText: {
    fontSize: 18,
    lineHeight: 32,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'System',
    marginBottom: spacing.sm,
  },
  englishText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  readMore: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'right',
  },
});
