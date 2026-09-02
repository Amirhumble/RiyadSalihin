import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppModal from '@/components/common/AppModal';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { getAllAudios } from '@/database/repositories/audioRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useDownloadAll } from '@/hooks/useDownloadAll';
import {
  cancelDownloadAll,
  classifyAudioCache,
  downloadAllAudios,
  estimateMissingBytes,
  formatBytes,
  formatSpeed,
  isDownloadAllRunning,
  scanDownloadAllCache,
} from '@/services/audioDownloadAll';

const FAILED = '#B42318';
const ROW_HEIGHT = 52;

function lessonLabel(audio) {
  if (!audio) return 'Lesson';
  const num = audio.ordering != null
    ? `Lesson ${String(audio.ordering).padStart(2, '0')}`
    : 'Lesson';
  return audio.title ? `${num} · ${audio.title}` : num;
}

function stateCopy(status) {
  switch (status) {
    case 'scanning': return 'Checking';
    case 'downloading': return 'Downloading';
    case 'cancelling': return 'Stopping';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Stopped';
    case 'partial': return 'Failed';
    default: return 'Ready';
  }
}

export default function DownloadManagerScreen() {
  const router = useRouter();
  const snapshot = useDownloadAll();
  const { data: audios, loading, error, refetch } = useDbQuery(
    () => getAllAudios(),
    []
  );
  const [dialog, setDialog] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [starting, setStarting] = useState(false);

  const list = audios ?? [];
  const running = snapshot.status === 'downloading'
    || snapshot.status === 'scanning'
    || snapshot.status === 'cancelling';
  const busy = running || preparing || starting;

  const closeDialog = useCallback(() => setDialog(null), []);
  const showDialog = useCallback((next) => setDialog(next), []);

  useFocusEffect(
    useCallback(() => {
      if (audios?.length && !isDownloadAllRunning()) {
        scanDownloadAllCache(audios);
      }
    }, [audios])
  );

  const startDownload = useCallback(async (items, estimatedBytes) => {
    setDialog(null);
    setPreparing(false);
    setStarting(true);
    try {
      await downloadAllAudios(items, { estimatedBytes });
    } catch (err) {
      const offline = err?.code === 'DOWNLOAD_REQUIRED'
        || String(err?.message || '').toLowerCase().includes('network');
      if (err?.code === 'ALREADY_RUNNING') {
        showDialog({
          title: 'Download in progress',
          message: 'Please wait for the current download to finish, or cancel it.',
          actions: [{ label: 'OK', onPress: closeDialog }],
        });
      } else {
        showDialog({
          title: offline ? 'No internet connection' : 'Could not download lessons',
          message: offline
            ? 'Connect to the internet and try again. Lessons already saved on this device will still play offline.'
            : 'Something went wrong while downloading. Please try again.',
          actions: [{ label: 'OK', onPress: closeDialog }],
        });
      }
    } finally {
      setStarting(false);
      if (list.length) scanDownloadAllCache(list);
    }
  }, [closeDialog, list, showDialog]);

  const confirmAndStart = useCallback(async (items, { retry = false } = {}) => {
    if (busy || isDownloadAllRunning()) return;
    if (!items?.length) return;

    setPreparing(true);
    try {
      const { cached, missing, total } = classifyAudioCache(items);
      if (missing.length === 0) {
        scanDownloadAllCache(list.length ? list : items);
        showDialog({
          title: 'All lessons available offline',
          message: `${total} lesson${total === 1 ? '' : 's'} are already saved on this device.`,
          actions: [{ label: 'OK', onPress: closeDialog }],
        });
        return;
      }

      const estimate = await estimateMissingBytes(missing);
      if (estimate.networkFailures === missing.length && estimate.sizedCount === 0) {
        showDialog({
          title: 'No internet connection',
          message: 'Connect to the internet to download lessons. Lessons already saved on this device will still play offline.',
          actions: [{ label: 'OK', onPress: closeDialog }],
        });
        return;
      }

      const sizeLabel = estimate.sizedCount > 0 ? formatBytes(estimate.totalBytes) : null;
      const sizeLine = sizeLabel
        ? estimate.sizedCount === missing.length
          ? `\n\nAbout ${sizeLabel} to download.`
          : `\n\nAt least ${sizeLabel} to download.`
        : '';
      const estimatedBytes = estimate.sizedCount === missing.length
        ? estimate.totalBytes
        : null;

      showDialog({
        title: retry ? 'Retry failed downloads?' : 'Download all lessons?',
        message: retry
          ? `${missing.length} lesson${missing.length === 1 ? '' : 's'} failed and will be tried again.${sizeLine}`
          : `${missing.length} lesson${missing.length === 1 ? '' : 's'} will be saved for offline listening. ${cached.length} already on this device.${sizeLine}`,
        dismissable: true,
        actions: [
          { label: 'Not now', variant: 'secondary', onPress: closeDialog },
          {
            label: retry ? 'Retry' : 'Download',
            onPress: () => startDownload(items, estimatedBytes),
          },
        ],
      });
    } catch {
      showDialog({
        title: 'No internet connection',
        message: 'Connect to the internet to download lessons. Lessons already saved on this device will still play offline.',
        actions: [{ label: 'OK', onPress: closeDialog }],
      });
    } finally {
      setPreparing(false);
    }
  }, [busy, closeDialog, list, showDialog, startDownload]);

  const handleDownloadAll = useCallback(() => {
    confirmAndStart(list, { retry: false });
  }, [confirmAndStart, list]);

  const handleRetryFailed = useCallback(() => {
    const failed = snapshot.failedItems || [];
    if (!failed.length) return;
    confirmAndStart(failed, { retry: true });
  }, [confirmAndStart, snapshot.failedItems]);

  const handleCancel = useCallback(() => {
    if (!running || snapshot.status === 'cancelling') return;
    showDialog({
      title: 'Stop downloading?',
      message: 'Lessons that already finished will stay on this device. You can continue the rest later.',
      dismissable: true,
      actions: [
        { label: 'Keep downloading', variant: 'secondary', onPress: closeDialog },
        {
          label: 'Stop download',
          variant: 'destructive',
          onPress: () => {
            closeDialog();
            cancelDownloadAll();
          },
        },
      ],
    });
  }, [closeDialog, running, showDialog, snapshot.status]);

  const overallTitle = useMemo(() => {
    if (snapshot.status === 'scanning') return 'Checking saved lessons…';
    if (snapshot.status === 'cancelling') return 'Stopping downloads…';
    if (snapshot.status === 'downloading') {
      const subset = list.length > 0 && snapshot.total > 0 && snapshot.total < list.length;
      return subset
        ? `Retrying ${snapshot.saved} of ${snapshot.total}`
        : `Downloading ${snapshot.saved} of ${snapshot.total}`;
    }
    if (snapshot.status === 'completed') return 'All lessons available offline';
    if (snapshot.status === 'partial') {
      return `${snapshot.failed} lesson${snapshot.failed === 1 ? '' : 's'} failed`;
    }
    if (snapshot.status === 'cancelled') return 'Download stopped';
    if (snapshot.total > 0) return `${snapshot.saved} of ${snapshot.total} saved`;
    return 'Download lessons';
  }, [list.length, snapshot.failed, snapshot.saved, snapshot.status, snapshot.total]);

  const sizeLine = useMemo(() => {
    const have = formatBytes(snapshot.bytesHave);
    const total = snapshot.bytesReliable ? formatBytes(snapshot.bytesTotal) : null;
    if (have && total) return `${have} of ${total}`;
    if (have) return `${have} saved`;
    return null;
  }, [snapshot.bytesHave, snapshot.bytesReliable, snapshot.bytesTotal]);

  const currentSpeed = formatSpeed(snapshot.currentSpeedBps);
  const currentPct = Number.isFinite(snapshot.currentProgress)
    ? Math.round(Math.min(Math.max(snapshot.currentProgress, 0), 1) * 100)
    : null;
  const currentSize = useMemo(() => {
    const have = formatBytes(snapshot.currentBytes);
    const total = formatBytes(snapshot.currentTotalBytes);
    if (have && total) return `${have} of ${total}`;
    return have;
  }, [snapshot.currentBytes, snapshot.currentTotalBytes]);

  const showCompleted = snapshot.status === 'completed' && snapshot.total > 0;
  const showProgress = running || (snapshot.total > 0 && !showCompleted);
  const canDownload = snapshot.status !== 'completed' && list.length > 0;
  const canRetry = (snapshot.failedItems?.length || 0) > 0;
  const downloadLabel = snapshot.status === 'cancelled' || snapshot.status === 'partial'
    ? 'Download remaining'
    : 'Download all';

  const renderItem = useCallback(({ item }) => (
    <LessonRow
      audio={item}
      status={snapshot.statuses?.[item.filename] || 'idle'}
      progress={snapshot.fileProgress?.[item.filename]}
    />
  ), [snapshot.fileProgress, snapshot.statuses]);

  if (loading) return <ScreenLoader message="Loading lessons…" />;
  if (error) {
    return (
      <ScreenError
        message="Something went wrong while loading the lessons."
        onRetry={refetch}
      />
    );
  }

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
            <Text style={styles.headerTitle}>Downloads</Text>
            <Text style={styles.headerSub}>Offline lessons</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>

      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={[
            styles.statePill,
            showCompleted && styles.statePillDone,
            snapshot.status === 'partial' && styles.statePillFailed,
          ]}
          >
            {stateCopy(snapshot.status)}
          </Text>
          {snapshot.total > 0 ? (
            <Text style={styles.percent}>{snapshot.percent}%</Text>
          ) : null}
        </View>

        <Text style={styles.overallTitle}>{overallTitle}</Text>
        {sizeLine ? <Text style={styles.sizeLine}>{sizeLine}</Text> : null}

        {showCompleted ? (
          <Text style={styles.completedHint}>
            You can listen to every lesson without internet.
          </Text>
        ) : showProgress ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, snapshot.percent))}%` }]} />
          </View>
        ) : null}

        {running && snapshot.current ? (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current lesson</Text>
            <Text style={styles.currentTitle} numberOfLines={1}>
              {lessonLabel(snapshot.current)}
            </Text>
            <View style={styles.currentMetaRow}>
              <Text style={styles.currentMeta}>
                {snapshot.status === 'cancelling'
                  ? 'Stopping…'
                  : currentPct != null
                    ? `${currentPct}%`
                    : 'Starting…'}
              </Text>
              {currentSpeed ? (
                <Text style={styles.currentMeta}>{currentSpeed}</Text>
              ) : null}
              {currentSize ? (
                <Text style={styles.currentMeta}>{currentSize}</Text>
              ) : null}
            </View>
            {currentPct != null ? (
              <View style={styles.currentTrack}>
                <View style={[styles.currentFill, { width: `${currentPct}%` }]} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          {running ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger, snapshot.status === 'cancelling' && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={snapshot.status === 'cancelling'}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Stop download"
            >
              <Text style={styles.btnDangerText}>
                {snapshot.status === 'cancelling' ? 'Stopping…' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {canDownload ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
                  onPress={handleDownloadAll}
                  disabled={busy}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={downloadLabel}
                >
                  {preparing ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>{downloadLabel}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {canRetry ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, busy && styles.btnDisabled]}
                  onPress={handleRetryFailed}
                  disabled={busy}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Retry failed downloads"
                >
                  <Text style={styles.btnSecondaryText}>
                    Retry failed{snapshot.failed > 0 ? ` (${snapshot.failed})` : ''}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={snapshot}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={16}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.listHeading}>Lessons</Text>
        }
      />

      <AppModal
        visible={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        loading={Boolean(dialog?.loading)}
        dismissable={dialog?.dismissable !== false}
        onClose={closeDialog}
        actions={dialog?.actions}
      />
    </View>
  );
}

const LessonRow = memo(function LessonRow({ audio, status, progress }) {
  const pct = Number.isFinite(progress?.ratio)
    ? Math.round(Math.min(Math.max(progress.ratio, 0), 1) * 100)
    : null;
  const number = audio.ordering != null
    ? String(audio.ordering).padStart(2, '0')
    : '—';

  let statusText = 'Not downloaded';
  let statusColor = colors.textMuted;
  let icon = 'cloud-outline';
  if (status === 'downloaded') {
    statusText = 'Downloaded';
    statusColor = colors.success;
    icon = 'checkmark-circle';
  } else if (status === 'downloading') {
    statusText = pct != null ? `${pct}%` : 'Downloading';
    statusColor = colors.primary;
    icon = 'download-outline';
  } else if (status === 'waiting') {
    statusText = 'Waiting';
    statusColor = colors.textMuted;
    icon = 'time-outline';
  } else if (status === 'failed') {
    statusText = 'Failed';
    statusColor = FAILED;
    icon = 'alert-circle';
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rowNum}>{number}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{audio.title}</Text>
        {status === 'downloading' && pct != null ? (
          <View style={styles.rowTrack}>
            <View style={[styles.rowFill, { width: `${pct}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.rowStatus}>
        <Ionicons name={icon} size={16} color={statusColor} />
        <Text style={[styles.rowStatusText, { color: statusColor }]} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
  headerRight: { width: 48 },
  summary: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statePill: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  statePillDone: {
    color: colors.success,
    backgroundColor: '#E7F4EC',
  },
  statePillFailed: {
    color: FAILED,
    backgroundColor: '#FDECEC',
  },
  percent: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  overallTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sizeLine: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  completedHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 4,
  },
  currentCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  currentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  currentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 8,
  },
  currentMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  currentTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(27,94,123,0.15)',
    overflow: 'hidden',
  },
  currentFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDanger: {
    backgroundColor: colors.heroDark,
  },
  btnDangerText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  listHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowNum: {
    width: 36,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  rowTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 6,
  },
  rowFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  rowStatus: {
    minWidth: 92,
    maxWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  rowStatusText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
