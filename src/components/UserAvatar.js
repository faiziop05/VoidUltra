import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Module-level cache to avoid flickering and repeated AsyncStorage hits
let cachedProfileImage = null;
let profileListeners = [];

export const updateCachedAvatar = (uri) => {
  cachedProfileImage = uri;
  profileListeners.forEach(l => l(uri));
};

export function UserAvatar({ style, fallback = require('../../assets/icon4.png') }) {
  const [imageUri, setImageUri] = useState(cachedProfileImage);

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const stored = await AsyncStorage.getItem('profileImage');
        cachedProfileImage = stored;
        setImageUri(stored);
      } catch (e) {
        console.error('Error loading avatar', e);
      }
    };

    if (imageUri === null) loadAvatar();

    // Listen for updates
    const listener = (newUri) => setImageUri(newUri);
    profileListeners.push(listener);

    return () => {
      profileListeners = profileListeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <Image
      source={imageUri ? { uri: imageUri } : fallback}
      style={style}
    />
  );
}
