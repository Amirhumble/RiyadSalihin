import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>رياض الصالحين</Text>
        <Text style={styles.subtitle}>Riyad as-Salihin</Text>
        <View style={styles.divider} />
        <Text style={styles.message}>Application foundation is ready.</Text>
        <Text style={styles.hint}>Navigation · Context · Theme</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: 1,
    marginVertical: spacing.lg,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
});
