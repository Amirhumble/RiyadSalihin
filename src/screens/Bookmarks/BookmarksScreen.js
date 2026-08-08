import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    FlatList,
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
  const [error, setError]         = useState(null);

  const loadBookmarks = useCallback(async () => {
    if (!isDbReady) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('[BookmarksScreen] load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isDbReady]);

  // Reload every time the tab comes into focus so bookmark changes made
  // on HadithDetailScreen are reflected immediately.
  useFocusEffect(
    useCallback(() => {
      loadBookmarks();
    }, [loadBookmarks])
  );

  const handleRemove = useCallback(async (hadithId) => {
    try {
      await removeBookmark(hadithId);
      setBookmarks((prev) => prev.filter((b) => b.id !== hadithId));
    } catch (err) {
      console.error('[BookmarksScreen] remove error:', err);
    }
  }, []);

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError message={error.message} onRetry={loadBookmarks} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        {bookmarks?.length > 0 && (
          <Text style={styles.headerCount}>{bookmarks.length}</Text>
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
      />
    </SafeAreaView>
  );
}

function BookmarkRow({ item, onPress, onRemove }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.rowContent}>
        <Text style={styles.hadithNumber}>Hadith {item.hadith_number}</Text>
        <Text style={styles.arabicText} numberOfLines={2}>
          {item.arabic_text}
        </Text>
        <Text style={styles.englishText} numberOfLines={2}>
          {item.english_text}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  headerCount: {
    fontSize: 13,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  // List
  list: {
    paddingVertical: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
  },
  separator: {
    height: 1,
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
  hadithNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  arabicText: {
    fontSize: 15,
    lineHeight: 26,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  englishText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  removeButton: {
    padding: spacing.xs,
  },
  removeIcon: {
    fontSize: 15,
    color: colors.textMuted,
  },
});
