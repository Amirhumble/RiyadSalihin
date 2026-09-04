/**
 * Riyadus Salihin color system.
 *
 * Brand green sampled from assets/images/icon.png and
 * android-icon-background.png (median interior rgb(26, 78, 29)).
 * White sampled from the wordmark / foreground glyphs.
 * Deep and wash tones are the same hue, not a new palette.
 */
const colors = {
  primary:      '#1A4E1D',
  primaryDark:  '#123716',
  primaryLight: '#E8F3E9',
  primarySoft:  'rgba(26, 78, 29, 0.15)',

  hero:        '#1A4E1D',
  heroDark:    '#123716',
  heroText:    '#FFFFFF',
  heroSubtext: 'rgba(255, 255, 255, 0.75)',
  heroMuted:   'rgba(255, 255, 255, 0.50)',
  heroAccent:  '#FFFFFF',
  heroBorder:  'rgba(255, 255, 255, 0.22)',
  heroFill:    'rgba(255, 255, 255, 0.12)',
  heroRing:      'rgba(255, 255, 255, 0.08)',
  heroRingMuted: 'rgba(255, 255, 255, 0.06)',

  background:          '#FFFFFF',
  backgroundSecondary: '#F4F7F4',

  text:        '#1A1A1A',
  textMuted:   '#888888',
  textInverse: '#FFFFFF',

  borderLight: '#E6EDE7',
  divider:     '#E3EBE4',

  success:      '#2E7D52',
  successLight: '#E7F4EC',
  error:        '#B42318',
  errorLight:   '#FDECEC',
  errorOnDark:  '#F3B4B0',

  overlay: 'rgba(0, 0, 0, 0.45)',
  shadow:  '#000000',
  paper:   '#EDEDE9',
};

export default colors;
