/**
 * AudioListScreen — main screen of the application.
 *
 * PERFORMANCE
 * ───────────
 * AudioRow is wrapped in React.memo. It only re-renders when its own
 * `audio` prop or the active/playing state changes — NOT on every
 * playback tick. This keeps 50+ rows performant during audio playback.
 *
 * useAudio() only returns stable context + isPlaying (not currentTime),
 * so row re-renders are limited to track-switch and play/pause events.
 */

import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import {
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio } from '@/context/AudioContext';
import { getAllAudiosWithChapterInfo } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatHadithRange } from '@/utils/formatHadithRange';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms) {
  if (!ms || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSec(sec) {
  if (!sec || sec <= 0) return '0:00';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AudioListScreen() {
  const router = useRouter();

  const { data: audios, loading, error, refetch } = useDbQuery(
    () => getAllAudiosWithChapterInfo(),
    []
  );

  // Stable callback — does not change identity on re-render
  const handlePress = useCallback(
    (audioId) => router.push(`/reader?audioId=${audioId}`),
    [router]
  );

  if (loading) return <ScreenLoader message="Loading lessons…" />;
  if (error)   return (
    <ScreenError
      message="Something went wrong while loading the lessons."
      onRetry={refetch}
    />
  );

  const count = audios?.length ?? 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerGoldRule} />
          <Text style={styles.headerArabic}>رياض الصالحين</Text>
          <Text style={styles.headerLatin}>Riyad as-Salihin</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerInstruction}>
            {count > 0
              ? `${count} lesson${count !== 1 ? 's' : ''} · Tap a lesson to listen and read`
              : 'Select a lesson to listen and read'}
          </Text>
        </View>
      </SafeAreaView>

      {/* List */}
      <FlatList
        data={audios}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <AudioRow audio={item} onPress={handlePress} />
        )}
        ListEmptyComponent={EmptyView}
        contentContainerStyle={count === 0 ? styles.emptyFill : styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        // Performance: avoid re-rendering every row on scroll
        removeClippedSubviews={false}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={12}
      />
    </View>
  );
}

function keyExtractor(item) { return String(item.id); }

// ── Separator ─────────────────────────────────────────────────────────────────

function Separator() {
  return <View style={styles.separator} />;
}

// ── EmptyView ─────────────────────────────────────────────────────────────────

function EmptyView() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📖</Text>
      <Text style={styles.emptyTitle}>No lessons available yet.</Text>
      <Text style={styles.emptySub}>
        Lessons will appear here once they are added.
      </Text>
    </View>
  );
}

// ── AudioRow ──────────────────────────────────────────────────────────────────
// memo: only re-renders when audio prop or isActive/isPlaying changes.
// Does NOT re-render on currentTime updates — those only affect PlayerBar.

const AudioRow = memo(function AudioRow({ audio, onPress }) {
  const { currentAudio, isPlaying } = useAudio();

  const isActive     = currentAudio?.id === audio.id;
  const isNowPlaying = isActive && isPlaying;

  const hasDuration  = audio.duration_ms > 0;
  const hasPosition  = (audio.position_ms ?? 0) > 500;
  const progress     = hasDuration
    ? Math.min((audio.position_ms ?? 0) / audio.duration_ms, 1)
    : 0;
  const isCompleted  = hasDuration && progress >= 0.98;
  const inProgress   = hasPosition && !isCompleted;

  const rangeLabel = formatHadithRange(audio.hadith_number_from, audio.hadith_number_to);
  const duration   = fmtMs(audio.duration_ms);
  const position   = fmtSec((audio.position_ms ?? 0) / 1000);
  const totalDur   = fmtMs(audio.duration_ms);
  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onPress={() => onPress(audio.id)}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${audio.ordering}: ${audio.title}`}
      accessibilityHint="Tap to open and listen"
      accessibilityState={{ selected: isActive }}
    >
      {/* Number badge */}
      <View style={[styles.badge, isActive && styles.badgeActive]}>
        <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
          {String(audio.ordering).padStart(2, '0')}
        </Text>
      </View>

      {/* Centre info */}
      <View style={styles.info}>
        <Text
          style={[styles.title, isActive && styles.titleActive]}
          numberOfLines={2}
        >
          {audio.title}
        </Text>

        {rangeLabel ? (
          <Text style={styles.range} numberOfLines={1}>{rangeLabel}</Text>
        ) : null}

        {/* Meta: duration / resume / completed */}
        <View style={styles.meta}>
          {/* Unstarted or no position: show duration alone */}
          {!inProgress && !isCompleted && duration ? (
            <Text style={styles.metaText}>{duration}</Text>
          ) : null}

          {/* In progress: "Continue · pos / total" */}
          {inProgress && (
            <Text style={[styles.metaText, styles.resumeText]} numberOfLines={1}>
              {`Continue · ${position}${totalDur ? ` / ${totalDur}` : ''}`}
            </Text>
          )}

          {/* Completed: "✓ Completed · total" */}
          {isCompleted && (
            <Text style={[styles.metaText, styles.completedText]} numberOfLines={1}>
              {`✓ Completed${totalDur ? ` · ${totalDur}` : ''}`}
            </Text>
          )}
        </View>

        {/* Progress bar */}
        {inProgress && hasDuration && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
        )}
      </View>

      {/* Play state indicator */}
      <View
        style={[
          styles.playBtn,
          isActive && styles.playBtnActive,
          isNowPlaying && styles.playBtnPlaying,
        ]}
      >
        <Text style={[
          styles.playIcon,
          isActive && styles.playIconActive,
          isNowPlaying && styles.playIconPlaying,
        ]}>
          {isNowPlaying ? '▶' : '▷'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  headerSafe: { backgroundColor: colors.hero },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerGoldRule: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.55,
  },
  headerArabic: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  headerLatin: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 2,
  },
  headerDivider: {
    width: 36,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.5,
    marginVertical: spacing.sm,
    borderRadius: 1,
  },
  headerInstruction: {
    fontSize: 12,
    color: colors.heroMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // List
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  emptyFill: { flex: 1 },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 72 + spacing.md,
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIcon:  { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 76,
  },
  rowActive: { backgroundColor: colors.primaryLight },

  // Badge
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  badgeActive: { backgroundColor: colors.primary },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  badgeTextActive: { color: colors.textInverse },

  // Info
  info: { flex: 1, marginRight: spacing.sm },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 2,
  },
  titleActive: { color: colors.primary },
  range: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },

  // Meta
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  metaDot: { fontSize: 11, color: colors.borderLight },
  resumeText: { color: colors.primary, fontWeight: '500' },  completedText: { color: colors.success, fontWeight: '500' },

  // Progress bar
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },

  // Play button
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playBtnActive: { borderColor: colors.primary },
  playBtnPlaying: { backgroundColor: colors.primary, borderColor: colors.primary },
  playIcon: { fontSize: 14, color: colors.textMuted, marginLeft: 2 },
  playIconActive: { color: colors.primary },
  playIconPlaying: { color: colors.textInverse },
});
