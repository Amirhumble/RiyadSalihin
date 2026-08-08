/**
 * ReadingSettingsPanel
 *
 * A compact bottom-sheet-style panel (implemented with core RN Modal)
 * that lets the user pick Arabic and English text size presets.
 *
 * Props:
 *   visible  {boolean}     – Whether the panel is shown.
 *   onClose  {function}    – Called when the user dismisses the panel.
 */

import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { SIZE, useReading } from '@/context/ReadingContext';

const PRESETS = [
  { key: SIZE.small,  label: 'Small'  },
  { key: SIZE.medium, label: 'Medium' },
  { key: SIZE.large,  label: 'Large'  },
];

export default function ReadingSettingsPanel({ visible, onClose }) {
  const { arabicSize, englishSize, setArabicSize, setEnglishSize } = useReading();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim backdrop — tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Panel */}
      <View style={styles.panel}>
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={styles.panelTitle}>Reading Settings</Text>

        {/* ── Arabic size ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Arabic Text Size</Text>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.presetBtn,
                arabicSize === p.key && styles.presetBtnActive,
              ]}
              onPress={() => setArabicSize(p.key)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityLabel={`Arabic ${p.label}`}
              accessibilityState={{ selected: arabicSize === p.key }}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  arabicSize === p.key && styles.presetBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Arabic preview */}
        <View style={styles.previewBox}>
          <Text style={[styles.arabicPreview, { fontSize: arabicSize === SIZE.small ? 18 : arabicSize === SIZE.large ? 26 : 22 }]}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </Text>
        </View>

        {/* ── English size ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>English Text Size</Text>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.presetBtn,
                englishSize === p.key && styles.presetBtnActive,
              ]}
              onPress={() => setEnglishSize(p.key)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityLabel={`English ${p.label}`}
              accessibilityState={{ selected: englishSize === p.key }}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  englishSize === p.key && styles.presetBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* English preview */}
        <View style={styles.previewBox}>
          <Text style={[styles.englishPreview, { fontSize: englishSize === SIZE.small ? 13 : englishSize === SIZE.large ? 18 : 15 }]}>
            In the name of Allah, the Most Gracious, the Most Merciful.
          </Text>
        </View>

        {/* Done button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close reading settings"
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },

  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },

  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  // Preset buttons
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  presetBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  presetBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  presetBtnTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Previews
  previewBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  arabicPreview: {
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  englishPreview: {
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 22,
  },

  // Done
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
