import Constants from 'expo-constants';

/** App version from app.json (expo-constants works in Expo Go, dev builds and on web). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
