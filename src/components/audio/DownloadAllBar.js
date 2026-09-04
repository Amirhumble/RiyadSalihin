import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useDownloadAll } from '@/hooks/useDownloadAll';
import { isDownloadAllRunning, scanDownloadAllCache } from '@/services/audioDownloadAll';

export default function DownloadAllBar({ audios }) {
  const router = useRouter();
  const snapshot = useDownloadAll();
  const lessonCount = audios?.length ?? 0;

  useLayoutEffect(() => {
    if (lessonCount && !isDownloadAllRunning()) scanDownloadAllCache(audios);
  }, [audios, lessonCount]);

  if (!lessonCount) return null;

  const running = snapshot.status === 'downloading'
    || snapshot.status === 'scanning'
    || snapshot.status === 'cancelling';
  const allOffline = snapshot.status === 'completed' && snapshot.total > 0;

  let title = 'Download all lessons';
  let meta = snapshot.total > 0 ? `${snapshot.saved} of ${snapshot.total} saved` : null;

  if (snapshot.status === 'scanning') {
    title = 'Checking saved lessons…';
    meta = null;
  } else if (snapshot.status === 'cancelling') {
    title = 'Stopping downloads…';
    meta = `${snapshot.saved} of ${snapshot.total}`;
  } else if (running) {
    title = `Downloading ${snapshot.saved} of ${snapshot.total}`;
    meta = `${snapshot.percent}%`;
  } else if (allOffline) {
    title = 'All lessons available offline';
    meta = `${snapshot.total} saved on this device`;
  } else if (snapshot.status === 'partial') {
    title = 'Some lessons failed';
    meta = `${snapshot.saved} of ${snapshot.total} saved · ${snapshot.failed} failed`;
  } else if (snapshot.status === 'cancelled') {
    title = 'Download stopped';
    meta = `${snapshot.saved} of ${snapshot.total} saved`;
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/downloads')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open download manager"
        accessibilityHint="Shows download progress and saved lessons"
      >
        <View style={styles.textCol}>
          <Text
            style={[styles.title, allOffline && styles.titleDone]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          ) : null}
          {running ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, snapshot.percent))}%` }]} />
            </View>
          ) : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={allOffline ? colors.success : colors.primary}
        />
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 52,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  titleDone: {
    color: colors.success,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
