import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export default function AppModal({
  visible,
  title,
  message,
  loading = false,
  dismissable = true,
  onClose,
  actions = [],
}) {
  const insets = useSafeAreaInsets();
  const canDismiss = Boolean(dismissable && !loading && onClose);
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={canDismiss ? onClose : () => {}}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={canDismiss ? onClose : undefined}
          accessibilityRole={canDismiss ? 'button' : undefined}
          accessibilityLabel={canDismiss ? 'Close dialog' : undefined}
        />
        <View
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? (
            <ScrollView
              style={styles.messageScroll}
              contentContainerStyle={styles.messageContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.message}>{message}</Text>
            </ScrollView>
          ) : null}
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
          {list.length > 0 ? (
            <View style={styles.actions}>
              {list.map((action) => {
                const variant = action.variant || 'primary';
                return (
                  <TouchableOpacity
                    key={action.label}
                    style={[
                      styles.button,
                      variant === 'secondary' && styles.buttonSecondary,
                      variant === 'destructive' && styles.buttonDestructive,
                    ]}
                    onPress={action.onPress}
                    disabled={loading || action.disabled}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        variant === 'secondary' && styles.buttonTextSecondary,
                        variant === 'destructive' && styles.buttonTextDestructive,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '80%',
    elevation: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  messageScroll: {
    maxHeight: 220,
    marginBottom: spacing.md,
  },
  messageContent: {
    paddingBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  buttonDestructive: {
    backgroundColor: colors.heroDark,
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: colors.primary,
  },
  buttonTextDestructive: {
    color: colors.textInverse,
  },
});
