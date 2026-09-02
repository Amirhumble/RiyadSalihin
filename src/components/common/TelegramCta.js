import { FontAwesome } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AppModal from '@/components/common/AppModal';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { openTelegramChannel } from '@/services/openTelegramChannel';

export default function TelegramCta({ variant = 'hero' }) {
  const [dialog, setDialog] = useState(null);
  const isHero = variant === 'hero';

  const closeDialog = useCallback(() => setDialog(null), []);

  const handlePress = useCallback(async () => {
    try {
      await openTelegramChannel();
    } catch (err) {
      console.warn('[TelegramCta] open failed:', err);
      setDialog({
        title: 'Could not open Telegram',
        message: 'Install Telegram or a browser, then try again to join the official channel.',
        actions: [{ label: 'OK', onPress: closeDialog }],
      });
    }
  }, [closeDialog]);

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, isHero ? styles.btnHero : styles.btnBanner]}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Join the official Telegram channel"
        accessibilityHint="Opens the teacher's Telegram channel"
      >
        <View style={[styles.iconWrap, isHero ? styles.iconHero : styles.iconBanner]}>
          <FontAwesome
            name="telegram"
            size={18}
            color={isHero ? colors.heroDark : colors.textInverse}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, isHero ? styles.titleHero : styles.titleBanner]}>
            Join the official channel
          </Text>
          <Text style={[styles.sub, isHero ? styles.subHero : styles.subBanner]} numberOfLines={2}>
            Sheikh Muhammad Amin Idris on Telegram
          </Text>
        </View>
        <Text style={[styles.chevron, isHero ? styles.chevronHero : styles.chevronBanner]}>›</Text>
      </TouchableOpacity>

      <AppModal
        visible={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        dismissable
        onClose={closeDialog}
        actions={dialog?.actions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    gap: spacing.sm,
  },
  btnHero: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.55)',
  },
  btnBanner: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconHero: {
    backgroundColor: colors.gold,
  },
  iconBanner: {
    backgroundColor: colors.primary,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  titleHero: {
    color: colors.heroText,
  },
  titleBanner: {
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  subHero: {
    color: colors.heroSubtext,
  },
  subBanner: {
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 26,
    fontWeight: '300',
    marginTop: -2,
    flexShrink: 0,
  },
  chevronHero: {
    color: colors.gold,
  },
  chevronBanner: {
    color: colors.primary,
  },
});
