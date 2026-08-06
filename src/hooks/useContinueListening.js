import { useState } from 'react';

// Placeholder hook for continue-listening / resume playback state
export function useContinueListening() {
  const [lastPlayed, setLastPlayed] = useState(null);

  // TODO: persist and restore from StorageService

  const saveProgress = (lessonId, positionMs) => {
    setLastPlayed({ lessonId, positionMs });
  };

  const clearProgress = () => {
    setLastPlayed(null);
  };

  return { lastPlayed, saveProgress, clearProgress };
}
