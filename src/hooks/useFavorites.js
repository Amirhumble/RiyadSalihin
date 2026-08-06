import { useState } from 'react';

// Placeholder hook for managing favorites
export function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  // TODO: persist favorites via StorageService

  const addFavorite = (item) => {
    setFavorites((prev) => [...prev, item]);
  };

  const removeFavorite = (id) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
  };

  const isFavorite = (id) => favorites.some((item) => item.id === id);

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
