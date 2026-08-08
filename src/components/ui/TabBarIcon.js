import { SymbolView } from 'expo-symbols';

// expo-symbols name prop accepts { ios, android, web } objects.
// iOS: SF Symbols names, Android/web: Material Symbols names.
const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  bookmark: { ios: 'bookmark.fill', android: 'bookmarks', web: 'bookmarks' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
};

export default function TabBarIcon({ name, color, size = 24 }) {
  const symbolName = ICONS[name] ?? ICONS.home;

  return (
    <SymbolView
      name={symbolName}
      size={size}
      tintColor={color}
    />
  );
}
