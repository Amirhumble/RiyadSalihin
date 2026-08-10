import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export default function ScreenLoader({ message = 'Loading…' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
