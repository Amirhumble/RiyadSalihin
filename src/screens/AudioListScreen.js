import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Keyboard,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DownloadAllBar from '@/components/audio/DownloadAllBar';
import AppModal from '@/components/common/AppModal';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import TelegramCta from '@/components/common/TelegramCta';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useAudio } from '@/context/AudioContext';
import { getAllAudios } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { preparePdfAsset } from '@/services/pdfAsset';
import { formatHadithRange } from '@/utils/formatHadithRange';
import { findLessonByHadithNumber, parseHadithNumber } from '@/utils/hadithSearch';

function fmtMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = Math.floor(n / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSec(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return '0:00';
  const s = Math.floor(n);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function AudioListScreen() {
  const router = useRouter();
  const [hadithQuery, setHadithQuery] = useState('');
  const [searchDialog, setSearchDialog] = useState(null);

  const { data: audios, loading, error, refetch } = useDbQuery(
    () => getAllAudios(),
    []
  );

  // Copy the bundled PDF to a local URI while the user browses the list.
  // Does not mount <Pdf> — that stays in ReaderScreen.
  useEffect(() => {
    preparePdfAsset().catch((err) => {
      console.warn('[AudioListScreen] PDF asset prep failed:', err);
    });
  }, []);

  // Refresh progress labels when returning from the reader (no full-screen flash)
  useFocusEffect(
    useCallback(() => {
      refetch({ silent: true });
    }, [refetch])
  );

  const handlePress = useCallback(
    (audio) => {
      const page = Number(audio?.pdf_page);
      const pdfPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      if (__DEV__) {
        console.log('[PdfPage] list tap', {
          id: audio?.id,
          filename: audio?.filename,
          pdf_page: audio?.pdf_page,
          navigationPdfPage: pdfPage,
        });
      }
      router.push({
        pathname: '/reader',
        params: {
          audioId: String(audio.id),
          pdfPage: String(pdfPage),
        },
      });
    },
    [router]
  );

  const closeSearchDialog = useCallback(() => setSearchDialog(null), []);

  const handleHadithSearch = useCallback(() => {
    Keyboard.dismiss();
    const parsed = parseHadithNumber(hadithQuery);
    if (!parsed.ok) {
      setSearchDialog({
        title: parsed.reason === 'empty' ? 'Enter a hadith number' : 'Invalid hadith number',
        message: parsed.reason === 'empty'
          ? 'Type a hadith number to open the lesson that contains it.'
          : 'Please enter a whole number, for example 25.',
        actions: [{ label: 'OK', onPress: closeSearchDialog }],
      });
      return;
    }

    const lesson = findLessonByHadithNumber(audios, parsed.value);
    if (!lesson) {
      setSearchDialog({
        title: 'Hadith not found',
        message: `No lesson contains hadith ${parsed.value}.`,
        actions: [{ label: 'OK', onPress: closeSearchDialog }],
      });
      return;
    }

    handlePress(lesson);
  }, [audios, closeSearchDialog, hadithQuery, handlePress]);

  if (loading) return <ScreenLoader message="Loading lessons…" variant="lessons" />;
  if (error) {
    return (
      <ScreenError
        message="Something went wrong while loading the lessons."
        onRetry={refetch}
      />
    );
  }

  const count = audios?.length ?? 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroDark} />

      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerAccentRule} />
          <Text style={styles.headerArabic}>رياض الصالحين</Text>
          <Text style={styles.headerLatin}>Riyad as-Salihin</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerInstruction}>
            {count > 0
              ? `${count} lesson${count !== 1 ? 's' : ''} · Tap a lesson to listen and read`
              : 'Select a lesson to listen and read'}
          </Text>

          <View style={styles.headerCta}>
            <TelegramCta variant="hero" />
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={hadithQuery}
              onChangeText={setHadithQuery}
              placeholder="Hadith number"
              placeholderTextColor={colors.heroMuted}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={handleHadithSearch}
              maxLength={6}
              selectTextOnFocus
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              accessibilityLabel="Search by hadith number"
              accessibilityHint="Enter a hadith number to open its lesson"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleHadithSearch}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open lesson for this hadith"
            >
              <Text style={styles.searchBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <DownloadAllBar audios={audios} />

      <FlatList
        data={audios}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <AudioRow audio={item} onPress={handlePress} />
        )}
        ListEmptyComponent={EmptyView}
        contentContainerStyle={count === 0 ? styles.emptyFill : styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        removeClippedSubviews={false}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={12}
      />

      <AppModal
        visible={Boolean(searchDialog)}
        title={searchDialog?.title}
        message={searchDialog?.message}
        dismissable
        onClose={closeSearchDialog}
        actions={searchDialog?.actions}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

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

function buildMetaLabel({ inProgress, isCompleted, position, totalDur, duration }) {
  if (isCompleted) {
    return totalDur ? `✓ Completed · ${totalDur}` : '✓ Completed';
  }
  if (inProgress) {
    // Never show "null" — omit duration when unknown
    return totalDur ? `Continue · ${position} / ${totalDur}` : `Continue · ${position}`;
  }
  return duration || null;
}

// Only re-renders when this row's audio prop or active/playing state changes
const AudioRow = memo(function AudioRow({ audio, onPress }) {
  const { currentAudio, isPlaying } = useAudio();

  const isActive = currentAudio?.id === audio.id;
  const isNowPlaying = isActive && isPlaying;

  const positionMs = Number(audio.position_ms) || 0;
  const durationMs = Number(audio.duration_ms) || 0;
  const hasDuration = durationMs > 0;
  const hasPosition = positionMs > 500;
  const progress = hasDuration ? Math.min(positionMs / durationMs, 1) : 0;
  const isCompleted = hasDuration && progress >= 0.98;
  const inProgress = hasPosition && !isCompleted;

  const rangeLabel = formatHadithRange(audio.hadith_number_from, audio.hadith_number_to);
  const duration = fmtMs(durationMs);
  const position = fmtSec(positionMs / 1000);
  const totalDur = fmtMs(durationMs);
  const metaLabel = buildMetaLabel({ inProgress, isCompleted, position, totalDur, duration });

  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onPress={() => onPress(audio)}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${audio.ordering}: ${audio.title}`}
      accessibilityHint="Tap to open and listen"
      accessibilityState={{ selected: isActive }}
    >
      <View style={[styles.badge, isActive && styles.badgeActive]}>
        <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
          {String(audio.ordering).padStart(2, '0')}
        </Text>
      </View>

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

        {metaLabel ? (
          <Text
            style={[
              styles.metaText,
              inProgress && styles.resumeText,
              isCompleted && styles.completedText,
            ]}
            numberOfLines={1}
          >
            {metaLabel}
          </Text>
        ) : null}

        {inProgress && hasDuration ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafe: { backgroundColor: colors.hero },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAccentRule: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: colors.heroAccent,
    opacity: 0.35,
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
    backgroundColor: colors.heroAccent,
    opacity: 0.4,
    marginVertical: spacing.sm,
    borderRadius: 1,
  },
  headerInstruction: {
    fontSize: 12,
    color: colors.heroMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  headerCta: {
    width: '100%',
    marginTop: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    width: '100%',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.heroFill,
    borderWidth: 1,
    borderColor: colors.heroBorder,
    paddingHorizontal: spacing.md,
    color: colors.heroText,
    fontSize: 15,
  },
  searchBtn: {
    height: 44,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.heroText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIcon: { fontSize: 44, marginBottom: spacing.md },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    minHeight: 80,
  },
  rowActive: { backgroundColor: colors.primaryLight },
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
  info: { flex: 1, marginRight: spacing.sm },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 3,
  },
  titleActive: { color: colors.primary },
  range: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  resumeText: { color: colors.primary, fontWeight: '500' },
  completedText: { color: colors.success, fontWeight: '500' },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
