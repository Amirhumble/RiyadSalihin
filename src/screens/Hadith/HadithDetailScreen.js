import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import {
    addBookmark,
    isBookmarked,
    removeBookmark,
} from '@/database/repositories/bookmarkRepository';
import { getChapterById } from '@/database/repositories/chapterRepository';
import {
    getAdjacentHadiths,
    getHadithById,
} from '@/database/repositories/hadithRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function HadithDetailScreen() {
  const router = useRouter();
  const { hadithId } = useLocalSearchParams();
  const id = Number(hadithId);

  const {
    data: hadith,
    loading: hadithLoading,
    error: hadithError,
    refetch,
  } = useDbQuery(() => getHadithById(id), [id]);

  const { data: adjacent } = useDbQuery(
    () => getAdjacentHadiths(id),
    [id]
  );

  const { data: chapter } = useDbQuery(
    () => (hadith?.chapter_id ? getChapterById(hadith.chapter_id) : Promise.resolve(null)),
    [hadith?.chapter_id]
  );

  const [bookmarked, setBookmarked] = useState(false);

  // Sync bookmark state when hadith loads or changes.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    isBookmarked(id).then((val) => {
      if (!cancelled) setBookmarked(val);
    });
    return () => { cancelled = true; };
  }, [id]);

  const toggleBookmark = useCallback(async () => {
    try {
      if (bookmarked) {
        await removeBookmark(id);
        setBookmarked(false);
      } else {
        await addBookmark(id);
        setBookmarked(true);
      }
    } catch (err) {
      console.error('[HadithDetail] bookmark error:', err);
    }
  }, [bookmarked, id]);

  if (hadithLoading) return <ScreenLoader />;
  if (hadithError)   return <ScreenError message={hadithError.message} onRetry={refetch} />;
  if (!hadith) {
    return <ScreenError message="Hadith not found." />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Hadith {hadith.hadith_number}
        </Text>

        <TouchableOpacity
          style={styles.headerSide}
          onPress={toggleBookmark}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.bookmarkIcon}>{bookmarked ? '🔖' : '🏷️'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Chapter label */}
        {chapter && (
          <TouchableOpacity
            style={styles.chapterLabel}
            onPress={() => router.push(`/chapter/${chapter.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.chapterLabelText} numberOfLines={1}>
              {chapter.english_title}
            </Text>
            <Text style={styles.chapterLabelChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Hadith number badge */}
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadgeText}>
            Hadith {hadith.hadith_number}
          </Text>
        </View>

        {/* Arabic text */}
        <View style={styles.arabicBlock}>
          <Text style={styles.arabicText}>{hadith.arabic_text}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* English translation */}
        <Text style={styles.englishText}>{hadith.english_text}</Text>

        {/* Audio placeholder */}
        <View style={styles.audioPlaceholder}>
          <Text style={styles.audioIcon}>🎧</Text>
          <View>
            <Text style={styles.audioTitle}>Audio Recitation</Text>
            <Text style={styles.audioSub}>Coming soon</Text>
          </View>
        </View>

        {/* Bookmark action */}
        <TouchableOpacity
          style={[styles.bookmarkButton, bookmarked && styles.bookmarkButtonActive]}
          onPress={toggleBookmark}
          activeOpacity={0.75}
        >
          <Text style={[styles.bookmarkButtonText, bookmarked && styles.bookmarkButtonTextActive]}>
            {bookmarked ? '🔖  Bookmarked' : '🏷️  Add Bookmark'}
          </Text>
        </TouchableOpacity>

        {/* Prev / Next navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navButton, !adjacent?.prev && styles.navButtonDisabled]}
            disabled={!adjacent?.prev}
            onPress={() => adjacent?.prev && router.replace(`/hadith/${adjacent.prev.id}`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.navText, !adjacent?.prev && styles.navTextDisabled]}>
              ‹ Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, !adjacent?.next && styles.navButtonDisabled]}
            disabled={!adjacent?.next}
            onPress={() => adjacent?.next && router.replace(`/hadith/${adjacent.next.id}`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.navText, !adjacent?.next && styles.navTextDisabled]}>
              Next ›
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  headerSide: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  bookmarkIcon: {
    fontSize: 20,
  },

  // Scroll
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Chapter label
  chapterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chapterLabelText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  chapterLabelChevron: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 2,
  },

  // Number badge
  numberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  numberBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // Arabic
  arabicBlock: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  arabicText: {
    fontSize: 22,
    lineHeight: 40,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },

  // English
  englishText: {
    fontSize: 15,
    lineHeight: 26,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Audio placeholder
  audioPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    opacity: 0.6,
  },
  audioIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  audioSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Bookmark button
  bookmarkButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bookmarkButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  bookmarkButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  bookmarkButtonTextActive: {
    color: colors.primary,
  },

  // Prev/next nav
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  navTextDisabled: {
    color: colors.textMuted,
  },
});
