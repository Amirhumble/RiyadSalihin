import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { TELEGRAM_CHANNEL_APP, TELEGRAM_CHANNEL_HTTPS } from '@/constants/links';

export async function openTelegramChannel() {
  try {
    const canOpenApp = await Linking.canOpenURL(TELEGRAM_CHANNEL_APP);
    if (canOpenApp) {
      await Linking.openURL(TELEGRAM_CHANNEL_APP);
      return;
    }
  } catch {
    // Telegram app is missing or blocked — use HTTPS.
  }

  try {
    await Linking.openURL(TELEGRAM_CHANNEL_HTTPS);
    return;
  } catch {
    // No external handler — use the in-app browser.
  }

  await WebBrowser.openBrowserAsync(TELEGRAM_CHANNEL_HTTPS);
}
