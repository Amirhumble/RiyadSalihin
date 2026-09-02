import { useEffect, useState } from 'react';

import {
  getDownloadAllSnapshot,
  subscribeDownloadAll,
} from '@/services/audioDownloadAll';

export function useDownloadAll() {
  const [snapshot, setSnapshot] = useState(getDownloadAllSnapshot);
  useEffect(() => subscribeDownloadAll(setSnapshot), []);
  return snapshot;
}
