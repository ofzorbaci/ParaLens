// Screen tests (jest-expo). Native modules the components touch are mocked here.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure: jest.fn(), getOfferings: jest.fn(async () => ({ current: null })), addCustomerInfoUpdateListener: jest.fn(), getCustomerInfo: jest.fn() },
  LOG_LEVEL: { WARN: 'WARN' },
}));
