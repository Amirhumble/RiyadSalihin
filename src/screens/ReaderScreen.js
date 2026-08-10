/**
 * ReaderScreen — PDF viewer + audio player.
 *
 * Route: /reader?audioId=<id>
 *
 * Flow:
 *   1. Load audio record from SQLite.
 *   2. Resolve bundled PDF to a local file:// URI via expo-asset.
 *   3. After onLoadComplete fires, call pdfRef.setPage(audio.pdf_page).
 *   4. Load audio into AudioContext and start playing from saved position.
 *
 * The PDF occupies most of the screen. The player bar is fixed at the
 * bottom and never scrolls away.
 */

import { Asset } from 'expo-asset';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio } from '@/context/AudioContext';
import { getAudioByIdWithChapterInfo } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatHadithRange } from '@/utils/formatHadithRange';

// Metro resolves this require at build time.
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');

// Lazy-load so a missing native module shows a friendly error instead of crashing.
let Pdf = null;
let pdfModuleError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfModuleError = err;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function fmt(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReaderScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { audioId } = useLocalSearchParams();
  const id          = Number(audioId);

  // Audio record from DB
  const { data: audio, loading: audioLoading, error: audioDbError } =
    useDbQuery(() => getAudioByIdWithChapterInfo(id), [id]);

  // PDF state
  const [pdfUri,       setPdfUri]       = useState(null);
  const [pdfResolving, setPdfResolving] = useState(true);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError,     setPdfError]     = useState(pdfModuleError);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(0);

  // pdfRef for programmatic setPage after load
  const pdfRef   = useRef(null);
  // audioRef so onLoadComplete closure can read pdf_page without stale capture
  const audioRef = useRef(null);
  useEffect(() => { audioRef.current = audio; }, [audio]);

  // Resolve PDF asset to a local file:// URI once on mount
  const resolvePdf = useCallback(async (cancelRef) => {
    try {
      setPdfResolving(true);
      setPdfError(null);
      const asset = Asset.fromModule(PDF_MODULE);
      await asset.downloadAsync();
      if (cancelRef?.current) return;
      if (!asset.localUri) throw new Error('PDF could not be prepared.');
      setPdfUri(asset.localUri);
      setPdfRendering(true);
    } catch (err) {
      console.error('[ReaderScreen] PDF asset error:', err);
      if (!cancelRef?.current) setPdfError(err);
    } finally {
      if (!cancelRef?.current) setPdfResolving(false);
    }
  }, []);

  useEffect(() => {
    if (pdfModuleError) { setPdfResolving(false); return; }
    const cancelRef = { current: false };
    resolvePdf(cancelRef);
    return () => { cancelRef.current = true; };
  }, [resolvePdf]);

  // Load audio once when the DB record arrives
  const { loadAudio }    = useAudio();
  const audioLoadedRef   = useRef(false);

  useEffect(() => {
    if (!audio || audioLoadedRef.current) return;
    audioLoadedRef.current = true;
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio]);

  // PDF callbacks
  const handlePdfLoadComplete = useCallback((pages) => {
    setTotalPages(pages);
    setPdfRendering(false);

    const raw    = audioRef.current?.pdf_page;
    const target = (raw != null && Number.isInteger(raw) && raw >= 1)
      ? Math.max(1, Math.min(raw, pages))
      : 1;

    setCurrentPage(target);
    if (target > 1) {
      setTimeout(() => pdfRef.current?.setPage(target), 100);
    }
  }, []);

  const handlePdfPageChanged = useCallback((page) => setCurrentPage(page), []);

  const handlePdfError = useCallback((err) => {
    console.error('[ReaderScreen] PDF render error:', err);
    setPdfError(err);
    setPdfRendering(false);
  }, []);

  const isLoading = audioLoading || pdfResolving;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          {/* Back */}
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => router.back()}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityLabel="Go back to lessons"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {audio?.title ?? 'Loading…'}
            </Text>
            {audio ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {formatHadithRange(
                  audio.hadith_number_from,
                  audio.hadith_number_to
                ) ?? ''}
              </Text>
            ) : null}
          </View>

          {/* Page counter */}
          <View style={styles.headerRight}>
            {totalPages > 0 ? (
              <Text style={styles.pageCounter}>
                {currentPage} / {totalPages}
              </Text>
            ) : (
              // keeps header balanced when counter is absent
              <View style={styles.headerRight} />
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* PDF area */}
      <View style={styles.pdfArea}>
        {/* Loading overlay */}
        {(isLoading || pdfRendering) && !pdfError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {pdfResolving ? 'Opening book…' : 'Loading page…'}
            </Text>
          </View>
        )}

        {pdfError ? (
          <PdfErrorView
            error={pdfError}
            onRetry={() => {
              setPdfUri(null);
              resolvePdf({ current: false });
            }}
          />
        ) : Pdf && pdfUri ? (
          <Pdf
            ref={pdfRef}
            source={{ uri: pdfUri, cache: true }}
            style={styles.pdf}
            onLoadComplete={handlePdfLoadComplete}
            onPageChanged={handlePdfPageChanged}
            onError={handlePdfError}
            enablePaging={false}
            horizontal={false}
            enableAnnotationRendering={false}
            trustAllCerts={false}
          />
        ) : null}
      </View>

      {/* Fixed audio player */}
      <View
        style={[
          styles.playerBar,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {audioDbError ? (
          <View style={styles.playerMessage}>
            <Text style={styles.playerMessageText}>
              Audio is currently unavailable.
            </Text>
          </View>
        ) : audio ? (
          <PlayerBar audio={audio} />
        ) : (
          <View style={styles.playerMessage}>
            <ActivityIndicator color={colors.heroSubtext} size="small" />
          </View>
        )}
      </View>
    </View>
  );
}

// ── PlayerBar ─────────────────────────────────────────────────────────────────

function PlayerBar({ audio }) {
  const {
    currentAudio, audioLoading, audioError, clearAudioError,
    isPlaying, isBuffering,
    currentTime, duration,
    loadAudio, play, pause, seek,
  } = useAudio();

  const isThis    = currentAudio?.id === audio?.id;
  const playing   = isThis && isPlaying;
  const buffering = isThis && (isBuffering || audioLoading);
  const time      = isThis ? currentTime : 0;
  const dur       = isThis ? duration    : 0;
  const progress  = isThis && dur > 0 ? Math.min(time / dur, 1) : 0;
  const trackW    = useRef(0);

  const handlePlayPause = useCallback(() => {
    clearAudioError();
    if (!isThis)       loadAudio(audio, audio.position_ms ?? 0);
    else if (playing)  pause();
    else               play();
  }, [isThis, playing, audio, loadAudio, play, pause, clearAudioError]);

  const handleSeek = useCallback((e) => {
    if (!isThis || dur <= 0 || trackW.current <= 0) return;
    seek((e.nativeEvent.locationX / trackW.current) * dur);
  }, [isThis, dur, seek]);

  const skip = useCallback((delta) => {
    if (!isThis) return;
    seek(Math.max(0, Math.min(time + delta, dur)));
  }, [isThis, time, dur, seek]);

  return (
    <View style={pl.container}>
      {/* Audio error */}
      {isThis && audioError && (
        <Text style={pl.errorText} numberOfLines={1}>
          Audio is currently unavailable. Please try again.
        </Text>
      )}

      {/* Controls: –10 / Play-Pause / +10 */}
      <View style={pl.controls}>
        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(-10)}
          activeOpacity={0.7}
          accessibilityLabel="Rewind 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={pl.skipIcon}>↺</Text>
          <Text style={pl.skipLabel}>10</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.playBtn}
          onPress={handlePlayPause}
          activeOpacity={0.8}
          accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
          accessibilityRole="button"
          accessibilityState={{ busy: buffering }}
        >
          {buffering
            ? <ActivityIndicator color={colors.heroText} size="small" />
            : <Text style={pl.playIcon}>{playing ? '⏸' : '▶'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(10)}
          activeOpacity={0.7}
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={pl.skipLabel}>10</Text>
          <Text style={pl.skipIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar + times */}
      <View style={pl.progressWrap}>
        <View
          style={pl.track}
          onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
        >
          {/* Large invisible touch target over the track */}
          <TouchableOpacity
            style={pl.trackTouchTarget}
            onPress={handleSeek}
            activeOpacity={1}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek audio position"
            accessibilityValue={{
              now: Math.round(time),
              min: 0,
              max: Math.round(dur),
            }}
          />
          {/* Filled portion */}
          <View style={[pl.fill, { width: `${Math.round(progress * 100)}%` }]} />
          {/* Thumb */}
          <View style={[pl.thumb, { left: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={pl.times}>
          <Text style={pl.timeText}>{fmt(time)}</Text>
          <Text style={pl.timeText}>{dur > 0 ? fmt(dur) : '--:--'}</Text>
        </View>
      </View>

      {/* DEV — never shown in production builds */}
      {__DEV__ && isThis && (
        <Text style={pl.devText} numberOfLines={1}>
          {`DEV  ${audio?.filename ?? '—'}  ${playing ? '▶' : '⏸'}  ${fmt(time)} / ${fmt(dur)}`}
        </Text>
      )}
    </View>
  );
}

// ── PdfErrorView ──────────────────────────────────────────────────────────────

function PdfErrorView({ error, onRetry }) {
  const msg      = error?.message ?? '';
  const isNative =
    msg.includes('NativeModule') ||
    msg.includes('RNPDFPdf') ||
    msg.includes('cannot be null');

  return (
    <View style={styles.pdfError}>
      <Text style={styles.pdfErrorIcon}>📄</Text>
      <Text style={styles.pdfErrorTitle}>
        {isNative ? 'PDF viewer is not available' : 'Could not open the book'}
      </Text>
      <Text style={styles.pdfErrorBody}>
        {isNative
          ? 'Please rebuild the development client.'
          : 'The file could not be read. Please try again.'}
      </Text>
      {!isNative && onRetry && (
        <TouchableOpacity
          style={styles.pdfRetryBtn}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <Text style={styles.pdfRetryText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundSecondary },

  // Header
  headerSafe: { backgroundColor: colors.hero },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    minHeight: 54,
  },
  headerBack: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  backArrow: {
    fontSize: 32,
    color: colors.heroText,
    lineHeight: 36,
    marginTop: -2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 11,
    color: colors.heroSubtext,
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pageCounter: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },

  // PDF
  pdfArea: { flex: 1 },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.backgroundSecondary },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // PDF error
  pdfError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  pdfErrorIcon:  { fontSize: 40, marginBottom: spacing.md },
  pdfErrorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pdfErrorBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  pdfRetryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  pdfRetryText: { color: colors.textInverse, fontSize: 15, fontWeight: '600' },

  // Player bar wrapper
  playerBar: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  playerMessage: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  playerMessageText: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
  },
});

const pl = StyleSheet.create({
  container: { paddingBottom: spacing.xs },

  errorText: {
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  // Controls row
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },

  // Skip buttons
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipIcon:  { fontSize: 20, color: colors.heroSubtext },
  skipLabel: {
    fontSize: 12,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },

  // Main play/pause button — deliberately large and prominent
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: colors.heroText,
    marginLeft: 3,
  },

  // Progress
  progressWrap: { gap: spacing.xs },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'visible',
    position: 'relative',
  },
  // Invisible tall touch target over the track for easy tapping
  trackTouchTarget: {
    ...StyleSheet.absoluteFillObject,
    top: -12,
    bottom: -12,
  },
  fill: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    marginLeft: -8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
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

  // DEV only
  devText: {
    fontSize: 9,
    color: colors.heroMuted,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
