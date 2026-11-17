import Constants from 'expo-constants';

/** GitHub Pages address of feed.json (app.json → expo.extra.feedUrl); the fund and US files sit next to it. */
export const FEED_URL = Constants.expoConfig?.extra?.feedUrl as string | undefined;
