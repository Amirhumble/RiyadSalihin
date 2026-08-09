/**
 * HadithDetailScreen — the primary reading screen.
 *
 * Layout (reference screenshot 3):
 *   ┌──────────────────────────────┐
 *   │  Dark blue header            │  ← DarkHeader (back, chapter, Aa, ★)
 *   ├──────────────────────────────┤
 *   │  Scrollable reading area     │  ← warm white background
 *   │    Hadith number             │
 *   │    Arabic text (RTL, large)  │
 *   │    ── Translation ──         │
 *   │    English translation       │
 *   │    Prev / Next               │
 *   ├──────────────────────────────┤
 *   │  Fixed audio player bar      │  ← always visible, never scrolls away
 *   └──────────────────────────────┘
 *
 * The audio player bar is outside the ScrollView so it stays fixed at the
 * bottom.  The ScrollView gets extra bottom padding equal to the player height
 * so content is never hidden behind it.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DarkHeader from '@/components/common/DarkHeader';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import ReadingSettingsPanel from '@/components/ui/ReadingSettingsPanel';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useAudio } from '@/context/AudioContext';
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

// ── Utility ───────────────────────────────────────────────────────────────────
function formatTime(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HadithDetailScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { hadithId } = useLocalSearchParams();
  const id = Number(hadithId);

  const { arabicFontSize, arabicLineHeight, englishFontSize, englishLineHeight } =
    useReading();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [bookmarked, setBookmarked]           = useState(false);
  // Height of the audio bar so we can pad the ScrollView
  const [playerHeight, setPlayerHeight]       = useState(0);

  const { data: hadith,  loading: hl, error: he, refetch } = useDbQuery(() => getHadithById(id), [id]);
  const { data: adjacent }  = useDbQuery(() => getAdjacentHadiths(id), [id]);
  const { data: chapter }   = useDbQuery(
    () => hadith?.chapter_id ? getChapterById(hadith.chapter_id) : Promise.resolve(null),
    [hadith?.chapter_id]
  );
  const { data: audioRecords } = useDbQuery(() => getAudiosForHadith(id), [id]);
  const primaryAudio = audioRecords?.[0] ?? null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    isBookmarked(id).then((v) => { if (!cancelled) setBookmarked(v); });
    return () => { cancelled = true; };
  }, [id]);

  const toggleBookmark = useCallback(async () => {
    try {
      if (bookmarked) { await removeBookmark(id); setBookmarked(false); }
      else            { await addBookmark(id);    setBookmarked(true);  }
    } catch (err) {
      console.error('[HadithDetail] bookmark error:', err);
    }
  }, [bookmarked, id]);

  if (hl) return <ScreenLoader />;
  if (he) return <ScreenError onRetry={refetch} />;
  if (!hadith) return <ScreenError />;

  const hasPrev = !!adjacent?.prev;
  const hasNext = !!adjacent?.next;

  // Right side of header
  const headerRight = (
    <View style={styles.headerRight}>
      <TouchableOpacity
        onPress={() => setSettingsVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Reading settings"
        accessibilityRole="button"
        style={styles.headerBtn}
      >
        <Text style={styles.headerBtnText}>Aa</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleBookmark}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
        accessibilityRole="button"
        style={styles.headerBtn}
      >
        <Text style={[styles.headerBtnText, styles.bookmarkStar, bookmarked && styles.bookmarkStarActive]}>
          {bookmarked ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Dark header */}
      <DarkHeader
        onBack={() => router.back()}
        title={chapter?.english_title ?? `Hadith ${hadith.hadith_number}`}
        titleArabic={chapter?.arabic_title}
        rightElement={headerRight}
      />

      {/* Scrollable reading content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: playerHeight + spacing.lg + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hadith number */}
        <View style={styles.hadithNumRow}>
          <Text style={styles.hadithNum}>Hadith {hadith.hadith_number}</Text>
        </View>

        {/* Arabic text */}
        <Text
          style={[styles.arabicText, { fontSize: arabicFontSize, lineHeight: arabicLineHeight }]}
          accessibilityLanguage="ar"
          selectable
        >
          {hadith.arabic_text}
        </Text>

        {/* Divider */}
        <View style={styles.translationDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>Translation</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* English translation */}
        <Text
          style={[styles.englishText, { fontSize: englishFontSize, lineHeight: englishLineHeight }]}
          selectable
        >
          {hadith.english_text}
        </Text>

        {/* Prev / Next */}
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
            alignRight
          />
        </View>
      </ScrollView>

      {/* Fixed bottom audio player */}
      <View
        style={[styles.playerBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
        onLayout={(e) => setPlayerHeight(e.nativeEvent.layout.height)}
      >
        {primaryAudio ? (
          <BottomAudioPlayer
            audioRecord={primaryAudio}
            savedPositionMs={primaryAudio.position_ms ?? 0}
          />
        ) : (
          <View style={styles.noAudioBar}>
            <Text style={styles.noAudioText}>
              Audio recitation is not available for this Hadith
            </Text>
          </View>
        )}
      </View>

      {/* Reading settings panel */}
      <ReadingSettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

// ── NavButton ─────────────────────────────────────────────────────────────────
function NavButton({ label, enabled, onPress, accessibilityLabel, alignRight }) {
  return (
    <TouchableOpacity
      style={[styles.navBtn, !enabled && styles.navBtnDisabled, alignRight && styles.navBtnRight]}
      disabled={!enabled}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={[styles.navBtnText, !enabled && styles.navBtnTextDisabled, alignRight && { textAlign: 'right' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── BottomAudioPlayer ─────────────────────────────────────────────────────────
function BottomAudioPlayer({ audioRecord, savedPositionMs }) {
  const {
    currentAudio, audioLoading, audioError, clearAudioError,
    isPlaying, isBuffering, currentTime, duration,
    loadAudio, play, pause, seek,
  } = useAudio();

  const isThis        = currentAudio?.id === audioRecord?.id;
  const playing       = isThis && isPlaying;
  const buffering     = isThis && (isBuffering || audioLoading);
  const time          = isThis ? currentTime : 0;
  const dur           = isThis ? duration    : 0;
  const progress      = (isThis && dur > 0) ? Math.min(time / dur, 1) : 0;

  // Track width for tap-to-seek
  const trackRef      = useRef(null);
  const trackWidthRef = useRef(0);

  const handlePlayPause = useCallback(() => {
    clearAudioError();
    if (!isThis)       loadAudio(audioRecord, savedPositionMs);
    else if (playing)  pause();
    else               play();
  }, [isThis, playing, audioRecord, savedPositionMs, loadAudio, play, pause, clearAudioError]);

  const handleSeekPress = useCallback((e) => {
    if (!isThis || dur <= 0) return;
    const x = e.nativeEvent.locationX;
    const w = trackWidthRef.current;
    if (w > 0) seek((x / w) * dur);
  }, [isThis, dur, seek]);

  return (
    <View style={ap.container}>
      {/* Error */}
      {isThis && audioError && (
        <Text style={ap.errorText} numberOfLines={1}>
          Audio is not available right now
        </Text>
      )}

      <View style={ap.row}>
        {/* Play / Pause button */}
        <TouchableOpacity
          style={ap.playBtn}
          onPress={handlePlayPause}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          accessibilityState={{ busy: buffering }}
        >
          {buffering
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={ap.playIcon}>{playing ? '⏸' : '▶'}</Text>
          }
        </TouchableOpacity>

        {/* Progress + times */}
        <View style={ap.progressGroup}>
          {/* Progress bar */}
          <View
            ref={trackRef}
            style={ap.track}
            onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={handleSeekPress}
              activeOpacity={1}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek position"
            />
            <View style={[ap.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          {/* Times */}
          <View style={ap.times}>
            <Text style={ap.timeText}>{formatTime(time)}</Text>
            <Text style={ap.timeText}>{dur > 0 ? formatTime(dur) : '--:--'}</Text>
          </View>
        </View>
      </View>

      {/* DEV debug */}
      {__DEV__ && isThis && (
        <Text style={ap.devText} numberOfLines={1}>
          {`${audioRecord?.filename ?? '—'}  ·  ${playing ? '▶' : '⏸'}  ·  ${formatTime(time)} / ${formatTime(dur)}`}
        </Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundWarm },

  // Header right
  headerRight: { flexDirection: 'row', gap: spacing.xs },
  headerBtn: { padding: 4, minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 14, color: colors.heroText, fontWeight: '600' },
  bookmarkStar: { fontSize: 20, color: colors.heroSubtext },
  bookmarkStarActive: { color: colors.gold },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Hadith number
  hadithNumRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  hadithNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Arabic text
  arabicText: {
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.lg,
  },

  // Translation divider
  translationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // English
  englishText: {
    color: colors.textSecondary,
    textAlign: 'left',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xl,
  },

  // Nav
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  navBtn: {
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
  navBtnRight: { alignItems: 'flex-end' },
  navBtnDisabled: { opacity: 0.25 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  navBtnTextDisabled: { color: colors.textMuted },

  // Audio player bar (fixed bottom)
  playerBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  noAudioBar: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  noAudioText: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
  },
});

// Audio player inner styles
const ap = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Play button
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  playIcon: {
    fontSize: 20,
    color: colors.heroText,
    marginLeft: 2,
  },

  // Progress
  progressGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },

  // Dev
  devText: {
    fontSize: 9,
    color: colors.heroMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
