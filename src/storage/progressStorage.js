import { STORAGE_KEYS } from '../constants/storageKeys';
import StorageService from '../services/StorageService';

// Placeholder — helpers for persisting listen progress
export const getProgress = () => StorageService.get(STORAGE_KEYS.CONTINUE_LISTENING);
export const saveProgress = (progress) =>
  StorageService.set(STORAGE_KEYS.CONTINUE_LISTENING, progress);
export const clearProgress = () => StorageService.remove(STORAGE_KEYS.CONTINUE_LISTENING);
