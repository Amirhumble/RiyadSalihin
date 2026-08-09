/**
 * AudioListScreen — the main screen of the application.
 *
 * Displays all available audio tracks in a scrollable list.
 * Each row shows the track number, title, chapter/hadith context,
 * duration (when known), and a play button.
 *
 * Tapping anywhere on a row opens the Reader.
 * Audio data comes entirely from SQLite — nothing is hardcoded here.
 */

import { useRouter } from 'expo-router';
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

// Format milliseconds → "m:ss" or null
function formatDuration(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Format seconds → "m:ss"
function formatSecs(sec) {
  if (!sec || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AudioListScreen() {
  const router = useRouter();

  const { data: audios, loading, error, refetch } = useDbQuery(
    () => getAllAudiosWithChapterInfo(),
    []
  );

  if (loading) return <ScreenLoader message="Loading…" />;
  if (error)   return <ScreenError onRetry={refetch} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      {/* ── Dark header ─────────────────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerArabic}>رياض الصالحين</Text>
          <Text style={styles.headerLatin}>Riyad as-Salihin</Text>
          <Text style={styles.headerSub}>
            {audios?.length
              ? `${audios.length} recitation${audios.length !== 1 ? 's' : ''}`
              : ''}
          </Text>
        </View>
      </SafeAreaView>

      {/* ── Audio list ──────────────────────────────────────────── */}
      <FlatList
        data={audios}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <AudioRow
            audio={item}
            onPress={() => router.push(`/reader?audioId=${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No audio available yet.</Text>
            <Text style={styles.emptySubtext}>
              Audio recitations will appear here once they are added.
            </Text>
          </View>
        }
        contentContainerStyle={
          audios?.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ── AudioRow ──────────────────────────────────────────────────────────────────

function AudioRow({ audio, onPress }) {
  const { currentAudio, isPlaying } = useAudio();

  const isActive  = currentAudio?.id === audio.id;
  const isThisPlaying = isActive && isPlaying;

  // progress ratio from saved position + duration
  const hasDuration = audio.duration_ms > 0;
  const progressRatio = hasDuration
    ? Math.min((audio.position_ms ?? 0) / audio.duration_ms, 1)
    : 0;
  const hasProgress = progressRatio > 0.005;

  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={audio.title}
      accessibilityHint="Open to read and listen"
    >
      {/* ── Left: number ───────────────────────────────────────── */}
      <View style={[styles.numCol, isActive && styles.numColActive]}>
        <Text style={[styles.numText, isActive && styles.numTextActive]}>
          {String(audio.ordering).padStart(2, '0')}
        </Text>
      </View>

      {/* ── Centre: info ───────────────────────────────────────── */}
      <View style={styles.infoCol}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={2}>
          {audio.title}
        </Text>

        {/* Chapter context */}
        {audio.chapter_english_title ? (
          <Text style={styles.meta} numberOfLines={1}>
            {audio.chapter_number_val
              ? `Chapter ${audio.chapter_number_val}  ·  `
              : ''}
            {audio.chapter_english_title}
          </Text>
        ) : null}

        {/* Duration + progress */}
        <View style={styles.bottomRow}>
          {hasDuration ? (
            <Text style={styles.duration}>
              {formatDuration(audio.duration_ms)}
            </Text>
          ) : null}

          {/* Progress bar if user has started listening */}
          {hasProgress && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
          )}

          {/* Saved position label */}
          {audio.position_ms > 0 && (
            <Text style={styles.posLabel}>
              {formatSecs(audio.position_ms / 1000)} played
            </Text>
          )}
        </View>
      </View>

      {/* ── Right: play indicator ──────────────────────────────── */}
      <View style={[styles.playCol, isThisPlaying && styles.playColActive]}>
        <Text style={[styles.playIcon, isThisPlaying && styles.playIconActive]}>
          {isThisPlaying ? '▶' : '▷'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  headerSafe: {
    backgroundColor: colors.hero,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.hero,
  },
  headerArabic: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.heroText,
    textAlign: 'center',
    writingDirection: 'rtl',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerLatin: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.heroSubtext,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 12,
    color: colors.heroMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // List
  listContent: {
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 72,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
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
    minHeight: 72,
  },
  rowActive: {
    backgroundColor: colors.primaryLight,
  },

  // Number column
  numCol: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  numColActive: {
    backgroundColor: colors.primary,
  },
  numText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  numTextActive: {
    color: colors.textInverse,
  },

  // Info column
  infoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 3,
  },
  titleActive: {
    color: colors.primary,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  duration: {
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    maxWidth: 100,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  posLabel: {
    fontSize: 10,
    color: colors.gold,
  },

  // Play column
  playCol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playColActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  playIcon: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 2,
  },
  playIconActive: {
    color: colors.textInverse,
  },
});
