/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  function LinearGradientMock({ children, ...props }) {
    return React.createElement(View, props, children);
  }

  return LinearGradientMock;
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const SafeAreaInsetsContext = React.createContext({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
  const SafeAreaFrameContext = React.createContext({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(
        SafeAreaInsetsContext.Provider,
        { value: { top: 0, right: 0, bottom: 0, left: 0 } },
        React.createElement(
          SafeAreaFrameContext.Provider,
          { value: { x: 0, y: 0, width: 0, height: 0 } },
          children,
        ),
      ),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
});

jest.mock('@notifee/react-native', () => {
  const notifee = {
    requestPermission: jest.fn(async () => ({
      authorizationStatus: 1,
      android: { alarm: 1 },
    })),
    createChannel: jest.fn(async () => 'task-reminders'),
    cancelTriggerNotification: jest.fn(async () => undefined),
    cancelDisplayedNotification: jest.fn(async () => undefined),
    createTriggerNotification: jest.fn(async () => undefined),
    onForegroundEvent: jest.fn(() => () => undefined),
    openAlarmPermissionSettings: jest.fn(async () => undefined),
    openNotificationSettings: jest.fn(async () => undefined),
  };

  return {
    __esModule: true,
    default: notifee,
    AlarmType: {
      SET_EXACT_AND_ALLOW_WHILE_IDLE: 'SET_EXACT_AND_ALLOW_WHILE_IDLE',
    },
    AndroidNotificationSetting: {
      DISABLED: 0,
      ENABLED: 1,
    },
    AndroidImportance: {
      HIGH: 4,
    },
    AuthorizationStatus: {
      AUTHORIZED: 1,
    },
    EventType: {
      ACTION_PRESS: 'ACTION_PRESS',
    },
    TriggerType: {
      TIMESTAMP: 'TIMESTAMP',
    },
  };
});
