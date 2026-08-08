import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/common/EmptyState';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useAppContext } from '@/context/AppContext';
import {
    getBookmarks,
    removeBookmark,
} from '@/database/repositories/bookmarkRepository';

export default function BookmarksScreen() {
  const router = useRouter();
  const { isDbReady } = useAppContext();

  const [bookmarks, setBookmarks] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  const loadBookmarks = useCallback(
    async ({ silent = false } = {}) => {
      if (!isDbReady) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getBookmarks();
        setBookmarks(data);
      } catch (err) {
        console.error('[BookmarksScreen] load error:', err);
        setError(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isDbReady]
  );

  // Reload every time this tab comes into focus — picks up bookmark changes
  // made on HadithDetailScreen or ChapterHadithsScreen.
  useFocusEffect(
    useCallback(() => {
      loadBookmarks();
    }, [loadBookmarks])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookmarks({ silent: true });
  }, [loadBookmarks]);

  const handleRemove = useCallback(async (hadithId) => {
    try {
      await removeBookmark(hadithId);
      // Optimistic update — remove from local state immediately.
      setBookmarks((prev) =>
        prev ? prev.filter((b) => b.id !== hadithId) : prev
      );
    } catch (err) {
      console.error('[BookmarksScreen] remove error:', err);
    }
  }, []);

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError message={error.message} onRetry={loadBookmarks} />;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        {bookmarks?.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{bookmarks.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={bookmarks}
        keyExtractor={(item) => String(item.bookmark_id ?? item.id)}
        renderItem={({ item }) => (
          <BookmarkRow
            item={item}
            onPress={() => router.push(`/hadith/${item.id}`)}
            onRemove={() => handleRemove(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🔖"
            title="No bookmarks yet"
            subtitle="Tap the bookmark icon on any hadith to save it here."
          />
        }
        contentContainerStyle={
          bookmarks?.length === 0 ? styles.emptyContainer : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── BookmarkRow ─────────────────────────────────────────────────────────────

function BookmarkRow({ item, onPress, onRemove }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Hadith ${item.hadith_number}`}
      accessibilityHint="Opens full hadith"
    >
      <View style={styles.rowContent}>
        {/* Label row */}
        <Text style={styles.hadithLabel}>Hadith {item.hadith_number}</Text>

        {/* Arabic preview */}
        <Text
          style={styles.arabicText}
          numberOfLines={2}
          accessibilityLanguage="ar"
        >
          {item.arabic_text}
        </Text>

        {/* English preview */}
        <Text style={styles.englishText} numberOfLines={2}>
          {item.english_text}
        </Text>
      </View>

      {/* Remove button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
        accessibilityLabel="Remove bookmark"
        accessibilityRole="button"
      >
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // List
  list: {
    paddingVertical: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: spacing.lg,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  rowContent: {
    flex: 1,
    marginRight: spacing.md,
  },

  hadithLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  arabicText: {
    fontSize: 16,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: 4,
  },
  englishText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
  },

  removeButton: {
    padding: spacing.xs,
    alignSelf: 'flex-start',
  },
  removeIcon: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
