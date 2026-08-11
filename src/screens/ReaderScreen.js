import { Asset } from 'expo-asset';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio, useAudioPlayer } from '@/context/AudioContext';
import { getAudioById } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatHadithRange } from '@/utils/formatHadithRange';

// PDF URI is cached at module level so switching lessons does not re-download it
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');
let _cachedPdfUri = null;

let Pdf = null;
let pdfModuleError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfModuleError = err;
}

const SPEED_OPTIONS = [
  { rate: 0.75, label: '0.75×' },
  { rate: 1, label: '1×', note: 'Normal' },
  { rate: 1.25, label: '1.25×' },
  { rate: 1.5, label: '1.5×' },
  { rate: 1.75, label: '1.75×' },
  { rate: 2, label: '2×' },
];

function fmt(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { audioId } = useLocalSearchParams();
  const id = Number(audioId);

  const { data: audio, loading: audioLoading, error: audioDbError } =
    useDbQuery(() => getAudioById(id), [id]);

  const [pdfUri, setPdfUri] = useState(_cachedPdfUri);
  const [pdfResolving, setPdfResolving] = useState(!_cachedPdfUri);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError, setPdfError] = useState(pdfModuleError);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const pdfRef = useRef(null);
  const audioRef = useRef(null);
  useEffect(() => { audioRef.current = audio; }, [audio]);

  const resolvePdf = useCallback(async (cancelRef) => {
    if (_cachedPdfUri) {
      setPdfUri(_cachedPdfUri);
      setPdfResolving(false);
      setPdfRendering(true);
      return;
    }
    try {
      setPdfResolving(true);
      setPdfError(null);
      const asset = Asset.fromModule(PDF_MODULE);
      await asset.downloadAsync();
      if (cancelRef?.current) return;
      if (!asset.localUri) throw new Error('PDF could not be prepared.');
      _cachedPdfUri = asset.localUri;
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

  const { loadAudio } = useAudio();
  const audioLoadedRef = useRef(false);
  useEffect(() => {
    if (!audio || audioLoadedRef.current) return;
    audioLoadedRef.current = true;
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio]);

  const handlePdfLoadComplete = useCallback((pages) => {
    setTotalPages(pages);
    setPdfRendering(false);
    const raw = audioRef.current?.pdf_page;
    const target = (raw != null && Number.isInteger(raw) && raw >= 1)
      ? Math.max(1, Math.min(raw, pages)) : 1;
    setCurrentPage(target);
    if (target > 1) setTimeout(() => pdfRef.current?.setPage(target), 100);
  }, []);

  const handlePdfPageChanged = useCallback((page) => setCurrentPage(page), []);

  const handlePdfError = useCallback((err) => {
    console.error('[ReaderScreen] PDF render error:', err);
    setPdfError(err);
    setPdfRendering(false);
  }, []);

  const isLoading = audioLoading || pdfResolving;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => router.back()}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityLabel="Go back to lessons"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {audio?.title ?? 'Loading…'}
            </Text>
            {audio ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {formatHadithRange(audio.hadith_number_from, audio.hadith_number_to) ?? ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            {totalPages > 0
              ? <Text style={styles.pageCounter}>{currentPage} / {totalPages}</Text>
              : <View style={styles.headerRight} />}
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.pdfArea}>
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
              _cachedPdfUri = null;
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

      <View style={[styles.playerBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {audioDbError ? (
          <View style={styles.playerMessage}>
            <Text style={styles.playerMessageText}>Audio is currently unavailable.</Text>
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

// memo: live ticks stay inside PlayerBar so the PDF does not re-render
const PlayerBar = memo(function PlayerBar({ audio }) {
  const {
    currentAudio, audioError, clearAudioError,
    isPlaying, isBuffering, audioLoading,
    currentTime, duration,
    playbackRate,
    loadAudio, play, pause, seek, setSpeed,
  } = useAudioPlayer();

  const isThis = currentAudio?.id === audio?.id;
  const playing = isThis && isPlaying;
  const buffering = isThis && (isBuffering || audioLoading);
  const time = isThis ? currentTime : 0;
  const dur = isThis ? duration : 0;
  const trackW = useRef(0);

  // While dragging, show finger position instead of player time
  // so status ticks do not fight the user's finger
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekRatio, setSeekRatio] = useState(0);

  const displayRatio = isSeeking ? seekRatio
    : (dur > 0 ? Math.min(time / dur, 1) : 0);
  const displayTime = isSeeking ? seekRatio * dur : time;

  function xToRatio(x) {
    if (!trackW.current || trackW.current <= 0) return 0;
    return Math.max(0, Math.min(x / trackW.current, 1));
  }

  // Refs so the one-time PanResponder always sees the latest seek/dur
  const seekRef = useRef(seek);
  const durRef = useRef(dur);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { durRef.current = dur; }, [dur]);

  const stablePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const ratio = xToRatio(evt.nativeEvent.locationX);
        setIsSeeking(true);
        setSeekRatio(ratio);
      },

      onPanResponderMove: (evt) => {
        const ratio = xToRatio(evt.nativeEvent.locationX);
        setSeekRatio(ratio);
      },

      onPanResponderRelease: (evt) => {
        const ratio = xToRatio(evt.nativeEvent.locationX);
        setIsSeeking(false);
        if (durRef.current > 0) seekRef.current(ratio * durRef.current);
      },

      onPanResponderTerminate: (evt) => {
        const ratio = xToRatio(evt.nativeEvent.locationX);
        setIsSeeking(false);
        if (durRef.current > 0) seekRef.current(ratio * durRef.current);
      },
    })
  ).current;

  const [speedOpen, setSpeedOpen] = useState(false);

  const handlePlayPause = useCallback(() => {
    clearAudioError();
    if (!isThis) loadAudio(audio, audio.position_ms ?? 0);
    else if (playing) pause();
    else play();
  }, [isThis, playing, audio, loadAudio, play, pause, clearAudioError]);

  const skip = useCallback((delta) => {
    if (!isThis) return;
    seek(Math.max(0, Math.min(time + delta, dur)));
  }, [isThis, time, dur, seek]);

  const handleSelectSpeed = useCallback((rate) => {
    setSpeed(rate);
    setSpeedOpen(false);
  }, [setSpeed]);

  const speedLabel = useMemo(
    () => playbackRate === 1 ? '1×' : `${playbackRate}×`,
    [playbackRate]
  );

  const rangeLabel = formatHadithRange(
    audio?.hadith_number_from,
    audio?.hadith_number_to
  );

  const timeStr = fmt(displayTime);
  const durStr = dur > 0 ? fmt(dur) : '--:--';
  const pct = `${Math.round(displayRatio * 100)}%`;

  const accessValue = useMemo(() => {
    const nowSec = Math.round(displayTime);
    const maxSec = Math.round(dur);
    const nowMin = Math.floor(nowSec / 60);
    const nowRem = nowSec % 60;
    const maxMin = Math.floor(maxSec / 60);
    const maxRem = maxSec % 60;
    const nowStr = nowMin > 0
      ? `${nowMin} minute${nowMin !== 1 ? 's' : ''} ${nowRem} second${nowRem !== 1 ? 's' : ''}`
      : `${nowSec} second${nowSec !== 1 ? 's' : ''}`;
    const maxStr = maxSec > 0
      ? (maxMin > 0
        ? `${maxMin} minute${maxMin !== 1 ? 's' : ''} ${maxRem} second${maxRem !== 1 ? 's' : ''}`
        : `${maxSec} second${maxSec !== 1 ? 's' : ''}`)
      : 'unknown duration';
    return {
      min: 0,
      max: Math.round(dur),
      now: nowSec,
      text: `${nowStr} of ${maxStr}`,
    };
  }, [displayTime, dur]);

  return (
    <View style={pl.container}>
      <View style={pl.trackInfo}>
        <Text style={pl.trackTitle} numberOfLines={1}>{audio?.title ?? ''}</Text>
        {rangeLabel ? (
          <Text style={pl.trackRange} numberOfLines={1}>{rangeLabel}</Text>
        ) : null}
      </View>

      {isThis && audioError ? (
        <Text style={pl.errorText} numberOfLines={1}>
          Audio is currently unavailable.
        </Text>
      ) : null}

      <View style={pl.timeRow}>
        <Text style={pl.timeText}>{timeStr}</Text>
        <Text style={pl.timeText}>{durStr}</Text>
      </View>

      <View
        style={pl.trackWrap}
        onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
        accessibilityRole="adjustable"
        accessibilityLabel="Audio progress"
        accessibilityValue={accessValue}
        {...stablePan.panHandlers}
      >
        <View style={pl.trackBg}>
          <View style={[pl.trackFill, { width: pct }]} />
        </View>
        <View style={[pl.thumb, { left: pct }, isSeeking && pl.thumbDragging]} />
      </View>

      <View style={pl.controls}>
        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(-10)}
          activeOpacity={0.65}
          accessibilityLabel="Rewind 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={pl.skipInner}>
            <Text style={pl.skipArrow}>↺</Text>
            <Text style={pl.skipNum}>10</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.playBtn}
          onPress={handlePlayPause}
          activeOpacity={0.75}
          accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
          accessibilityRole="button"
          accessibilityState={{ busy: buffering }}
        >
          {buffering
            ? <ActivityIndicator color={colors.hero} size="small" />
            : <Text style={pl.playIcon}>{playing ? '⏸' : '▶'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(10)}
          activeOpacity={0.65}
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={pl.skipInner}>
            <Text style={pl.skipNum}>10</Text>
            <Text style={pl.skipArrow}>↻</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={pl.speedRow}>
        <TouchableOpacity
          style={pl.speedBtn}
          onPress={() => setSpeedOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel={`Playback speed, currently ${speedLabel}`}
          accessibilityRole="button"
        >
          <Text style={pl.speedLabel}>{speedLabel}</Text>
        </TouchableOpacity>
      </View>

      {__DEV__ && isThis && (
        <Text style={pl.devText} numberOfLines={1}>
          {`DEV ${audio?.filename}  ${playing ? '▶' : '⏸'}  ${timeStr}/${durStr}  ${playbackRate}×${isSeeking ? '  [drag]' : ''}`}
        </Text>
      )}

      <SpeedSheet
        visible={speedOpen}
        current={playbackRate}
        onSelect={handleSelectSpeed}
        onClose={() => setSpeedOpen(false)}
      />
    </View>
  );
});

const SpeedSheet = memo(function SpeedSheet({ visible, current, onSelect, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={sp.backdrop} onPress={onClose} />
      <View style={sp.sheet}>
        <View style={sp.handle} />
        <Text style={sp.title}>Playback Speed</Text>
        {SPEED_OPTIONS.map(({ rate, label, note }) => {
          const active = current === rate;
          return (
            <TouchableOpacity
              key={rate}
              style={[sp.option, active && sp.optionActive]}
              onPress={() => onSelect(rate)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={note ? `${label}, ${note}` : label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[sp.optionLabel, active && sp.optionLabelActive]}>
                {label}
                {note ? <Text style={sp.optionNote}>  {note}</Text> : null}
              </Text>
              {active && <Text style={sp.check}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
});

function PdfErrorView({ error, onRetry }) {
  const msg = error?.message ?? '';
  const isNative = msg.includes('NativeModule') || msg.includes('RNPDFPdf') || msg.includes('cannot be null');
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundSecondary },
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
  backArrow: { fontSize: 32, color: colors.heroText, lineHeight: 36, marginTop: -2 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
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
  pdfArea: { flex: 1 },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.backgroundSecondary },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },
  pdfError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  pdfErrorIcon: { fontSize: 40, marginBottom: spacing.md },
  pdfErrorTitle: {
    fontSize: 17, fontWeight: '600', color: colors.text,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  pdfErrorBody: {
    fontSize: 13, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg,
  },
  pdfRetryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  pdfRetryText: { color: colors.textInverse, fontSize: 15, fontWeight: '600' },
  playerBar: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  playerMessage: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  playerMessageText: { fontSize: 13, color: colors.heroSubtext, textAlign: 'center' },
});

const pl = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  trackRange: {
    fontSize: 11,
    color: colors.heroSubtext,
    textAlign: 'center',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  timeText: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },
  trackWrap: {
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  trackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    marginTop: -8,
    marginLeft: -8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  thumbDragging: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: -11,
    marginLeft: -11,
    elevation: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl + spacing.md,
    marginBottom: spacing.sm,
  },
  skipBtn: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  skipArrow: {
    fontSize: 22,
    color: colors.heroSubtext,
    lineHeight: 26,
  },
  skipNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.heroText,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  playIcon: {
    fontSize: 28,
    color: colors.hero,
    marginLeft: 3,
  },
  speedRow: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  speedBtn: {
    minWidth: 52,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heroSubtext,
    letterSpacing: 0.4,
  },
  devText: {
    fontSize: 9,
    color: colors.heroMuted,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

const sp = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 2,
    minHeight: 48,
  },
  optionActive: {
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    fontSize: 16,
    color: colors.text,
  },
  optionLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '400',
  },
  check: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
});
