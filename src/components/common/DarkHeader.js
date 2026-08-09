/**
 * DarkHeader
 *
 * The dark-blue navigation header used on Chapters, Chapter Hadith list,
 * and Hadith Detail screens.
 *
 * Props:
 *   onBack       {function}  — called when back button is pressed
 *   title        {string}    — centre title text
 *   titleArabic  {string}    — optional Arabic subtitle below title
 *   rightElement {node}      — optional element(s) on the right side
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export default function DarkHeader({
  onBack,
  title,
  titleArabic,
  rightElement,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        {/* Centre title */}
        <View style={styles.titleGroup}>
          {!!title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {!!titleArabic && (
            <Text style={styles.titleArabic} numberOfLines={1}>
              {titleArabic}
            </Text>
          )}
        </View>

        {/* Right slot */}
        <View style={styles.sideBtn}>
          {rightElement ?? null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  sideBtn: {
    width: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: colors.heroText,
    lineHeight: 32,
    marginTop: -2,
  },
  titleGroup: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.heroText,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  titleArabic: {
    fontSize: 13,
    color: colors.heroSubtext,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 2,
  },
});
