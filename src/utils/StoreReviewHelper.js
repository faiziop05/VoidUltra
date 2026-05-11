import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const HAS_RATED_KEY = 'user_has_rated_app';
const LAST_PROMPT_KEY = 'last_review_prompt_time';

/**
 * Triggers review dialog.
 * 
 * @param {boolean} force - True to force execution (Settings override).
 */
export const triggerStoreReview = async (force = false) => {
  try {
    if (!force) {
      // 1. Only execute once if already rated
      const hasRated = await AsyncStorage.getItem(HAS_RATED_KEY);
      if (hasRated === 'true') return;

      // 2. Throttle daily checks safely
      const lastPrompt = await AsyncStorage.getItem(LAST_PROMPT_KEY);
      if (lastPrompt) {
        const diff = Date.now() - parseInt(lastPrompt, 10);
        if (diff < 24 * 60 * 60 * 1000) { // 24 Hours
          return;
        }
      }
    }

    // Attempt native call
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
      if (!force) {
        await AsyncStorage.setItem(LAST_PROMPT_KEY, Date.now().toString());
      }
    } else {
      // Fallback
      Linking.openURL('https://play.google.com/store/apps/details?id=com.faiziop05.VoidUltra');
    }
  } catch (err) {
    console.error('Failed to resolve rating request:', err);
  }
};

/**
 * Manually declare persistence milestones.
 */
export const markAsRated = async () => {
  await AsyncStorage.setItem(HAS_RATED_KEY, 'true');
};
