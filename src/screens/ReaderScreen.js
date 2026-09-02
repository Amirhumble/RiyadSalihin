import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio, useAudioPlayer } from '@/context/AudioContext';
import { clampPage, usePdfSession } from '@/context/PdfSessionContext';
import { getAudioById } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatHadithRange } from '@/utils/formatHadithRange';

const SPEED_OPTIONS = [
  { rate: 0.75, label: '0.75×' },
  { rate: 1, label: '1×', note: 'Normal' },
  { rate: 1.25, label: '1.25×' },
  { rate: 1.5, label: '1.5×' },
  { rate: 1.75, label: '1.75×' },
  { rate: 2, label: '2×' },
];

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function audioErrorMessage(err) {
  if (!err) return 'Audio is currently unavailable.';
  if (err.code === 'DOWNLOAD_REQUIRED') {
    return 'This lesson needs to be downloaded first. Connect to the internet and try again.';
  }
  if (err.code === 'NOT_CONFIGURED') {
    return 'Audio storage is not configured.';
  }
  if (err.code === 'DOWNLOAD_FAILED' || err.code === 'INVALID_FILENAME') {
    return err.message || 'Could not download this lesson. Please try again.';
  }
  return err.message || 'Audio is currently unavailable.';
}

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { audioId, pdfPage: pdfPageParam } = useLocalSearchParams();
  const rawAudioId = Array.isArray(audioId) ? audioId[0] : audioId;
  const id = Number(rawAudioId);
  const rawPageParam = Array.isArray(pdfPageParam) ? pdfPageParam[0] : pdfPageParam;
  const paramPage = rawPageParam != null && rawPageParam !== ''
    ? clampPage(rawPageParam, 0)
    : 0;

  const { data: audio, loading: audioLoading, error: audioDbError } =
    useDbQuery(() => getAudioById(id), [id]);

  const {
    pdfResolving,
    pdfReady,
    pageReady,
    pdfError,
    currentPage,
    totalPages,
    present,
    hide,
    updateSlot,
    retry,
  } = usePdfSession();

  const loadedAudioIdRef = useRef(null);
  const slotRef = useRef(null);
  const [focused, setFocused] = useState(false);

  // Lesson start page only — NOT the live scroll position.
  // Used for setPage() after the document loads. Never passed as the
  // native `page` prop (that reloads the whole document).
  const openPage = useMemo(
    () => clampPage(audio?.pdf_page ?? paramPage, 0),
    [audio?.id, audio?.pdf_page, paramPage]
  );

  const hasTargetPage = Boolean(audio?.id || paramPage);

  const { loadAudio } = useAudio();
  useEffect(() => {
    if (!audio?.id) return;
    if (loadedAudioIdRef.current === audio.id) return;
    loadedAudioIdRef.current = audio.id;
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio]);

  const publishSlot = useCallback(() => {
    slotRef.current?.measureInWindow?.((x, y, width, height) => {
      if (width > 0 && height > 0) updateSlot({ x, y, width, height });
    });
  }, [updateSlot]);

  const handlePdfAreaLayout = useCallback(() => {
    publishSlot();
  }, [publishSlot]);

  // Claim the process-wide Pdf host while this screen is focused.
  // Back only hides it — it must not unmount <Pdf> / recycle Pdfium.
  // present() is not in this effect: audio/openPage updates must not
  // run hide() (the focus cleanup) and flash the host off-screen.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      publishSlot();
      return () => {
        setFocused(false);
        hide();
      };
    }, [hide, publishSlot])
  );

  useEffect(() => {
    if (!focused || !hasTargetPage) return;
    if (__DEV__) {
      console.log('[PdfPage] reader present', {
        id: audio?.id ?? id,
        filename: audio?.filename,
        pdf_page: audio?.pdf_page,
        paramPage,
        openPage,
      });
    }
    present({ openPage, openKey: audio?.id ?? id ?? 0 });
    publishSlot();
  }, [focused, hasTargetPage, openPage, audio?.id, audio?.filename, audio?.pdf_page, paramPage, id, present, publishSlot]);

  // PDF loading only — audio has its own indicator in the player bar
  const showPdfLoading = !pdfError && (pdfResolving || !pdfReady || !pageReady);
  const rangeLabel = audio
    ? formatHadithRange(audio.hadith_number_from, audio.hadith_number_to)
    : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back to lessons"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {audio?.title ?? (audioLoading ? 'Opening lesson…' : 'Lesson')}
            </Text>
            {rangeLabel ? (
              <Text style={styles.headerSub} numberOfLines={1}>{rangeLabel}</Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            {totalPages > 0 ? (
              <View style={styles.pageBadge}>
                <Text style={styles.pageCounter} numberOfLines={1}>
                  Page {currentPage} / {totalPages}
                </Text>
              </View>
            ) : (
              <View style={styles.headerRightSpacer} />
            )}
          </View>
        </View>
      </SafeAreaView>

      <View
        ref={slotRef}
        style={styles.pdfArea}
        onLayout={handlePdfAreaLayout}
        collapsable={false}
      >
        {pdfError ? (
          <PdfErrorView error={pdfError} onRetry={retry} />
        ) : null}

        {showPdfLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Opening the book…</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.playerShell, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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

// Live ticks stay inside PlayerBar — PDF / shell do not re-render on time updates
const PlayerBar = memo(function PlayerBar({ audio }) {
  const {
    currentAudio, audioError, clearAudioError,
    isPlaying, audioLoading,
    currentTime, duration, didJustFinish,
    playbackRate, downloadProgress,
    loadAudio, play, pause, seek, setSpeed,
  } = useAudioPlayer();

  const isThis = currentAudio?.id === audio?.id;
  const playing = isThis && isPlaying && !didJustFinish;
  const isDownloading = isThis && downloadProgress != null && downloadProgress < 1;
  // Spinner only while the source is still starting — never for a cache check
  // or expo-audio isBuffering on a local file (that flash is what made play feel slow).
  const showPlaySpinner = isThis && audioLoading && !playing;
  const time = isThis ? currentTime : 0;
  const dur = isThis && duration > 0 ? duration : 0;
  const downloadPct = Math.round(Math.min(Math.max(downloadProgress ?? 0, 0), 1) * 100);

  const trackRef = useRef(null);
  const trackMetrics = useRef({ pageX: 0, width: 0 });

  // While dragging: UI follows finger only (ignore live currentTime).
  // After release: hold the chosen time until the player status catches up,
  // otherwise the thumb briefly snaps back to the still-old currentTime.
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekRatio, setSeekRatio] = useState(0);
  const [heldTime, setHeldTime] = useState(null);
  const isSeekingRef = useRef(false);
  const heldTimeRef = useRef(null);
  const moveRafRef = useRef(null);
  const pendingRatioRef = useRef(0);

  // Drop the held scrub time once live status is close enough
  useEffect(() => {
    if (heldTime == null) return;
    if (Math.abs(time - heldTime) <= 0.45) {
      heldTimeRef.current = null;
      setHeldTime(null);
    }
  }, [time, heldTime]);

  // Absolute fallback so a slow/failed seek cannot pin the thumb forever
  useEffect(() => {
    if (heldTime == null) return undefined;
    const timeoutId = setTimeout(() => {
      heldTimeRef.current = null;
      setHeldTime(null);
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [heldTime]);

  // Clear hold when this bar is no longer the active track
  useEffect(() => {
    if (isThis) return;
    heldTimeRef.current = null;
    setHeldTime(null);
    isSeekingRef.current = false;
    setIsSeeking(false);
  }, [isThis]);

  const displayTime = isSeeking
    ? seekRatio * (dur || 0)
    : (heldTime != null ? heldTime : time);
  const displayRatio = dur > 0
    ? Math.min(Math.max(displayTime / dur, 0), 1)
    : 0;

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow?.((x, _y, width) => {
      if (width > 0) trackMetrics.current = { pageX: x, width };
    });
  }, []);

  const pageXToRatio = useCallback((pageX) => {
    const { pageX: origin, width } = trackMetrics.current;
    if (!width || width <= 0) return 0;
    return Math.max(0, Math.min((pageX - origin) / width, 1));
  }, []);

  const seekRef = useRef(seek);
  const durRef = useRef(dur);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { durRef.current = dur; }, [dur]);

  const finishScrub = useCallback((ratio) => {
    const durNow = durRef.current;
    const finalPos = durNow > 0 ? ratio * durNow : 0;
    pendingRatioRef.current = ratio;
    setSeekRatio(ratio);
    heldTimeRef.current = finalPos;
    setHeldTime(finalPos);
    isSeekingRef.current = false;
    setIsSeeking(false);
    // Single native seek on release — not on every move
    if (durNow > 0) {
      seekRef.current(finalPos);
    }
  }, []);

  const finishScrubRef = useRef(finishScrub);
  useEffect(() => { finishScrubRef.current = finishScrub; }, [finishScrub]);

  const stablePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        measureTrack();
        const ratio = pageXToRatio(evt.nativeEvent.pageX);
        // Cancel any post-release hold; finger is the source of truth again
        heldTimeRef.current = null;
        setHeldTime(null);
        isSeekingRef.current = true;
        pendingRatioRef.current = ratio;
        setIsSeeking(true);
        setSeekRatio(ratio);
      },

      onPanResponderMove: (evt) => {
        if (!isSeekingRef.current) return;
        // Coalesce move updates to one per frame (avoids setState storms)
        pendingRatioRef.current = pageXToRatio(evt.nativeEvent.pageX);
        if (moveRafRef.current != null) return;
        moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          if (!isSeekingRef.current) return;
          setSeekRatio(pendingRatioRef.current);
        });
      },

      onPanResponderRelease: (evt) => {
        if (moveRafRef.current != null) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
        const ratio = pageXToRatio(evt.nativeEvent.pageX);
        finishScrubRef.current(ratio);
      },

      onPanResponderTerminate: (evt) => {
        if (moveRafRef.current != null) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
        const ratio = pageXToRatio(evt.nativeEvent.pageX);
        finishScrubRef.current(ratio);
      },
    })
  ).current;

  // Drop any pending rAF on unmount
  useEffect(() => () => {
    if (moveRafRef.current != null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
  }, []);

  const [speedOpen, setSpeedOpen] = useState(false);

  const handlePlayPause = useCallback(() => {
    clearAudioError();
    if (!isThis || audioError) {
      loadAudio(audio, audio.position_ms ?? 0);
      return;
    }
    if (audioLoading) return;
    if (playing) pause();
    else play();
  }, [isThis, playing, audio, audioError, audioLoading, loadAudio, play, pause, clearAudioError]);

  const handleRetryDownload = useCallback(() => {
    clearAudioError();
    loadAudio(audio, audio.position_ms ?? 0);
  }, [audio, loadAudio, clearAudioError]);

  const skip = useCallback((delta) => {
    if (!isThis || dur <= 0) return;
    // Prefer the visible position if a scrub/hold is in progress
    const base = isSeeking
      ? seekRatio * dur
      : (heldTime != null ? heldTime : time);
    const next = Math.max(0, Math.min(base + delta, dur));
    heldTimeRef.current = next;
    setHeldTime(next);
    seek(next);
  }, [isThis, dur, isSeeking, seekRatio, heldTime, time, seek]);

  const handleSelectSpeed = useCallback((rate) => {
    setSpeed(rate);
    setSpeedOpen(false);
  }, [setSpeed]);

  const speedLabel = useMemo(() => {
    const found = SPEED_OPTIONS.find((o) => o.rate === playbackRate);
    return found?.label ?? (playbackRate === 1 ? '1×' : `${playbackRate}×`);
  }, [playbackRate]);

  const rangeLabel = formatHadithRange(
    audio?.hadith_number_from,
    audio?.hadith_number_to
  );

  const timeStr = fmt(displayTime);
  const durStr = dur > 0 ? fmt(dur) : '--:--';
  const fillWidth = `${Math.round(displayRatio * 1000) / 10}%`;

  const accessValue = useMemo(() => ({
    min: 0,
    max: Math.max(0, Math.round(dur)),
    now: Math.round(displayTime),
    text: `${fmt(displayTime)} of ${dur > 0 ? fmt(dur) : 'unknown duration'}`,
  }), [displayTime, dur]);

  return (
    <View style={pl.container}>
      <View style={pl.topRow}>
        <View style={pl.trackInfo}>
          <Text style={pl.trackTitle} numberOfLines={1}>{audio?.title ?? ''}</Text>
          {rangeLabel ? (
            <Text style={pl.trackRange} numberOfLines={1}>{rangeLabel}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={pl.speedBtn}
          onPress={() => setSpeedOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel={`Playback speed, currently ${speedLabel}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={pl.speedLabel}>{speedLabel}</Text>
        </TouchableOpacity>
      </View>

      {isThis && isDownloading ? (
        <View style={pl.downloadRow}>
          <Text style={pl.downloadText}>
            {playing ? `Saving for offline ${downloadPct}%` : `Downloading ${downloadPct}%`}
          </Text>
          <View style={pl.downloadTrack}>
            <View style={[pl.downloadFill, { width: `${downloadPct}%` }]} />
          </View>
        </View>
      ) : null}

      {isThis && audioError ? (
        <View style={pl.errorRow}>
          <Text style={pl.errorText}>
            {audioErrorMessage(audioError)}
          </Text>
          <TouchableOpacity
            onPress={handleRetryDownload}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Try downloading again"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={pl.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={pl.timeRow}>
        <Text style={pl.timeText}>{timeStr}</Text>
        <Text style={pl.timeText}>{durStr}</Text>
      </View>

      <View
        ref={trackRef}
        style={pl.trackWrap}
        onLayout={measureTrack}
        accessibilityRole="adjustable"
        accessibilityLabel="Audio progress"
        accessibilityValue={accessValue}
        {...stablePan.panHandlers}
      >
        <View style={pl.trackBg}>
          <View style={[pl.trackFill, { width: fillWidth }]} />
        </View>
        <View
          style={[
            pl.thumb,
            { left: fillWidth },
            isSeeking && pl.thumbDragging,
          ]}
        />
      </View>

      <View style={pl.controls}>
        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(-10)}
          activeOpacity={0.65}
          accessibilityLabel="Rewind 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={pl.skipIcon}>−10</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pl.playBtn, playing && pl.playBtnActive]}
          onPress={handlePlayPause}
          activeOpacity={0.85}
          accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
          accessibilityRole="button"
          accessibilityState={{ busy: showPlaySpinner, checked: playing }}
        >
          {showPlaySpinner ? (
            <ActivityIndicator color={colors.hero} size="small" />
          ) : (
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={28}
              color={colors.heroDark}
              style={!playing && pl.playIconOffset}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={pl.skipBtn}
          onPress={() => skip(10)}
          activeOpacity={0.65}
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={pl.skipIcon}>+10</Text>
        </TouchableOpacity>
      </View>

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
      <Pressable
        style={sp.backdrop}
        onPress={onClose}
        accessibilityLabel="Close speed selector"
        accessibilityRole="button"
      />
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
              {active ? <Text style={sp.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
});

function PdfErrorView({ error, onRetry }) {
  if (error) console.error('[PdfErrorView]', error);

  const msg = error?.message ?? '';
  const isNative =
    msg.includes('NativeModule') ||
    msg.includes('RNPDFPdf') ||
    msg.includes('cannot be null');
  const isTimeout = msg.includes('too long to open');

  return (
    <View style={styles.pdfError}>
      <Text style={styles.pdfErrorTitle}>Unable to open the book.</Text>
      <Text style={styles.pdfErrorBody}>
        {isNative
          ? 'The PDF viewer needs a development build. Please rebuild and try again.'
          : isTimeout
            ? 'The book is taking longer than expected. Please try again.'
            : 'Please try again.'}
      </Text>
      {!isNative && onRetry ? (
        <TouchableOpacity
          style={styles.pdfRetryBtn}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <Text style={styles.pdfRetryText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  headerSafe: {
    backgroundColor: colors.heroDark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 8,
    minHeight: 52,
  },
  headerBack: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 34,
    color: colors.heroText,
    lineHeight: 38,
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
    minWidth: 72,
    maxWidth: 110,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  headerRightSpacer: { width: 72 },
  pageBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: '100%',
  },
  pageCounter: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  pdfArea: {
    flex: 1,
    backgroundColor: '#EDEDE9',
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EDEDE9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  pdfError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  pdfErrorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pdfErrorBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  pdfRetryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  pdfRetryText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
  playerShell: {
    backgroundColor: colors.heroDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 12,
  },
  playerMessage: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  playerMessageText: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
  },
});

const pl = StyleSheet.create({
  container: {
    paddingBottom: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  trackInfo: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heroText,
    letterSpacing: 0.1,
  },
  trackRange: {
    fontSize: 11,
    color: colors.heroSubtext,
    marginTop: 2,
  },
  downloadRow: {
    marginBottom: spacing.sm,
  },
  downloadText: {
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '600',
  },
  downloadTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  downloadFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  errorRow: {
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryText: {
    fontSize: 13,
    color: colors.heroText,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  // Tall hit area; visible track is thinner inside
  trackWrap: {
    height: 36,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  trackBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.gold,
    marginTop: -10,
    marginLeft: -10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  thumbDragging: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginTop: -13,
    marginLeft: -13,
    borderWidth: 3.5,
    elevation: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl + spacing.sm,
    paddingBottom: spacing.xs,
  },
  skipBtn: {
    minWidth: 44,
    minHeight: 33,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipIcon: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heroSubtext,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.heroText,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  playBtnActive: {
    backgroundColor: colors.gold,
  },
  playIconOffset: {
    marginLeft: 3,
  },
  speedBtn: {
    minWidth: 48,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.3,
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
    borderRadius: 12,
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
