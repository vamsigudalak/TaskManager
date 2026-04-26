/**
 * @format
 */

import React from 'react';
import { act } from 'react-test-renderer';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';

describe('Todo App core flows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('loads home screen and routes from calendar date tap', async () => {
    const screen = render(<App />);

    await act(async () => {
      jest.advanceTimersByTime(2600);
    });

    expect(screen.getByText('Task Manager')).toBeTruthy();

    expect(screen.getByTestId('home-calendar-card')).toBeTruthy();
    expect(screen.getByTestId('home-calendar-month-label')).toBeTruthy();

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}`;
    const dateLabel = now.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    fireEvent.press(screen.getByTestId(`home-calendar-day-${dateKey}`));

    await waitFor(() => {
      expect(screen.getByText(dateLabel)).toBeTruthy();
    });
  });

  test('adds a new task through inputs and create button', async () => {
    const screen = render(<App />);

    await act(async () => {
      jest.advanceTimersByTime(2600);
    });

    fireEvent.press(screen.getByText('+'));
    expect(screen.getByText('New Task')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText('What needs to be done?'),
      'Write regression tests',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Add more details (optional)'),
      'Validate input and submit flows',
    );

    fireEvent.press(screen.getByText('Create'));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();
    if (
      tomorrow.getMonth() !== now.getMonth() ||
      tomorrow.getFullYear() !== now.getFullYear()
    ) {
      fireEvent.press(screen.getByTestId('home-calendar-next-month'));
    }

    const tomorrowKey = `${tomorrow.getFullYear()}-${String(
      tomorrow.getMonth() + 1,
    ).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    await waitFor(() => {
      expect(
        screen.getByTestId(`home-calendar-day-${tomorrowKey}`),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(`home-calendar-day-${tomorrowKey}`));

    await waitFor(() => {
      expect(screen.getByText('Write regression tests')).toBeTruthy();
    });
  });
});
