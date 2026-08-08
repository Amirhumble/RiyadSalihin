/**
 * AudioPlayer — compact, reusable playback UI.
 *
 * Props
 * ─────
 *   audioRecord  {object}   Row from the audios table.  Required.
 *   savedPositionMs {number} Optional resume position from DB.
 *
 * Reads live state from AudioContext (useAudio).
 * Does NOT manage its own player instance.
 */

import { useCallback, useEffect } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useAudio } from '@/context/AudioContext';

/** Format seconds → "m:ss" */
function formatTime(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return `${m}:${remaining.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ audioRecord, savedPositionMs = 0 }) {
  const {
    currentAudio,
    audioLoading,
    audioError,
    clearAudioError,
    isPlaying,
    isBuffering,
    isLoaded,
    didJustFinish,
    currentTime,
    duration,
    loadAudio,
    play,
    pause,
    seek,
  } = useAudio();

  // True when THIS audio record is the one currently loaded.
  const isThisAudio = currentAudio?.id === audioRecord?.id;
  const effectivePlaying = isThisAudio && isPlaying;
  const effectiveBuffering = isThisAudio && (isBuffering || audioLoading);
  const effectiveTime = isThisAudio ? currentTime : 0;
  const effectiveDuration = isThisAudio ? duration : 0;

  // Load on first mount if nothing is loaded, or if this is a different track.
  useEffect(() => {
    if (!audioRecord) return;
    if (!isThisAudio) return; // only auto-load when user explicitly taps play
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayPause = useCallback(() => {
    if (!audioRecord) return;
    clearAudioError();

    if (!isThisAudio) {
      // Load this track (starts playing immediately).
      loadAudio(audioRecord, savedPositionMs);
    } else if (effectivePlaying) {
      pause();
    } else {
      play();
    }
  }, [
    audioRecord,
    isThisAudio,
    effectivePlaying,
    savedPositionMs,
    loadAudio,
    play,
    pause,
    clearAudioError,
  ]);

  const handleSeek = useCallback(
    (ratio) => {
      if (!isThisAudio || !effectiveDuration) return;
      seek(ratio * effectiveDuration);
    },
    [isThisAudio, effectiveDuration, seek]
  );

  // ── Progress bar touch ─────────────────────────────────────────────
  // We use a simple percentage tap rather than a drag gesture to keep
  // the implementation dependency-free.
  const handleProgressPress = useCallback(
    (event) => {
      const { locationX, target } = event.nativeEvent;
      // locationX alone is not reliable without a measure; use a
      // layout-based ratio approximation.
      event.target?.measure?.((x, y, width) => {
        if (width > 0) handleSeek(locationX / width);
      });
    },
    [handleSeek]
  );

  // ── Render ─────────────────────────────────────────────────────────
  const progressRatio =
    isThisAudio && effectiveDuration > 0
      ? Math.min(effectiveTime / effectiveDuration, 1)
      : 0;

  return (
    <View style={styles.container}>
      {/* ── Title ─────────────────────────────────────────────── */}
      {audioRecord?.title && (
        <Text style={styles.title} numberOfLines={1}>
          {audioRecord.title}
        </Text>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {isThisAudio && audioError && (
        <Text style={styles.errorText} numberOfLines={2}>
          ⚠️  {audioError.message}
        </Text>
      )}

      {/* ── Controls row ──────────────────────────────────────── */}
      <View style={styles.controls}>
        {/* Play / Pause / Loading */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={effectivePlaying ? 'Pause audio' : 'Play audio'}
          accessibilityState={{ busy: effectiveBuffering }}
        >
          {effectiveBuffering ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.playIcon}>{effectivePlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>

        {/* Timestamp + progress bar */}
        <View style={styles.progressGroup}>
          {/* Progress bar — tap to seek */}
          <TouchableOpacity
            style={styles.progressTrack}
            onPress={handleProgressPress}
            activeOpacity={1}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek through audio"
            accessibilityValue={{
              now: Math.round(effectiveTime),
              min: 0,
              max: Math.round(effectiveDuration),
            }}
          >
            <View
              style={[styles.progressFill, { flex: progressRatio }]}
            />
            <View
              style={[styles.progressRemain, { flex: 1 - progressRatio }]}
            />
          </TouchableOpacity>

          {/* Time labels */}
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(effectiveTime)}</Text>
            <Text style={styles.timeText}>
              {effectiveDuration > 0 ? formatTime(effectiveDuration) : '--:--'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Completion message ────────────────────────────────── */}
      {isThisAudio && didJustFinish && (
        <Text style={styles.finishedText}>Playback complete</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.sm,
  },

  errorText: {
    fontSize: 12,
    color: colors.error,
    marginBottom: spacing.sm,
  },

  // Controls row
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Play button
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playIcon: {
    fontSize: 18,
    color: colors.textInverse,
    // Optical centering
    marginLeft: 2,
  },

  // Progress
  progressGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressRemain: {
    backgroundColor: 'transparent',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontVariant: ['tabular-nums'],
  },

  finishedText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
