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
import typography from '@/constants/typography';
import { searchHadiths } from '@/database/repositories/hadithRepository';

const MIN_QUERY_LENGTH = 2;

export default function SearchScreen() {
  const router   = useRouter();
  const inputRef = useRef(null);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const runSearch = useCallback(async (text) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) { setResults(null); setError(null); return; }
    setLoading(true); setError(null);
    try {
      setResults(await searchHadiths(trimmed));
    } catch (err) {
      console.error('[SearchScreen]', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((text) => { setQuery(text); runSearch(text); }, [runSearch]);

  const handleClear = useCallback(() => {
    setQuery(''); setResults(null); setError(null);
    inputRef.current?.focus();
  }, []);

  const renderBody = () => {
    if (loading) return <ScreenLoader />;
    if (error)   return <ScreenError onRetry={() => runSearch(query)} />;
    if (results === null) return (
      <EmptyState
        title="Search the book"
        subtitle="Type Arabic or English text to find hadiths."
      />
    );
    if (results.length === 0) return (
      <EmptyState
        title="Nothing found"
        subtitle={`No hadiths matched "${query}". Try a different word.`}
      />
    );
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ResultRow item={item} onPress={() => router.push(`/hadith/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.count}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Search header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleChange}
            placeholder="Search hadiths…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search hadiths"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

function ResultRow({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Hadith ${item.hadith_number}`}
    >
      <View style={styles.rowMeta}>
        <Text style={styles.hadithLabel}>Hadith {item.hadith_number}</Text>
        {!!item.chapter_english_title && (
          <Text style={styles.chapterLabel} numberOfLines={1}>
            {item.chapter_english_title}
          </Text>
        )}
      </View>
      <Text style={styles.arabicPreview} numberOfLines={2} accessibilityLanguage="ar">
        {item.arabic_text}
      </Text>
      <Text style={styles.englishPreview} numberOfLines={2}>
        {item.english_text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  backBtn: { paddingRight: spacing.xs },
  backText: { fontSize: 28, color: colors.primary, lineHeight: 32, marginTop: -2 },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.xs },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  clearBtn: { fontSize: 14, color: colors.textMuted, paddingLeft: spacing.xs },

  count: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: { paddingBottom: spacing.xxl },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: spacing.md,
  },

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
  chapterLabel: { fontSize: 11, color: colors.textMuted, flex: 1 },
  arabicPreview: {
    fontSize: 17,
    lineHeight: 30,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  englishPreview: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
  },
});
