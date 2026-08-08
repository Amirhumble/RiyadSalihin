import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

const typography = {
  fontFamily,
  fontSize: {
    xs: 11,
    sm: 13,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 30,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export default typography;
