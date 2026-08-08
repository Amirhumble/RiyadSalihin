/**
 * ReadingContext — persisted text-size preferences for the Hadith reader.
 *
 * Exposes three preset sizes for Arabic and English text independently.
 * Preferences are stored in AsyncStorage and survive app restarts.
 *
 * Provider location: inside AppShell (after DB ready, alongside AudioProvider).
 *
 * Usage:
 *   const { arabicSize, englishSize, setArabicSize, setEnglishSize, SIZE } = useReading();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_ARABIC  = '@riyadus:reading_arabic_size';
const STORAGE_KEY_ENGLISH = '@riyadus:reading_english_size';

/** Named size presets. Values are pixel sizes used in StyleSheet. */
export const SIZE = {
  small:  'small',
  medium: 'medium',
  large:  'large',
};

/** Font size in pixels for each preset × text type. */
export const ARABIC_FONT_SIZES = {
  [SIZE.small]:  20,
  [SIZE.medium]: 24,
  [SIZE.large]:  30,
};

export const ARABIC_LINE_HEIGHTS = {
  [SIZE.small]:  36,
  [SIZE.medium]: 44,
  [SIZE.large]:  54,
};

export const ENGLISH_FONT_SIZES = {
  [SIZE.small]:  14,
  [SIZE.medium]: 16,
  [SIZE.large]:  19,
};

export const ENGLISH_LINE_HEIGHTS = {
  [SIZE.small]:  22,
  [SIZE.medium]: 28,
  [SIZE.large]:  32,
};

const DEFAULT_ARABIC  = SIZE.medium;
const DEFAULT_ENGLISH = SIZE.medium;

const ReadingContext = createContext(null);

export function ReadingProvider({ children }) {
  const [arabicSize,  setArabicSizeState]  = useState(DEFAULT_ARABIC);
  const [englishSize, setEnglishSizeState] = useState(DEFAULT_ENGLISH);

  // Load persisted preferences on mount.
  useEffect(() => {
    (async () => {
      try {
        const [storedArabic, storedEnglish] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ARABIC),
          AsyncStorage.getItem(STORAGE_KEY_ENGLISH),
        ]);
        if (storedArabic  && Object.values(SIZE).includes(storedArabic))  setArabicSizeState(storedArabic);
        if (storedEnglish && Object.values(SIZE).includes(storedEnglish)) setEnglishSizeState(storedEnglish);
      } catch (err) {
        console.warn('[ReadingContext] failed to load preferences:', err);
      }
    })();
  }, []);

  const setArabicSize = useCallback(async (size) => {
    setArabicSizeState(size);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ARABIC, size);
    } catch (err) {
      console.warn('[ReadingContext] failed to save arabic size:', err);
    }
  }, []);

  const setEnglishSize = useCallback(async (size) => {
    setEnglishSizeState(size);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ENGLISH, size);
    } catch (err) {
      console.warn('[ReadingContext] failed to save english size:', err);
    }
  }, []);

  const value = {
    arabicSize,
    englishSize,
    setArabicSize,
    setEnglishSize,
    SIZE,
    // Convenience: resolved pixel values
    arabicFontSize:    ARABIC_FONT_SIZES[arabicSize],
    arabicLineHeight:  ARABIC_LINE_HEIGHTS[arabicSize],
    englishFontSize:   ENGLISH_FONT_SIZES[englishSize],
    englishLineHeight: ENGLISH_LINE_HEIGHTS[englishSize],
  };

  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

export function useReading() {
  const ctx = useContext(ReadingContext);
  if (!ctx) throw new Error('useReading must be used within a ReadingProvider');
  return ctx;
}
