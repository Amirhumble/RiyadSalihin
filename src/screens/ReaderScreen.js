/**
 * ReaderScreen — the combined PDF viewer + audio player.
 *
 * Opened via: /reader?audioId=<id>
 *
 * Flow:
 *   1. Load audio record from SQLite by audioId param.
 *   2. Resolve PDF local URI via expo-asset.
 *   3. Open PDF at audio.pdf_page (or page 1 if null).
 *   4. Load audio into AudioContext and start playing.
 *   5. Show full-screen PDF with a polished dark-blue player bar at bottom.
 *
 * Back navigation returns to /list (the audio list).
 * The intro screen is never revisited.
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
import { getAudioById } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

// ── Static PDF asset — Metro resolves at build time ───────────────────────────
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');

// Lazy-load react-native-pdf (fails gracefully if native module absent)
let Pdf = null;
let pdfModuleError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfModuleError = err;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ReaderScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { audioId } = useLocalSearchParams();
  const id = Number(audioId);

  // Load audio record from DB
  const { data: audio, loading: audioLoading, error: audioError } =
    useDbQuery(() => getAudioById(id), [id]);

  // PDF state
  const [pdfUri,      setPdfUri]      = useState(null);
  const [pdfResolving, setPdfResolving] = useState(true);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError,    setPdfError]    = useState(pdfModuleError);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(0);
  const pdfRef = useRef(null);

  // Reading settings panel
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Resolve PDF asset once on mount
  useEffect(() => {
    if (pdfModuleError) { setPdfResolving(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(PDF_MODULE);
        await asset.downloadAsync();
        if (!cancelled) {
          if (!asset.localUri) throw new Error('PDF file could not be prepared.');
          setPdfUri(asset.localUri);
          setPdfRendering(true);
        }
      } catch (err) {
        console.error('[ReaderScreen] PDF asset error:', err);
        if (!cancelled) setPdfError(err);
      } finally {
        if (!cancelled) setPdfResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load audio into AudioContext when record is ready
  const { loadAudio, currentAudio } = useAudio();
  const audioLoadedRef = useRef(false);

  useEffect(() => {
    if (!audio || audioLoadedRef.current) return;
    audioLoadedRef.current = true;
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio]);

  // Once PDF is rendered, navigate to the audio's page
  const handlePdfLoadComplete = useCallback((pages) => {
    setTotalPages(pages);
    setPdfRendering(false);
    // Navigate PDF to the audio's configured page
    const targetPage = audio?.pdf_page ?? 1;
    if (pdfRef.current && targetPage > 1) {
      // react-native-pdf: use source page parameter on first render
      // Page navigation after load:
      setCurrentPage(targetPage);
    }
  }, [audio?.pdf_page]);

  const handlePdfError = useCallback((err) => {
    console.error('[ReaderScreen] PDF render error:', err);
    setPdfError(err);
    setPdfRendering(false);
  }, []);

  const handlePageChanged = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Show loading while either audio or PDF is resolving
  const isLoading = audioLoading || pdfResolving;

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTitles}>
            {audio ? (
              <>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {audio.title}
                </Text>
                {audio.chapter_english_title ? (
                  <Text style={styles.headerSub} numberOfLines={1}>
                    Chapter {audio.chapter_number_val ?? ''}
                    {audio.chapter_english_title ? `  ·  ${audio.chapter_english_title}` : ''}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.headerTitle}>Loading…</Text>
            )}
          </View>

          <View style={styles.headerRight}>
            {totalPages > 0 && (
              <Text style={styles.pageCounter}>
                {currentPage}/{totalPages}
              </Text>
            )}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setSettingsVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Reading settings"
              accessibilityRole="button"
            >
              <Text style={styles.settingsIcon}>Aa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── PDF area ─────────────────────────────────────────────── */}
      <View style={styles.pdfArea}>
        {(isLoading || pdfRendering) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {isLoading ? 'Preparing…' : 'Loading PDF…'}
            </Text>
          </View>
        )}

        {pdfError ? (
          <PdfErrorView error={pdfError} onRetry={() => {
            setPdfError(null);
            setPdfUri(null);
            setPdfResolving(true);
            Asset.fromModule(PDF_MODULE).downloadAsync()
              .then((a) => { setPdfUri(a.localUri); setPdfRendering(true); })
              .catch((e) => setPdfError(e))
              .finally(() => setPdfResolving(false));
          }} />
        ) : (
          Pdf && pdfUri && (
            <Pdf
              ref={pdfRef}
              source={{ uri: pdfUri, cache: true }}
              page={audio?.pdf_page ?? 1}
              style={styles.pdf}
              onLoadComplete={handlePdfLoadComplete}
              onPageChanged={handlePageChanged}
              onError={handlePdfError}
              enablePaging={false}
              horizontal={false}
              enableAnnotationRendering={false}
              trustAllCerts={false}
            />
          )
        )}
      </View>

      {/* ── Audio player bar ─────────────────────────────────────── */}
      <View style={[styles.playerBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {audioError ? (
          <View style={styles.playerErrorRow}>
            <Text style={styles.playerErrorText}>
              Audio is not available right now.
            </Text>
          </View>
        ) : audio ? (
          <PlayerBar audio={audio} />
        ) : null}
      </View>

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

  const isThis      = currentAudio?.id === audio?.id;
  const playing     = isThis && isPlaying;
  const buffering   = isThis && (isBuffering || audioLoading);
  const time        = isThis ? currentTime : 0;
  const dur         = isThis ? duration    : 0;
  const progress    = (isThis && dur > 0) ? Math.min(time / dur, 1) : 0;
  const trackWidth  = useRef(0);

  const handlePlayPause = useCallback(() => {
    clearAudioError();
    if (!isThis) loadAudio(audio, audio.position_ms ?? 0);
    else if (playing) pause();
    else play();
  }, [isThis, playing, audio, loadAudio, play, pause, clearAudioError]);

  const handleSeekPress = useCallback((e) => {
    if (!isThis || dur <= 0 || trackWidth.current <= 0) return;
    seek((e.nativeEvent.locationX / trackWidth.current) * dur);
  }, [isThis, dur, seek]);

  const skipSecs = useCallback((delta) => {
    if (!isThis) return;
    seek(Math.max(0, Math.min(time + delta, dur)));
  }, [isThis, time, dur, seek]);

  return (
    <View style={pl.container}>
      {/* Skip back / Play-Pause / Skip forward */}
      <View style={pl.controls}>
        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skipSecs(-10)}
          activeOpacity={0.7}
          accessibilityLabel="Rewind 10 seconds"
          accessibilityRole="button"
        >
          <Text style={pl.skipText}>-10</Text>
          <Text style={pl.skipArrow}>↺</Text>
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
          onPress={() => skipSecs(10)}
          activeOpacity={0.7}
          accessibilityLabel="Skip 10 seconds"
          accessibilityRole="button"
        >
          <Text style={pl.skipArrow}>↻</Text>
          <Text style={pl.skipText}>+10</Text>
        </TouchableOpacity>
      </View>

      {/* Progress track + time labels */}
      <View style={pl.progressSection}>
        <View
          style={pl.track}
          onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleSeekPress}
            activeOpacity={1}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
          />
          <View style={[pl.fill, { width: `${Math.round(progress * 100)}%` }]} />
          {/* Thumb dot */}
          <View style={[pl.thumb, { left: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={pl.times}>
          <Text style={pl.timeText}>{fmt(time)}</Text>
          <Text style={pl.timeText}>{dur > 0 ? fmt(dur) : '--:--'}</Text>
        </View>
      </View>

      {/* DEV debug */}
      {__DEV__ && isThis && (
        <Text style={pl.devText} numberOfLines={1}>
          {`${audio?.filename ?? '—'}  ·  ${playing ? '▶' : '⏸'}  ·  ${fmt(time)} / ${fmt(dur)}`}
        </Text>
      )}
    </View>
  );
}

// ── PdfErrorView ──────────────────────────────────────────────────────────────

function PdfErrorView({ error, onRetry }) {
  const msg = error?.message ?? '';
  const isNativeErr = msg.includes('NativeModule') || msg.includes('RNPDFPdf') || msg.includes('cannot be null');

  return (
    <View style={styles.pdfError}>
      <Text style={styles.pdfErrorIcon}>📄</Text>
      <Text style={styles.pdfErrorTitle}>
        {isNativeErr ? 'PDF viewer not available' : 'Could not load PDF'}
      </Text>
      <Text style={styles.pdfErrorMsg}>
        {isNativeErr
          ? 'Rebuild the development client to include the PDF viewer.'
          : 'The PDF file could not be read. Please try again.'}
      </Text>
      {!isNativeErr && (
        <TouchableOpacity style={styles.pdfRetryBtn} onPress={onRetry} activeOpacity={0.8}>
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
    backgroundColor: colors.hero,
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backArrow: { fontSize: 28, color: colors.heroText, lineHeight: 32 },
  headerTitles: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  pageCounter: { fontSize: 11, color: colors.heroSubtext },
  settingsIcon: { fontSize: 14, color: colors.heroText, fontWeight: '600' },

  // PDF
  pdfArea: { flex: 1, backgroundColor: colors.backgroundSecondary },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.backgroundSecondary },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    zIndex: 10,
  },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },

  // PDF error
  pdfError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  pdfErrorIcon: { fontSize: 40, marginBottom: spacing.md },
  pdfErrorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pdfErrorMsg: {
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

  // Player bar
  playerBar: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  playerErrorRow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  playerErrorText: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
  },
});

// ── Player styles ─────────────────────────────────────────────────────────────

const pl = StyleSheet.create({
  container: {
    paddingBottom: spacing.sm,
  },

  // Controls row
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
    gap: 2,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipArrow: { fontSize: 22, color: colors.heroSubtext },
  skipText: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 24,
    color: colors.heroText,
    marginLeft: 3,
  },

  // Progress
  progressSection: { gap: spacing.xs },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.gold,
    marginLeft: -6,
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

  devText: {
    fontSize: 9,
    color: colors.heroMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
