/**
 * ChapterHadithsScreen — hadith list for one chapter.
 *
 * Visual philosophy:
 *   - Dark blue header with chapter title (reference screenshot 2/3)
 *   - Each row is large, clean, tappable — feels like a book table of contents
 *   - Arabic text is the primary visible content
 *   - English translation is secondary/truncated
 *   - Audio indicator dot if audio exists (no confusing disabled player in list)
 *   - Bookmark icon is small but visible
 *   - Full row is tappable to open hadith detail
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

  const { data: chapter, loading: chapterLoading, error: chapterError } =
    useDbQuery(() => getChapterById(id), [id]);

  const {
    data: hadiths,
    loading: hadithsLoading,
    error: hadithsError,
    refetch,
  } = useDbQuery(() => getHadithsByChapter(id), [id]);

  const loading = chapterLoading || hadithsLoading;
  const error   = chapterError  || hadithsError;

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError onRetry={refetch} />;

  return (
    <View style={styles.root}>
      <DarkHeader
        onBack={() => router.back()}
        title={chapter?.english_title ?? 'Chapter'}
        titleArabic={chapter?.arabic_title}
      />

      <FlatList
        data={hadiths}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HadithRow
            hadith={item}
            onPress={() => router.push(`/hadith/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No hadiths in this chapter"
            subtitle="Content will appear here once it is available."
          />
        }
        contentContainerStyle={
          hadiths?.length === 0 ? styles.emptyContainer : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── HadithRow ────────────────────────────────────────────────────────────────

function HadithRow({ hadith, onPress }) {
  const { currentAudio, isPlaying, loadAudio, pause } = useAudio();

  const [bookmarked, setBookmarked]   = useState(false);
  const [firstAudio, setFirstAudio]   = useState(undefined);

  // Load bookmark state
  useEffect(() => {
    let cancelled = false;
    isBookmarked(hadith.id).then((v) => { if (!cancelled) setBookmarked(v); });
    return () => { cancelled = true; };
  }, [hadith.id]);

  // Load audio record lazily
  useEffect(() => {
    let cancelled = false;
    getAudiosForHadith(hadith.id)
      .then((rows) => { if (!cancelled) setFirstAudio(rows[0] ?? null); })
      .catch(() => { if (!cancelled) setFirstAudio(null); });
    return () => { cancelled = true; };
  }, [hadith.id]);

  const hasAudio = !!firstAudio;
  const isThisPlaying = isPlaying && currentAudio?.id === firstAudio?.id && hasAudio;

  const toggleBookmark = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      if (bookmarked) { await removeBookmark(hadith.id); setBookmarked(false); }
      else            { await addBookmark(hadith.id);    setBookmarked(true);  }
    } catch (err) {
      console.error('[HadithRow] bookmark error:', err);
    }
  }, [bookmarked, hadith.id]);

  const handleAudioPress = useCallback((e) => {
    e?.stopPropagation?.();
    if (!firstAudio) return;
    if (isThisPlaying) pause();
    else loadAudio(firstAudio, firstAudio.position_ms ?? 0);
  }, [firstAudio, isThisPlaying, loadAudio, pause]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Hadith ${hadith.hadith_number}`}
      accessibilityHint="Opens full hadith"
    >
      {/* Left: hadith number */}
      <View style={styles.numCol}>
        <Text style={styles.numText}>{hadith.hadith_number}</Text>
      </View>

      {/* Centre: text */}
      <View style={styles.textCol}>
        <Text
          style={styles.arabicText}
          numberOfLines={3}
          accessibilityLanguage="ar"
        >
          {hadith.arabic_text}
        </Text>
        <Text style={styles.englishText} numberOfLines={2}>
          {hadith.english_text}
        </Text>
      </View>

      {/* Right: action icons stacked */}
      <View style={styles.actionsCol}>
        {/* Audio button */}
        {firstAudio !== undefined && (
          <TouchableOpacity
            style={[styles.iconBtn, !hasAudio && styles.iconBtnDisabled]}
            onPress={hasAudio ? handleAudioPress : undefined}
            disabled={!hasAudio}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isThisPlaying ? 'Pause audio' : 'Play audio'}
            accessibilityState={{ disabled: !hasAudio }}
          >
            <View style={[styles.audioDot, isThisPlaying && styles.audioDotPlaying]} />
            <Text style={[styles.iconBtnText, !hasAudio && styles.iconBtnTextDisabled]}>
              {isThisPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bookmark button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={toggleBookmark}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
        >
          <Text style={[styles.bookmarkIcon, bookmarked && styles.bookmarkIconActive]}>
            {bookmarked ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundWarm,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  emptyContainer: { flex: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 80,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    minHeight: 80,
  },

  // Left column: hadith number
  numCol: {
    width: 44,
    alignItems: 'center',
    paddingTop: 3,
    flexShrink: 0,
  },
  numText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // Centre column: Arabic + English
  textCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  arabicText: {
    fontSize: 18,
    lineHeight: 32,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  englishText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
  },

  // Right column: icons
  actionsCol: {
    width: 36,
    alignItems: 'center',
    paddingTop: 2,
    gap: spacing.sm,
  },
  iconBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: { opacity: 0.25 },
  iconBtnText: {
    fontSize: 16,
    color: colors.primary,
  },
  iconBtnTextDisabled: {
    color: colors.textMuted,
  },
  // Small dot above audio icon when audio is available
  audioDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
    marginBottom: 2,
  },
  audioDotPlaying: {
    backgroundColor: colors.gold,
  },
  bookmarkIcon: {
    fontSize: 20,
    color: colors.textMuted,
  },
  bookmarkIconActive: {
    color: colors.gold,
  },
});
