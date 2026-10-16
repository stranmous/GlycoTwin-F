import { Platform } from 'react-native';
import { useAuthStore } from './authStore';
import { env } from './env';

const DISH_CULINARY_PHOTOS: Record<string, string> = {
  biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  karahi: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
  chicken: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
  daal: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
  dal: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
  lentil: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
  roti: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80',
  naan: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80',
  chapati: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80',
  pulao: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
  kebab: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
  tikka: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
  haleem: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80',
  nihari: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80',
};

const DEFAULT_MEAL_PHOTO =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

/**
 * Returns a fully-qualified, renderable image URI for a meal.
 * Priority:
 * 1. User's uploaded / captured camera photo (resolved against API base URL if relative).
 * 2. Authentic culinary photograph matched to the dish label/name.
 * 3. Default nutritious meal photo.
 */
export function getMealImageUrl(rawUrl?: string | null, dishName?: string | null): string {
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    let full = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const baseUrl = useAuthStore.getState().apiUrl || env.apiUrl;
      full = `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    }
    if (Platform.OS === 'android') {
      full = full.replace('localhost', '10.0.2.2');
    }
    return full;
  }

  // Fallback to high-definition culinary photo for the dish
  return getDishCulinaryPhoto(dishName);
}

/**
 * Get authentic culinary photography for a given dish name.
 */
export function getDishCulinaryPhoto(dishName?: string | null): string {
  if (!dishName) return DEFAULT_MEAL_PHOTO;
  const lower = dishName.toLowerCase();
  for (const [keyword, url] of Object.entries(DISH_CULINARY_PHOTOS)) {
    if (lower.includes(keyword)) {
      return url;
    }
  }
  return DEFAULT_MEAL_PHOTO;
}
