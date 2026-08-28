import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import {
  cancelDownloadAll,
  classifyAudioCache,
  downloadAllAudios,
  estimateMissingBytes,
  formatBytes,
  isDownloadAllRunning,
} from '@/services/audioDownloadAll';

export default function DownloadAllBar({ audios }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);

  const lessonCount = audios?.length ?? 0;

  const statusLabel = useMemo(() => {
    if (!progress) return null;
    const finished = progress.cached + progress.downloaded;
    const pct = progress.total > 0
      ? Math.round((finished / progress.total) * 100)
      : 0;
    const current = progress.current
      ? progress.current.ordering != null
        ? `Lesson ${String(progress.current.ordering).padStart(2, '0')}`
        : progress.current.title
      : null;
    if (progress.phase === 'scan') return 'Checking which lessons are already saved…';
    if (current) {
      return `${finished} / ${progress.total} · ${pct}% · ${current}`;
    }
    return `${finished} / ${progress.total} · ${pct}%`;
  }, [progress]);

  const fillPct = useMemo(() => {
    if (!progress || progress.total <= 0) return 0;
    return Math.round(((progress.cached + progress.downloaded) / progress.total) * 100);
  }, [progress]);

  const startDownload = useCallback(async (list) => {
    setBusy(true);
    setSummary(null);
    setProgress({
      phase: 'scan',
      total: list.length,
      cached: 0,
      downloaded: 0,
      failed: 0,
      current: null,
    });
    try {
      const result = await downloadAllAudios(list, {
        onProgress: (next) => setProgress({ ...next }),
      });
      setSummary(result);
      setProgress(null);
    } catch (err) {
      if (err?.code === 'ALREADY_RUNNING') {
        Alert.alert('Download in progress', 'Please wait for the current download to finish, or cancel it.');
      } else {
        Alert.alert(
          'Could not download lessons',
          err?.code === 'DOWNLOAD_REQUIRED' || String(err?.message || '').toLowerCase().includes('network')
            ? 'Connect to the internet and try again.'
            : 'Something went wrong while downloading. Please try again.'
        );
      }
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const handlePress = useCallback(async () => {
    if (busy || isDownloadAllRunning()) return;
    if (!lessonCount) return;

    setBusy(true);
    setSummary(null);
    try {
      const { cached, missing, total } = classifyAudioCache(audios);
      if (missing.length === 0) {
        setSummary({
          cached,
          downloaded: [],
          failed: [],
          cancelled: false,
          total,
        });
        return;
      }

      const estimate = await estimateMissingBytes(missing);
      if (estimate.networkFailures === missing.length && estimate.sizedCount === 0) {
        Alert.alert(
          'No internet connection',
          'Connect to the internet to download lessons. Lessons already saved on this device will still play offline.'
        );
        return;
      }

      const sizeLabel = estimate.sizedCount > 0 ? formatBytes(estimate.totalBytes) : null;
      const sizeLine = sizeLabel
        ? estimate.sizedCount === missing.length
          ? `\n\nAbout ${sizeLabel} to download.`
          : `\n\nAt least ${sizeLabel} to download.`
        : '';

      Alert.alert(
        'Download all lessons?',
        `${missing.length} lesson${missing.length === 1 ? '' : 's'} will be saved for offline listening. ${cached.length} already on this device.${sizeLine}`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Download',
            onPress: () => {
              startDownload(audios);
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'No internet connection',
        'Connect to the internet to download lessons. Lessons already saved on this device will still play offline.'
      );
    } finally {
      if (!isDownloadAllRunning()) setBusy(false);
    }
  }, [audios, busy, lessonCount, startDownload]);

  const handleCancel = useCallback(() => {
    cancelDownloadAll();
  }, []);

  if (!lessonCount) return null;

  const allOffline = summary
    && !summary.cancelled
    && summary.failed.length === 0
    && summary.cached.length + summary.downloaded.length === summary.total
    && summary.total > 0;

  return (
    <View style={styles.wrap}>
      {busy && progress ? (
        <View style={styles.card}>
          <Text style={styles.title}>Downloading lessons</Text>
          <Text style={styles.meta}>{statusLabel}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fillPct}%` }]} />
          </View>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel download all"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : summary ? (
        <View style={styles.card}>
          {allOffline ? (
            <Text style={styles.success}>All lessons are available offline.</Text>
          ) : summary.cancelled ? (
            <Text style={styles.title}>Download stopped</Text>
          ) : (
            <Text style={styles.title}>Download finished</Text>
          )}
          <Text style={styles.meta}>
            {summary.downloaded.length} downloaded
            {' · '}
            {summary.cached.length} already saved
            {summary.failed.length ? ` · ${summary.failed.length} failed` : ''}
          </Text>
          {summary.failed.length > 0 ? (
            <Text style={styles.hint}>
              Failed lessons can be downloaded again. Saved lessons stay on this device.
            </Text>
          ) : null}
          {summary.cancelled ? (
            <Text style={styles.hint}>
              Lessons that finished downloading remain available offline.
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="Download remaining lessons"
          >
            <Text style={styles.primaryText}>
              {allOffline ? 'Check again' : 'Download remaining'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handlePress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Download all lessons"
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryText}>Download all lessons</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  success: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignSelf: 'center',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
