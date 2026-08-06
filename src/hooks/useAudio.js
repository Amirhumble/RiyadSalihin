import { useState } from 'react';

// Placeholder hook for audio playback state
export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUri, setCurrentUri] = useState(null);

  // TODO: integrate AudioService for real playback logic

  return {
    isPlaying,
    currentUri,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    stop: () => {
      setIsPlaying(false);
      setCurrentUri(null);
    },
    load: (uri) => setCurrentUri(uri),
  };
}
