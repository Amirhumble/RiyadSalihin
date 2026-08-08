import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { useAudio } from '@/context/AudioContext';
import {
    addBookmark,
    isBookmarked,
    removeBookmark,
} from '@/database/repositories/bookmarkRepository';
import { getChapterById } from '@/database/repositories/chapterRepository';
import {
    getAudiosForHadith,
    getHadithsByChapter,
} from '@/database/repositories/hadithRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

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
  const error = chapterError || hadithsError;

  if (loading) return <ScreenLoader />;
  if (error) return <ScreenError message={error.message} onRetry={refetch} />;

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

// ─── HadithCard ──────────────────────────────────────────────────────────────
//
// Each card loads its own audio record lazily (only the first one).
// Audio playback is routed through the global AudioContext so there is
// never more than one active player in the application.

function HadithCard({ hadith, onPress }) {
  const { currentAudio, isPlaying, loadAudio, pause } = useAudio();

  const [bookmarked, setBookmarked] = useState(false);
  // First audio record linked to this hadith, or null.
  const [firstAudio, setFirstAudio] = useState(undefined); // undefined = not yet fetched

  // ── Load bookmark state ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    isBookmarked(hadith.id).then((val) => {
      if (!cancelled) setBookmarked(val);
    });
    return () => { cancelled = true; };
  }, [hadith.id]);

  // ── Load audio record lazily ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getAudiosForHadith(hadith.id)
      .then((rows) => {
        if (!cancelled) setFirstAudio(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setFirstAudio(null);
      });
    return () => { cancelled = true; };
  }, [hadith.id]);

  // ── Derived audio state ─────────────────────────────────────────────
  const isThisAudioPlaying =
    isPlaying && currentAudio?.id === firstAudio?.id && !!firstAudio;

  // ── Handlers ───────────────────────────────────────────────────────
  const toggleBookmark = useCallback(
    async (e) => {
      e?.stopPropagation?.();
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
    },
    [bookmarked, hadith.id]
  );

  const handleAudioPress = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!firstAudio) return;
      if (isThisAudioPlaying) {
        pause();
      } else {
        loadAudio(firstAudio, firstAudio.position_ms ?? 0);
      }
    },
    [firstAudio, isThisAudioPlaying, loadAudio, pause]
  );

  // Audio button state:
  //   undefined = still fetching record → show dimmed icon
  //   null      = no audio for this hadith → show dimmed icon
  //   record    = available → show active icon; playing = pause icon
  const hasAudio = !!firstAudio;
  const audioIcon = isThisAudioPlaying ? '⏸' : '🎧';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Hadith ${hadith.hadith_number}`}
      accessibilityHint="Opens full hadith"
    >
      {/* ── Top row: number + actions ─────────────────────────── */}
      <View style={styles.cardTopRow}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadgeText}>{hadith.hadith_number}</Text>
        </View>

        <View style={styles.actions}>
          {/* Audio button */}
          <TouchableOpacity
            style={[styles.actionBtn, !hasAudio && styles.actionBtnDisabled]}
            onPress={hasAudio ? handleAudioPress : undefined}
            disabled={!hasAudio}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={
              !hasAudio
                ? 'No audio available'
                : isThisAudioPlaying
                ? 'Pause audio'
                : 'Play audio'
            }
            accessibilityState={{ disabled: !hasAudio }}
          >
            <Text style={styles.actionIcon}>{audioIcon}</Text>
          </TouchableOpacity>

          {/* Bookmark button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={toggleBookmark}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Text style={styles.actionIcon}>
              {bookmarked ? '🔖' : '🏷️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Arabic text ──────────────────────────────────────── */}
      <Text
        style={styles.arabicText}
        numberOfLines={4}
        accessibilityLanguage="ar"
      >
        {hadith.arabic_text}
      </Text>

      {/* ── Divider ──────────────────────────────────────────── */}
      <View style={styles.inlineDivider} />

      {/* ── English translation ──────────────────────────────── */}
      <Text style={styles.englishText} numberOfLines={3}>
        {hadith.english_text}
      </Text>

      {/* ── Read more ────────────────────────────────────────── */}
      <Text style={styles.readMore}>Read full hadith ›</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  backButton: { minWidth: 64 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
  headerTitleGroup: { flex: 1, alignItems: 'center' },
  headerArabic: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  headerEnglish: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },

  // List
  list: { padding: spacing.md },
  emptyContainer: { flex: 1 },
  separator: { height: spacing.sm },

  // Card
  card: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Card top row
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  numberBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  numberBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    padding: spacing.xs,
    borderRadius: 6,
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: { opacity: 0.3 },
  actionIcon: { fontSize: 19 },

  // Arabic
  arabicText: {
    fontSize: 19,
    lineHeight: 36,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.sm,
  },

  // Divider
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginBottom: spacing.sm,
  },

  // English
  englishText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily,
  },

  // Read more
  readMore: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'right',
  },
});
