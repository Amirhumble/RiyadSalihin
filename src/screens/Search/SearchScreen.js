import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/common/EmptyState';
import ScreenError from '@/components/common/ScreenError';
import ScreenLoader from '@/components/common/ScreenLoader';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { searchHadiths } from '@/database/repositories/hadithRepository';

const MIN_QUERY_LENGTH = 2;

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef(null);

  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(null); // null = no search yet
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const runSearch = useCallback(async (text) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await searchHadiths(trimmed);
      setResults(data);
    } catch (err) {
      console.error('[SearchScreen] search error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback((text) => {
    setQuery(text);
    runSearch(text);
  }, [runSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const renderBody = () => {
    if (loading) return <ScreenLoader />;

    if (error) {
      return (
        <ScreenError
          message={error.message}
          onRetry={() => runSearch(query)}
        />
      );
    }

    // No search performed yet
    if (results === null) {
      return (
        <EmptyState
          icon="🔍"
          title="Search hadiths"
          subtitle={`Type ${MIN_QUERY_LENGTH} or more characters to search Arabic text, English translation, or hadith number.`}
        />
      );
    }

    if (results.length === 0) {
      return (
        <EmptyState
          icon="📭"
          title="No results found"
          subtitle={`No hadiths matched "${query}". Try a different word or phrase.`}
        />
      );
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <SearchResultRow
            item={item}
            query={query}
            onPress={() => router.push(`/hadith/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={styles.resultsCount}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header with back + search bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleChangeText}
            placeholder="Search hadiths…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel="Search hadiths input"
            accessibilityHint="Type Arabic or English text to search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

function SearchResultRow({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Chapter + number */}
      <View style={styles.rowMeta}>
        <Text style={styles.hadithLabel}>
          Hadith {item.hadith_number}
        </Text>
        {!!item.chapter_english_title && (
          <Text style={styles.chapterLabel} numberOfLines={1}>
            {item.chapter_english_title}
          </Text>
        )}
      </View>

      {/* Arabic preview */}
      <Text style={styles.arabicPreview} numberOfLines={2}>
        {item.arabic_text}
      </Text>

      {/* English preview */}
      <Text style={styles.englishPreview} numberOfLines={2}>
        {item.english_text}
      </Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  backButton: {
    paddingRight: spacing.xs,
  },
  backText: {
    fontSize: 26,
    color: colors.primary,
    lineHeight: 30,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    fontSize: 14,
    color: colors.textMuted,
    paddingLeft: spacing.xs,
  },

  // Results
  resultsCount: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.md,
  },

  // Row
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  hadithLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chapterLabel: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
  },
  arabicPreview: {
    fontSize: 16,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: spacing.xs,
  },
  englishPreview: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
