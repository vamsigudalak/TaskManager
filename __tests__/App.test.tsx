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

  test('loads home screen and interactive filter controls', async () => {
    const screen = render(<App />);

    await act(async () => {
      jest.advanceTimersByTime(2600);
    });

    expect(screen.getByText('Daily Taasks')).toBeTruthy();

    fireEvent.press(screen.getByText('+'));
    fireEvent.changeText(
      screen.getByPlaceholderText('What needs to be done?'),
      'Filter visibility task',
    );
    fireEvent.press(screen.getByText('Create'));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search tasks, category, priority'),
      ).toBeTruthy();
    });

    const missedLabels = screen.getAllByText('Missed');
    fireEvent.press(missedLabels[missedLabels.length - 1]);
    fireEvent.press(screen.getByText('Priority'));

    expect(screen.getByText('Missed first')).toBeTruthy();
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

    await waitFor(() => {
      expect(screen.getByText('Write regression tests')).toBeTruthy();
    });
  });
});
