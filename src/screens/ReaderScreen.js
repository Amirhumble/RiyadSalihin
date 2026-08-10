/**
 * ReaderScreen — combined PDF viewer + audio player.
 *
 * Route: /reader?audioId=<id>
 *
 * Flow:
 *   1. Load audio record from SQLite (with chapter info JOIN).
 *   2. Resolve the bundled PDF to a local file:// URI via expo-asset.
 *   3. Pass audio.pdf_page to react-native-pdf's `page` prop so the PDF
 *      opens at the correct page on first render.
 *   4. Load audio into the global AudioContext and start playing.
 *   5. Render PDF full-screen with a fixed dark-blue player bar at the bottom.
 *
 * PDF PAGE NUMBERING
 * ──────────────────
 * react-native-pdf uses 1-based page numbers (page 1 = first page).
 * The `page` prop controls the *initial* displayed page. After initial
 * render the user can scroll freely; onPageChanged keeps currentPage in sync.
 * audio.pdf_page must therefore be the 1-based page number in the PDF.
 * Example: if the audio starts at physical page 18, set pdf_page = 18.
 *
 * BACK NAVIGATION
 * ───────────────
 * router.back() returns to /list. The intro screen used router.replace()
 * so it is no longer in the stack — back from list would exit the app,
 * which is correct Android behaviour.
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

import ReadingSettingsPanel from '@/components/ui/ReadingSettingsPanel';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio } from '@/context/AudioContext';
import { getAudioByIdWithChapterInfo } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

// ── Static PDF module — Metro resolves at build time ─────────────────────────
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');

// Lazy-load react-native-pdf so a missing native module shows a clean error
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
  const router           = useRouter();
  const insets           = useSafeAreaInsets();
  const { audioId }      = useLocalSearchParams();
  const id               = Number(audioId);

  // ── Data ──────────────────────────────────────────────────────────
  const { data: audio, loading: audioLoading, error: audioDbError } =
    useDbQuery(() => getAudioByIdWithChapterInfo(id), [id]);

  // ── PDF state ─────────────────────────────────────────────────────
  const [pdfUri,       setPdfUri]       = useState(null);
  const [pdfResolving, setPdfResolving] = useState(true);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError,     setPdfError]     = useState(pdfModuleError);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(0);

  // ── Settings ──────────────────────────────────────────────────────
  const [settingsVisible, setSettingsVisible] = useState(false);

  // ── Resolve PDF asset once ────────────────────────────────────────
  const resolvePdf = useCallback(async (setCancelled) => {
    try {
      setPdfResolving(true);
      setPdfError(null);
      const asset = Asset.fromModule(PDF_MODULE);
      await asset.downloadAsync();
      if (setCancelled?.current) return;
      if (!asset.localUri) throw new Error('PDF file could not be prepared.');
      setPdfUri(asset.localUri);
      setPdfRendering(true);
    } catch (err) {
      console.error('[ReaderScreen] PDF asset error:', err);
      if (!setCancelled?.current) setPdfError(err);
    } finally {
      if (!setCancelled?.current) setPdfResolving(false);
    }
  }, []);

  useEffect(() => {
    if (pdfModuleError) { setPdfResolving(false); return; }
    const cancelledRef = { current: false };
    resolvePdf(cancelledRef);
    return () => { cancelledRef.current = true; };
  }, [resolvePdf]);

  // ── Load audio once when the DB record is ready ───────────────────
  const { loadAudio } = useAudio();
  const audioLoadedRef = useRef(false);

  useEffect(() => {
    // Guard: only load once per screen mount, and only when audio is loaded
    if (!audio || audioLoadedRef.current) return;
    audioLoadedRef.current = true;
    // Resume from saved position if available
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio]);

  // ── PDF callbacks ─────────────────────────────────────────────────
  const handlePdfLoadComplete = useCallback((pages) => {
    setTotalPages(pages);
    setPdfRendering(false);
  }, []);

  const handlePdfPageChanged = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handlePdfError = useCallback((err) => {
    console.error('[ReaderScreen] PDF render error:', err);
    setPdfError(err);
    setPdfRendering(false);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────
  const isLoading = audioLoading || pdfResolving;

  // The initial page is audio.pdf_page (1-based). We pass it directly to
  // the <Pdf page> prop. react-native-pdf opens at this page on first render.
  // Once the user scrolls, onPageChanged updates currentPage for the counter.
  const initialPage = audio?.pdf_page ?? 1;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerCentre}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {audio?.title ?? 'Loading…'}
            </Text>
            {audio ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {formatChapterRange(audio.chapter_from, audio.chapter_to) ?? ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerSide}>
            {totalPages > 0 && (
              <Text style={styles.pageCounter}>
                {currentPage}/{totalPages}
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* ── PDF area ─────────────────────────────────────────────── */}
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

        {/* PDF error */}
        {pdfError ? (
          <PdfErrorView
            error={pdfError}
            onRetry={() => {
              setPdfUri(null);
              resolvePdf({ current: false });
            }}
          />
        ) : (
          /* Render PDF only after URI is ready. The `page` prop sets the
             initial page — react-native-pdf opens there on first render.
             We do NOT call setCurrentPage in onLoadComplete because that
             would fight with the controlled `page` prop. */
          Pdf && pdfUri ? (
            <Pdf
              source={{ uri: pdfUri, cache: true }}
              page={initialPage}
              style={styles.pdf}
              onLoadComplete={handlePdfLoadComplete}
              onPageChanged={handlePdfPageChanged}
              onError={handlePdfError}
              enablePaging={false}
              horizontal={false}
              enableAnnotationRendering={false}
              trustAllCerts={false}
            />
          ) : null
        )}
      </View>

      {/* ── Fixed audio player ────────────────────────────────────── */}
      <View
        style={[
          styles.playerBar,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {audioDbError ? (
          <View style={styles.playerRow}>
            <Text style={styles.playerErrorText}>
              This audio is currently unavailable.
            </Text>
          </View>
        ) : audio ? (
          <PlayerBar audio={audio} />
        ) : (
          <View style={styles.playerRow}>
            <ActivityIndicator color={colors.heroSubtext} size="small" />
          </View>
        )}
      </View>

      {/* Reading settings */}
      <ReadingSettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
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
    if (!isThis) loadAudio(audio, audio.position_ms ?? 0);
    else if (playing) pause();
    else play();
  }, [isThis, playing, audio, loadAudio, play, pause, clearAudioError]);

  const handleSeek = useCallback((e) => {
    if (!isThis || dur <= 0 || trackW.current <= 0) return;
    seek((e.nativeEvent.locationX / trackW.current) * dur);
  }, [isThis, dur, seek]);

  const skip = useCallback((delta) => {
    if (!isThis) return;
    seek(Math.max(0, Math.min(time + delta, dur)));
  }, [isThis, time, dur, seek]);

  // User-friendly audio error (never expose raw messages)
  const showError = isThis && audioError;

  return (
    <View style={pl.container}>
      {showError && (
        <Text style={pl.errorText} numberOfLines={1}>
          Audio is currently unavailable. Please try again.
        </Text>
      )}

      {/* Skip –10 / Play-Pause / Skip +10 */}
      <View style={pl.controls}>
        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(-10)}
          activeOpacity={0.7}
          accessibilityLabel="Rewind 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={pl.skipArrow}>↺</Text>
          <Text style={pl.skipLabel}>10</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.playBtn}
          onPress={handlePlayPause}
          activeOpacity={0.8}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
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
          accessibilityLabel="Skip 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={pl.skipLabel}>10</Text>
          <Text style={pl.skipArrow}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Progress track */}
      <View style={pl.progressWrap}>
        <View
          style={pl.track}
          onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleSeek}
            activeOpacity={1}
            accessibilityRole="adjustable"
            accessibilityLabel="Audio position"
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

      {/* DEV info — never shown in production */}
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
  const msg = error?.message ?? '';
  const isNative = msg.includes('NativeModule') || msg.includes('RNPDFPdf') || msg.includes('cannot be null');

  return (
    <View style={styles.pdfError}>
      <Text style={styles.pdfErrorIcon}>📄</Text>
      <Text style={styles.pdfErrorTitle}>
        {isNative ? 'PDF viewer is not available' : 'Could not open the PDF'}
      </Text>
      <Text style={styles.pdfErrorBody}>
        {isNative
          ? 'Please rebuild the development client.'
          : 'The file could not be read. Please try again.'}
      </Text>
      {!isNative && onRetry && (
        <TouchableOpacity style={styles.pdfRetryBtn} onPress={onRetry} activeOpacity={0.8}
          accessibilityLabel="Try again" accessibilityRole="button">
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
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 52,
  },
  headerSide: {
    width: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 30, color: colors.heroText, lineHeight: 34, marginTop: -2 },
  headerCentre: { flex: 1, alignItems: 'center' },
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
  pageCounter: {
    fontSize: 11,
    color: colors.heroSubtext,
    textAlign: 'right',
  },

  // PDF
  pdfArea: { flex: 1 },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.backgroundSecondary },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },

  // PDF error
  pdfError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  pdfErrorIcon: { fontSize: 40, marginBottom: spacing.md },
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

  // Player bar container
  playerBar: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  playerRow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  playerErrorText: {
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

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipArrow: { fontSize: 20, color: colors.heroSubtext },
  skipLabel: { fontSize: 12, color: colors.heroSubtext, fontVariant: ['tabular-nums'] },

  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 26, color: colors.heroText, marginLeft: 3 },

  // Progress
  progressWrap: { gap: spacing.xs },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'visible',
    position: 'relative',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontSize: 11, color: colors.heroSubtext, fontVariant: ['tabular-nums'] },

  devText: {
    fontSize: 9,
    color: colors.heroMuted,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
