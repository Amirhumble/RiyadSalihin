import { useRouter } from 'expo-router';
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
import { getAllChaptersWithCounts } from '@/database/repositories/chapterRepository';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function ChaptersScreen() {
  const router = useRouter();

  const {
    data: chapters,
    loading,
    error,
    refetch,
  } = useDbQuery(() => getAllChaptersWithCounts(), []);

  if (loading) return <ScreenLoader />;
  if (error)   return <ScreenError message={error.message} onRetry={refetch} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Manual header so the screen can sit inside the Stack */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chapters</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ChapterRow
            chapter={item}
            onPress={() =>
              router.push(`/chapter/${item.id}`)
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No chapters yet"
            subtitle="Content will appear here once the database is populated."
          />
        }
        contentContainerStyle={
          chapters?.length === 0 ? styles.emptyContainer : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function ChapterRow({ chapter, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.chapterNumber}>
        <Text style={styles.chapterNumberText}>{chapter.chapter_number}</Text>
      </View>
      <View style={styles.chapterInfo}>
        <Text style={styles.arabicTitle} numberOfLines={2}>
          {chapter.arabic_title}
        </Text>
        <Text style={styles.englishTitle} numberOfLines={2}>
          {chapter.english_title}
        </Text>
        {chapter.hadith_count != null && (
          <Text style={styles.hadithCount}>
            {chapter.hadith_count}{' '}
            {chapter.hadith_count === 1 ? 'hadith' : 'hadiths'}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
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
    marginLeft: spacing.md + 48,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  chapterNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  chapterInfo: {
    flex: 1,
  },
  arabicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  englishTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  hadithCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
});
