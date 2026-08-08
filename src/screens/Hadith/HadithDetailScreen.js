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

import AudioPlayer from '@/components/audio/AudioPlayer';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import ReadingSettingsPanel from '@/components/ui/ReadingSettingsPanel';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useReading } from '@/context/ReadingContext';
import {
    addBookmark,
    isBookmarked,
    removeBookmark,
} from '@/database/repositories/bookmarkRepository';
import { getChapterById } from '@/database/repositories/chapterRepository';
import {
    getAdjacentHadiths,
    getAudiosForHadith,
    getHadithById,
} from '@/database/repositories/hadithRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function HadithDetailScreen() {
  const router = useRouter();
  const { hadithId } = useLocalSearchParams();
  const id = Number(hadithId);

  // Reading preferences
  const {
    arabicFontSize,
    arabicLineHeight,
    englishFontSize,
    englishLineHeight,
  } = useReading();

  const [settingsVisible, setSettingsVisible] = useState(false);

  const {
    data: hadith,
    loading: hadithLoading,
    error: hadithError,
    refetch,
  } = useDbQuery(() => getHadithById(id), [id]);

  const { data: adjacent } = useDbQuery(() => getAdjacentHadiths(id), [id]);

  const { data: chapter } = useDbQuery(
    () =>
      hadith?.chapter_id
        ? getChapterById(hadith.chapter_id)
        : Promise.resolve(null),
    [hadith?.chapter_id]
  );

  const { data: audioRecords } = useDbQuery(
    () => getAudiosForHadith(id),
    [id]
  );
  const primaryAudio = audioRecords?.[0] ?? null;

  const [bookmarked, setBookmarked] = useState(false);

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
  if (hadithError) return <ScreenError message={hadithError.message} onRetry={refetch} />;
  if (!hadith) return <ScreenError message="Hadith not found." />;

  const hasPrev = !!adjacent?.prev;
  const hasNext = !!adjacent?.next;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Back */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.headerTitle} numberOfLines={1}>
          Hadith {hadith.hadith_number}
        </Text>

        {/* Right side: settings + bookmark */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setSettingsVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Reading settings"
            accessibilityRole="button"
          >
            <Text style={styles.headerIconText}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={toggleBookmark}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            accessibilityRole="button"
          >
            <Text style={styles.headerIconText}>
              {bookmarked ? '🔖' : '🏷️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Chapter breadcrumb ──────────────────────────────── */}
        {chapter && (
          <TouchableOpacity
            style={styles.breadcrumb}
            onPress={() => router.push(`/chapter/${chapter.id}`)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={`Go to chapter: ${chapter.english_title}`}
          >
            <Text style={styles.breadcrumbText} numberOfLines={1}>
              {chapter.arabic_title}  ·  {chapter.english_title}
            </Text>
            <Text style={styles.breadcrumbChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Hadith number badge ─────────────────────────────── */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Hadith {hadith.hadith_number}</Text>
          </View>
        </View>

        {/* ── Arabic text ──────────────────────────────────────── */}
        <View style={styles.arabicBlock}>
          <Text
            style={[
              styles.arabicText,
              { fontSize: arabicFontSize, lineHeight: arabicLineHeight },
            ]}
            accessibilityLanguage="ar"
            selectable
          >
            {hadith.arabic_text}
          </Text>
        </View>

        {/* ── Section divider ─────────────────────────────────── */}
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>Translation</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* ── English translation ──────────────────────────────── */}
        <Text
          style={[
            styles.englishText,
            { fontSize: englishFontSize, lineHeight: englishLineHeight },
          ]}
          selectable
        >
          {hadith.english_text}
        </Text>

        {/* ── Audio player ─────────────────────────────────────── */}
        {primaryAudio ? (
          <View style={styles.audioSection}>
            <AudioPlayer
              audioRecord={primaryAudio}
              savedPositionMs={primaryAudio.position_ms ?? 0}
            />
          </View>
        ) : (
          <View style={styles.audioUnavailable}>
            <Text style={styles.audioUnavailableText}>
              🎧  Audio recitation is not available for this Hadith.
            </Text>
          </View>
        )}

        {/* ── Bookmark action ──────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.bookmarkAction,
            bookmarked && styles.bookmarkActionActive,
          ]}
          onPress={toggleBookmark}
          activeOpacity={0.75}
          accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
          accessibilityRole="button"
        >
          <Text style={styles.bookmarkActionIcon}>
            {bookmarked ? '🔖' : '🏷️'}
          </Text>
          <Text
            style={[
              styles.bookmarkActionText,
              bookmarked && styles.bookmarkActionTextActive,
            ]}
          >
            {bookmarked ? 'Saved to Bookmarks' : 'Save to Bookmarks'}
          </Text>
        </TouchableOpacity>

        {/* ── Prev / Next ──────────────────────────────────────── */}
        <View style={styles.navRow}>
          <NavButton
            label="‹ Previous"
            enabled={hasPrev}
            onPress={() => hasPrev && router.replace(`/hadith/${adjacent.prev.id}`)}
            accessibilityLabel="Previous hadith"
          />
          <NavButton
            label="Next ›"
            enabled={hasNext}
            onPress={() => hasNext && router.replace(`/hadith/${adjacent.next.id}`)}
            accessibilityLabel="Next hadith"
            align="right"
          />
        </View>
      </ScrollView>

      {/* ── Reading settings panel ─────────────────────────────── */}
      <ReadingSettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── NavButton ────────────────────────────────────────────────────────────────

function NavButton({ label, enabled, onPress, accessibilityLabel, align = 'left' }) {
  return (
    <TouchableOpacity
      style={[
        styles.navButton,
        !enabled && styles.navButtonDisabled,
        align === 'right' && styles.navButtonRight,
      ]}
      disabled={!enabled}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text
        style={[
          styles.navButtonText,
          !enabled && styles.navButtonTextDisabled,
          align === 'right' && styles.navButtonTextRight,
        ]}
      >
        {label}
      </Text>
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
  headerBtn: {
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 60,
    justifyContent: 'flex-end',
  },
  headerIconBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },

  // Scroll content
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  breadcrumbChevron: {
    fontSize: 14,
    color: colors.primary,
  },

  // Badge
  badgeRow: {
    marginBottom: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Arabic block — font size / line height driven by ReadingContext
  arabicBlock: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  arabicText: {
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
  },

  // Section divider
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // English text — font size / line height driven by ReadingContext
  englishText: {
    color: colors.textSecondary,
    textAlign: 'left',
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamily,
  },

  // Audio
  audioSection: {
    marginBottom: spacing.lg,
  },
  audioUnavailable: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  audioUnavailableText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Bookmark action
  bookmarkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  bookmarkActionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  bookmarkActionIcon: { fontSize: 18 },
  bookmarkActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  bookmarkActionTextActive: { color: colors.primary },

  // Nav row
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  navButtonRight: { alignItems: 'flex-end' },
  navButtonDisabled: { opacity: 0.25 },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  navButtonTextRight: { textAlign: 'right' },
  navButtonTextDisabled: { color: colors.textMuted },
});
