import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export default function ScreenError({ message, onRetry }) {
  if (message) console.warn('[ScreenError]', message);

  const safeMessage =
    typeof message === 'string' && message.length < 100 && !message.includes('[')
      ? message
      : 'We could not load this content. Please try again.';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>{safeMessage}</Text>
      {!!onRetry && (
        <TouchableOpacity
          style={styles.button}
          onPress={onRetry}
          activeOpacity={0.75}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  icon: {
    fontSize: 36,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 15,
  },
});
