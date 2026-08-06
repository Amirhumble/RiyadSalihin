import { STORAGE_KEYS } from '../constants/storageKeys';
import StorageService from '../services/StorageService';

// Placeholder — helpers for persisting favorites
export const getFavorites = () => StorageService.get(STORAGE_KEYS.FAVORITES);
export const saveFavorites = (favorites) => StorageService.set(STORAGE_KEYS.FAVORITES, favorites);
export const clearFavorites = () => StorageService.remove(STORAGE_KEYS.FAVORITES);
