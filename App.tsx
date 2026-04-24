import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AlarmType,
  AndroidNotificationSetting,
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import {
  Button,
  Card,
  PaperProvider,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';

type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  time?: string;
  date?: string;
  priority?: 'Low' | 'Medium' | 'High';
  category?: 'Work' | 'Personal' | 'Health' | 'Study' | 'Other';
};

type Screen = 'Splash' | 'Home' | 'AddTask' | 'EditTask';

type TaskPriority = NonNullable<Task['priority']>;
type TaskCategory = NonNullable<Task['category']>;

const STORAGE_KEY = '@todo_tasks_v1';
const NOTIFICATION_CHANNEL_ID = 'task-reminders';
const DEFAULT_PRIORITY: TaskPriority = 'Medium';
const DEFAULT_CATEGORY: TaskCategory = 'Personal';
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseTaskDateTime = (
  task: Pick<Task, 'time' | 'date'>,
  nowMs: number,
) => {
  if (!task.time) {
    return null;
  }

  const baseDate = task.date
    ? new Date(`${task.date}T00:00:00`)
    : new Date(nowMs);
  const [hours, minutes] = task.time
    .split(':')
    .map(value => parseInt(value, 10));

  baseDate.setSeconds(0, 0);
  baseDate.setHours(hours, minutes, 0, 0);

  return baseDate;
};

const formatTaskDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatTaskTime = (value?: string) => {
  if (!value) {
    return '';
  }

  const [hours, minutes] = value.split(':').map(part => parseInt(part, 10));
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const meridiem = hours >= 12 ? 'PM' : 'AM';

  return `${hour12.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')} ${meridiem}`;
};

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const getCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const days: Array<number | null> = [];

  for (let i = 0; i < firstDay; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
};
type AppPalette = {
  gradient: string[];
  textPrimary: string;
  textSecondary: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  inputBg: string;
  cardGlow: string;
  statusBar: 'light-content' | 'dark-content';
  splashShell: string;
  splashShellBorder: string;
  orbPrimary: string;
  orbSecondary: string;
  orbTertiary: string;
  dot: string;
};

const lightTheme = {
  colors: {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#F1F5F9',
      level3: '#E2E8F0',
      level4: '#CBD5E1',
      level5: '#94A3B8',
    },
  },
};

const darkTheme = {
  dark: true,
  colors: {
    primary: '#A78BFA',
    secondary: '#C4B5FD',
    background: '#0F172A',
    surface: '#111827',
    elevation: {
      level0: 'transparent',
      level1: '#111827',
      level2: '#1F2937',
      level3: '#273449',
      level4: '#334155',
      level5: '#475569',
    },
  },
};

const LIGHT_PALETTE: AppPalette = {
  gradient: ['#EEF4FF', '#F5F3FF', '#FFF7ED'],
  textPrimary: '#1E1B4B',
  textSecondary: '#64748B',
  surface: 'rgba(255, 255, 255, 0.96)',
  surfaceAlt: '#FFFFFF',
  border: 'rgba(219, 228, 255, 0.95)',
  inputBg: '#F8FAFC',
  cardGlow: 'rgba(125, 211, 252, 0.15)',
  statusBar: 'dark-content',
  splashShell: 'rgba(255,255,255,0.55)',
  splashShellBorder: 'rgba(255,255,255,0.75)',
  orbPrimary: 'rgba(99, 102, 241, 0.08)',
  orbSecondary: 'rgba(249, 115, 22, 0.08)',
  orbTertiary: 'rgba(168, 85, 247, 0.07)',
  dot: 'rgba(79, 70, 229, 0.18)',
};

const DARK_PALETTE: AppPalette = {
  gradient: ['#020617', '#111827', '#1E1B4B'],
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  surface: 'rgba(15, 23, 42, 0.92)',
  surfaceAlt: '#111827',
  border: 'rgba(71, 85, 105, 0.85)',
  inputBg: '#0F172A',
  cardGlow: 'rgba(59, 130, 246, 0.12)',
  statusBar: 'light-content',
  splashShell: 'rgba(15, 23, 42, 0.72)',
  splashShellBorder: 'rgba(148, 163, 184, 0.25)',
  orbPrimary: 'rgba(99, 102, 241, 0.16)',
  orbSecondary: 'rgba(249, 115, 22, 0.12)',
  orbTertiary: 'rgba(168, 85, 247, 0.12)',
  dot: 'rgba(196, 181, 253, 0.32)',
};

interface HomeScreenProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNavigate: (screen: Screen, params?: any) => void;
  palette: AppPalette;
}

interface AddTaskScreenProps {
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onEditTask: (id: string, task: Omit<Task, 'id' | 'completed'>) => void;
  onNavigate: (screen: Screen) => void;
  editingTask?: Task;
  palette: AppPalette;
}

function SplashScreen({ palette }: { palette: AppPalette }) {
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim = React.useRef(new Animated.Value(0)).current;
  const orbitAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [floatAnim, opacityAnim, orbitAnim, scaleAnim]);

  const floatTranslate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const orbitRotate = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splashContainer}
    >
      <View style={styles.appBackgroundPattern}>
        <View
          style={[
            styles.bgOrb,
            styles.bgOrbOne,
            { backgroundColor: palette.orbPrimary },
          ]}
        />
        <View
          style={[
            styles.bgOrb,
            styles.bgOrbTwo,
            { backgroundColor: palette.orbSecondary },
          ]}
        />
        <View
          style={[
            styles.bgOrb,
            styles.bgOrbThree,
            { backgroundColor: palette.orbTertiary },
          ]}
        />
        <View
          style={[
            styles.bgGridDot,
            styles.bgGridDotOne,
            { backgroundColor: palette.dot },
          ]}
        />
        <View
          style={[
            styles.bgGridDot,
            styles.bgGridDotTwo,
            { backgroundColor: palette.dot },
          ]}
        />
        <View
          style={[
            styles.bgGridDot,
            styles.bgGridDotThree,
            { backgroundColor: palette.dot },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.splashOrbit,
          {
            transform: [{ rotate: orbitRotate }],
          },
        ]}
      >
        <View style={[styles.splashOrbitDot, styles.splashOrbitDotPrimary]} />
        <View style={[styles.splashOrbitDot, styles.splashOrbitDotSecondary]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.splashContent,
          {
            transform: [{ scale: scaleAnim }, { translateY: floatTranslate }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View
          style={[
            styles.splashIconShell,
            {
              backgroundColor: palette.splashShell,
              borderColor: palette.splashShellBorder,
            },
          ]}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.splashIconGradient}
          >
            <Text style={styles.splashIcon}>✓</Text>
          </LinearGradient>
        </View>
        <Text style={[styles.splashTitle, { color: palette.textPrimary }]}>
          Vamsi's Tasks
        </Text>
        <Text style={[styles.splashSubtitle, { color: palette.textSecondary }]}>
          Stay focused & productive
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

function AppBackgroundDecor({ palette }: { palette: AppPalette }) {
  return (
    <View pointerEvents="none" style={styles.appBackgroundPattern}>
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbOne,
          { backgroundColor: palette.orbPrimary },
        ]}
      />
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbTwo,
          { backgroundColor: palette.orbSecondary },
        ]}
      />
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbThree,
          { backgroundColor: palette.orbTertiary },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotOne,
          { backgroundColor: palette.dot },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotTwo,
          { backgroundColor: palette.dot },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotThree,
          { backgroundColor: palette.dot },
        ]}
      />
    </View>
  );
}

function HomeScreen({
  tasks,
  onToggleTask,
  onDeleteTask,
  onNavigate,
  palette,
}: HomeScreenProps) {
  const slideInAnim = React.useRef(new Animated.Value(100)).current;
  const [now, setNow] = useState(() => Date.now());
  const [activeFilter, setActiveFilter] = useState<
    'All' | 'Today' | 'Live' | 'Missed'
  >('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'Nearest time' | 'Newest' | 'Priority' | 'Missed first'
  >('Nearest time');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>(
    {},
  );
  const [showDateTimeModal, setShowDateTimeModal] = useState(false);
  const [tempModalMonth, setTempModalMonth] = useState(
    new Date(now).getMonth() + 1,
  );
  const [tempModalDay, setTempModalDay] = useState(new Date(now).getDate());
  const [tempModalYear, setTempModalYear] = useState(
    new Date(now).getFullYear(),
  );
  const [tempModalHours, setTempModalHours] = useState(
    new Date(now).getHours(),
  );
  const [tempModalMinutes, setTempModalMinutes] = useState(
    new Date(now).getMinutes(),
  );
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const modalCalendarDays = getCalendarDays(tempModalYear, tempModalMonth);
  const todayKey = formatDateKey(new Date(now));
  const completedCount = tasks.filter(t => t.completed).length;

  React.useEffect(() => {
    Animated.timing(slideInAnim, {
      toValue: 0,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideInAnim]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTaskState = (task: Task) => {
    const scheduledAt = parseTaskDateTime(task, now);
    const taskDateKey = task.date ?? todayKey;

    if (!scheduledAt) {
      return {
        isMissed: false,
        isLive: false,
        showCountdown: false,
        countdownLabel: null as string | null,
        dateTimeLabel: null as string | null,
      };
    }

    const remainingMs = scheduledAt.getTime() - now;
    const isMissed = remainingMs <= 0;
    const isLive = !task.completed && !isMissed;
    const showCountdown =
      !task.completed && !isMissed && remainingMs <= 60 * 60 * 1000;
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const showDate = taskDateKey !== todayKey;
    const dateLabel = showDate ? formatTaskDateLabel(taskDateKey) : '';

    return {
      isMissed,
      isLive,
      showCountdown,
      countdownLabel: showCountdown
        ? `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : null,
      dateTimeLabel: task.time
        ? showDate
          ? `${dateLabel}  ⏰ ${formatTaskTime(task.time)}`
          : `⏰ ${formatTaskTime(task.time)}`
        : null,
    };
  };

  const missedCount = tasks.filter(task => {
    if (task.completed) {
      return false;
    }

    return getTaskState(task).isMissed;
  }).length;
  const todayCount = tasks.filter(
    task => (task.date ?? todayKey) === todayKey,
  ).length;
  const upcomingCount = tasks.filter(
    task => (task.date ?? todayKey) > todayKey,
  ).length;
  const filterOptions: Array<{
    key: 'All' | 'Today' | 'Live' | 'Missed';
    label: string;
  }> = [
    { key: 'All', label: 'All' },
    { key: 'Today', label: 'Today' },
    { key: 'Live', label: 'Live' },
    { key: 'Missed', label: 'Missed' },
  ];
  const sortOptions: Array<
    'Nearest time' | 'Newest' | 'Priority' | 'Missed first'
  > = ['Nearest time', 'Newest', 'Priority', 'Missed first'];

  const searchedTasks = tasks.filter(task => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      (task.category ?? DEFAULT_CATEGORY).toLowerCase().includes(query) ||
      (task.priority ?? DEFAULT_PRIORITY).toLowerCase().includes(query)
    );
  });

  const filteredTasks = searchedTasks.filter(task => {
    const taskState = getTaskState(task);

    switch (activeFilter) {
      case 'Today':
        return (task.date ?? todayKey) === todayKey;
      case 'Live':
        return taskState.isLive;
      case 'Missed':
        return !task.completed && taskState.isMissed;
      default:
        return true;
    }
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const aState = getTaskState(a);
    const bState = getTaskState(b);
    const aTimestamp =
      parseTaskDateTime(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTimestamp =
      parseTaskDateTime(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    switch (sortBy) {
      case 'Newest':
        return Number(b.id) - Number(a.id);
      case 'Priority':
        return (
          PRIORITY_ORDER[a.priority ?? DEFAULT_PRIORITY] -
            PRIORITY_ORDER[b.priority ?? DEFAULT_PRIORITY] ||
          aTimestamp - bTimestamp
        );
      case 'Missed first':
        return (
          Number(bState.isMissed) - Number(aState.isMissed) ||
          aTimestamp - bTimestamp
        );
      case 'Nearest time':
      default:
        return aTimestamp - bTimestamp;
    }
  });

  const openTasks = sortedTasks.filter(task => !task.completed);
  const completedTasks = sortedTasks.filter(task => task.completed);

  const renderItem = ({ item }: { item: Task }) => {
    const isDone = item.completed;
    const taskState = getTaskState(item);
    const isMissed = !isDone && taskState.isMissed;
    const isExpanded = !!expandedTasks[item.id];

    const handleCheckPress = () => {
      onToggleTask(item.id);
    };

    const toggleExpanded = () => {
      setExpandedTasks(prev => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
    };

    return (
      <View style={styles.dropdownCardWrap}>
        <Card
          style={[
            styles.dropdownCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
            isDone && styles.cardCompleted,
            isMissed && styles.cardMissed,
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardGlow} />
            <TouchableRipple onPress={toggleExpanded} borderless>
              <View style={styles.dropdownHeader}>
                <View style={styles.dropdownLeft}>
                  <TouchableRipple
                    onPress={handleCheckPress}
                    borderless
                    style={styles.customCheckbox}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        isDone && styles.checkboxBoxChecked,
                        isMissed && styles.checkboxBoxMissed,
                      ]}
                    >
                      {isDone && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  </TouchableRipple>
                  <View style={styles.dropdownTitleBlock}>
                    <View style={styles.taskTagRow}>
                      <View
                        style={[
                          styles.smallTag,
                          item.priority === 'High'
                            ? styles.priorityHighTag
                            : item.priority === 'Low'
                            ? styles.priorityLowTag
                            : styles.priorityMediumTag,
                        ]}
                      >
                        <Text style={styles.smallTagText}>
                          {item.priority ?? DEFAULT_PRIORITY}
                        </Text>
                      </View>
                      <View style={[styles.smallTag, styles.categoryTag]}>
                        <Text style={styles.smallTagText}>
                          {item.category ?? DEFAULT_CATEGORY}
                        </Text>
                      </View>
                    </View>
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.taskTitle,
                        { color: palette.textPrimary },
                        isDone && styles.completedText,
                      ]}
                    >
                      {item.title}
                    </Text>
                    {!!item.description && !isExpanded && (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.dropdownPreview,
                          { color: palette.textSecondary },
                          isDone && styles.completedDescription,
                        ]}
                      >
                        {item.description}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.dropdownRight}>
                  <View style={styles.dropdownTagRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        isDone
                          ? styles.statusBadgeDone
                          : isMissed
                          ? styles.statusBadgeMissed
                          : styles.statusBadgeLive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isDone
                            ? styles.statusBadgeTextDone
                            : isMissed
                            ? styles.statusBadgeTextMissed
                            : styles.statusBadgeTextLive,
                        ]}
                      >
                        {isDone ? 'Done' : isMissed ? 'Missed' : 'Live'}
                      </Text>
                    </View>
                    {!isDone &&
                      taskState.showCountdown &&
                      taskState.countdownLabel && (
                        <View style={[styles.statusBadge, styles.timerBadge]}>
                          <Text
                            style={[
                              styles.statusBadgeText,
                              styles.timerBadgeText,
                            ]}
                          >
                            {taskState.countdownLabel}
                          </Text>
                        </View>
                      )}
                  </View>
                  {!!taskState.dateTimeLabel && (
                    <Text
                      style={[
                        styles.dropdownDateTime,
                        { color: palette.textSecondary },
                        isDone && styles.completedDescription,
                      ]}
                    >
                      {taskState.dateTimeLabel}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.dropdownChevron,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {isExpanded ? '▴' : '▾'}
                  </Text>
                </View>
              </View>
            </TouchableRipple>

            {isExpanded && (
              <View style={styles.dropdownBody}>
                {!!item.description && (
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.taskDescription,
                      { color: palette.textSecondary },
                      isDone && styles.completedDescription,
                    ]}
                  >
                    {item.description}
                  </Text>
                )}

                <View style={styles.cardActions}>
                  <TouchableRipple
                    onPress={handleCheckPress}
                    style={styles.actionButtonWrap}
                    borderless
                  >
                    <LinearGradient
                      colors={
                        isDone ? ['#6366F1', '#818CF8'] : ['#10B981', '#34D399']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionLabel}>
                        {isDone ? 'Undo' : 'Done'}
                      </Text>
                    </LinearGradient>
                  </TouchableRipple>
                  {!isDone && (
                    <TouchableRipple
                      onPress={() => onNavigate('EditTask', { task: item })}
                      style={styles.actionButtonWrap}
                      borderless
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionLabel}>Edit</Text>
                      </LinearGradient>
                    </TouchableRipple>
                  )}
                  <TouchableRipple
                    onPress={() => onDeleteTask(item.id)}
                    style={styles.actionButtonWrap}
                    borderless
                  >
                    <LinearGradient
                      colors={['#F97316', '#EF4444']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionLabel}>Delete</Text>
                    </LinearGradient>
                  </TouchableRipple>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const tasksWithReminders = tasks.filter(t => t.time && !t.completed);
  const hasReminders = tasksWithReminders.length > 0;

  return (
    <>
      <Modal
        visible={showDateTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalLargeContent,
              { backgroundColor: palette.surface },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
              Date & Time Picker
            </Text>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalCalendarContainer}>
              <View style={styles.modalCalendarHeader}>
                <TouchableRipple
                  onPress={() => {
                    let newMonth = tempModalMonth - 1;
                    let newYear = tempModalYear;
                    if (newMonth < 1) {
                      newMonth = 12;
                      newYear -= 1;
                    }
                    setTempModalMonth(newMonth);
                    setTempModalYear(newYear);
                  }}
                  style={styles.calendarNavButton}
                >
                  <Text style={styles.calendarNavButtonText}>‹</Text>
                </TouchableRipple>
                <Text
                  style={[
                    styles.modalCalendarMonthYear,
                    { color: palette.textPrimary },
                  ]}
                >
                  {monthNames[tempModalMonth - 1]} {tempModalYear}
                </Text>
                <TouchableRipple
                  onPress={() => {
                    let newMonth = tempModalMonth + 1;
                    let newYear = tempModalYear;
                    if (newMonth > 12) {
                      newMonth = 1;
                      newYear += 1;
                    }
                    setTempModalMonth(newMonth);
                    setTempModalYear(newYear);
                  }}
                  style={styles.calendarNavButton}
                >
                  <Text style={styles.calendarNavButtonText}>›</Text>
                </TouchableRipple>
              </View>

              <View style={styles.modalWeekRow}>
                {weekdayLabels.map((day, index) => (
                  <Text
                    key={`modal-weekday-${index}`}
                    style={[
                      styles.modalWeekday,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.modalCalendarGrid}>
                {modalCalendarDays.map((day, index) => {
                  if (!day) {
                    return (
                      <View
                        key={`modal-empty-${index}`}
                        style={styles.modalDaySpacer}
                      />
                    );
                  }
                  const isSelected = day === tempModalDay;
                  return (
                    <TouchableRipple
                      key={`modal-day-${day}`}
                      onPress={() => setTempModalDay(day)}
                      style={[
                        styles.modalDayButton,
                        isSelected && styles.modalDayButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalDayText,
                          isSelected
                            ? styles.modalDayTextSelected
                            : styles.modalDayTextDefault,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableRipple>
                  );
                })}
              </View>

              <View style={styles.modalTimeSection}>
                <Text
                  style={[
                    styles.modalTimeLabel,
                    { color: palette.textPrimary },
                  ]}
                >
                  Time:
                </Text>
                <View style={styles.modalTimeInputRow}>
                  <View style={styles.modalTimeInputContainer}>
                    <TouchableRipple
                      onPress={() =>
                        setTempModalHours((prev: number) => (prev + 1) % 24)
                      }
                      style={styles.timeUpButton}
                    >
                      <Text style={styles.timeUpButtonText}>▴</Text>
                    </TouchableRipple>
                    <Text
                      style={[
                        styles.modalTimeInput,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {tempModalHours.toString().padStart(2, '0')}
                    </Text>
                    <TouchableRipple
                      onPress={() =>
                        setTempModalHours(
                          (prev: number) => (prev - 1 + 24) % 24,
                        )
                      }
                      style={styles.timeDownButton}
                    >
                      <Text style={styles.timeDownButtonText}>▾</Text>
                    </TouchableRipple>
                  </View>
                  <Text
                    style={[
                      styles.modalTimeSeparator,
                      { color: palette.textPrimary },
                    ]}
                  >
                    :
                  </Text>
                  <View style={styles.modalTimeInputContainer}>
                    <TouchableRipple
                      onPress={() =>
                        setTempModalMinutes((prev: number) => (prev + 1) % 60)
                      }
                      style={styles.timeUpButton}
                    >
                      <Text style={styles.timeUpButtonText}>▴</Text>
                    </TouchableRipple>
                    <Text
                      style={[
                        styles.modalTimeInput,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {tempModalMinutes.toString().padStart(2, '0')}
                    </Text>
                    <TouchableRipple
                      onPress={() =>
                        setTempModalMinutes(
                          (prev: number) => (prev - 1 + 60) % 60,
                        )
                      }
                      style={styles.timeDownButton}
                    >
                      <Text style={styles.timeDownButtonText}>▾</Text>
                    </TouchableRipple>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalButtonRow}>
              <TouchableRipple
                onPress={() => setShowDateTimeModal(false)}
                style={[styles.modalButton, styles.modalButtonPrimary]}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableRipple>
            </View>
          </View>
        </View>
      </Modal>
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.flex1}
      >
        <AppBackgroundDecor palette={palette} />
        <SafeAreaView style={styles.screen}>
          <Animated.View
            style={[
              styles.header,
              { transform: [{ translateY: slideInAnim }] },
            ]}
          >
            <TouchableRipple
              onPress={() => setShowDateTimeModal(true)}
              style={styles.headerTopButton}
            >
              <View style={styles.headerTop}>
                <Text style={styles.headerIcon}>📋</Text>
                <View>
                  <Text
                    variant="headlineMedium"
                    style={[styles.headerTitle, { color: palette.textPrimary }]}
                  >
                    Daily Taasks
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.headerSubtitle,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Stay organized & focused
                  </Text>
                </View>
              </View>
            </TouchableRipple>

            <Card
              style={[
                styles.statsCard,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                },
              ]}
              mode="outlined"
            >
              <View style={styles.statsContent}>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{tasks.length}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, styles.statNumberDone]}>
                      {completedCount}
                    </Text>
                    <Text style={styles.statLabel}>Done</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, styles.statNumberMissed]}>
                      {missedCount}
                    </Text>
                    <Text style={styles.statLabel}>Missed</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, styles.statNumberToday]}>
                      {todayCount}
                    </Text>
                    <Text style={styles.statLabel}>Today</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text
                      style={[styles.statNumber, styles.statNumberUpcoming]}
                    >
                      {upcomingCount}
                    </Text>
                    <Text style={styles.statLabel}>Upcoming</Text>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>

          {tasks.length > 0 && (
            <>
              <TextInput
                mode="outlined"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[
                  styles.searchInput,
                  { backgroundColor: palette.surfaceAlt },
                ]}
                textColor={palette.textPrimary}
                outlineColor={palette.border}
                activeOutlineColor="#4F46E5"
                placeholder="Search tasks, category, priority"
                placeholderTextColor="#94A3B8"
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterRow}
              >
                {filterOptions.map(option => {
                  const isActive = activeFilter === option.key;

                  return (
                    <TouchableRipple
                      key={option.key}
                      onPress={() => setActiveFilter(option.key)}
                      style={[
                        styles.filterChip,
                        isActive
                          ? styles.filterChipActive
                          : styles.filterChipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isActive
                            ? styles.filterChipTextActive
                            : styles.filterChipTextInactive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableRipple>
                  );
                })}
              </ScrollView>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sortScroll}
                contentContainerStyle={styles.sortRow}
              >
                {sortOptions.map(option => {
                  const isActive = sortBy === option;

                  return (
                    <TouchableRipple
                      key={option}
                      onPress={() => setSortBy(option)}
                      style={[
                        styles.sortChip,
                        isActive
                          ? styles.sortChipActive
                          : styles.sortChipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortChipText,
                          isActive
                            ? styles.sortChipTextActive
                            : styles.sortChipTextInactive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableRipple>
                  );
                })}
              </ScrollView>
            </>
          )}

          <FlatList
            data={openTasks}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              openTasks.length === 0 &&
                completedTasks.length === 0 &&
                styles.emptyListContent,
            ]}
            scrollEnabled
            ListFooterComponent={
              completedTasks.length > 0 ? (
                <View style={styles.completedSection}>
                  <TouchableRipple
                    onPress={() => setShowCompleted(prev => !prev)}
                    style={[
                      styles.completedHeader,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.completedHeaderContent}>
                      <Text
                        style={[
                          styles.completedHeaderTitle,
                          { color: palette.textPrimary },
                        ]}
                      >
                        Completed ({completedTasks.length})
                      </Text>
                      <Text
                        style={[
                          styles.completedHeaderArrow,
                          { color: palette.textSecondary },
                        ]}
                      >
                        {showCompleted ? '▴' : '▾'}
                      </Text>
                    </View>
                  </TouchableRipple>
                  {showCompleted &&
                    completedTasks.map(task => (
                      <View key={task.id}>{renderItem({ item: task })}</View>
                    ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text
                  variant="headlineSmall"
                  style={[styles.emptyTitle, { color: palette.textPrimary }]}
                >
                  {tasks.length === 0
                    ? 'No tasks yet'
                    : 'No matching open tasks'}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptySubtitle,
                    { color: palette.textSecondary },
                  ]}
                >
                  {tasks.length === 0
                    ? 'Tap the + button to create your first task!'
                    : 'Try a different filter to see more tasks.'}
                </Text>
              </View>
            }
          />

          <TouchableRipple
            onPress={() => onNavigate('AddTask')}
            style={[styles.fab, hasReminders && styles.fabWithReminders]}
          >
            <View style={styles.fabContent}>
              <Text style={styles.fabIcon}>+</Text>
              {hasReminders && <View style={styles.reminderIndicator} />}
            </View>
          </TouchableRipple>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

function AddTaskScreen({
  onAddTask,
  onEditTask,
  onNavigate,
  editingTask,
  palette,
}: AddTaskScreenProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(
    editingTask?.description || '',
  );
  const [time, setTime] = useState(editingTask?.time || '');
  const [selectedDate, setSelectedDate] = useState(
    editingTask?.date || todayKey,
  );
  const selectedDateParts = (editingTask?.date || todayKey)
    .split('-')
    .map(value => parseInt(value, 10));
  const [tempMonth, setTempMonth] = useState(
    selectedDateParts[1] || today.getMonth() + 1,
  );
  const [tempDay, setTempDay] = useState(
    selectedDateParts[2] || today.getDate(),
  );
  const [priority, setPriority] = useState<Task['priority']>(
    editingTask?.priority || DEFAULT_PRIORITY,
  );
  const [category, setCategory] = useState<Task['category']>(
    editingTask?.category || DEFAULT_CATEGORY,
  );
  const [tempHours, setTempHours] = useState(
    editingTask?.time ? parseInt(editingTask.time.split(':')[0], 10) : 0,
  );
  const [tempMinutes, setTempMinutes] = useState(
    editingTask?.time ? parseInt(editingTask.time.split(':')[1], 10) : 0,
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const keyboardShift = React.useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const priorityOptions: NonNullable<Task['priority']>[] = [
    'High',
    'Medium',
    'Low',
  ];
  const categoryOptions: NonNullable<Task['category']>[] = [
    'Work',
    'Personal',
    'Health',
    'Study',
    'Other',
  ];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const formatDateDisplay = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00`);

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const clampDateParts = (year: number, month: number, day: number) => {
    const boundedYear = currentYear;
    const boundedMonth = Math.max(currentMonth, Math.min(12, month));
    const minimumDay = boundedMonth === currentMonth ? today.getDate() : 1;
    const maxDay = getDaysInMonth(boundedYear, boundedMonth);
    const boundedDay = Math.max(minimumDay, Math.min(maxDay, day));

    return {
      year: boundedYear,
      month: boundedMonth,
      day: boundedDay,
    };
  };

  const updateTempDate = (year: number, month: number, day: number) => {
    const next = clampDateParts(year, month, day);
    setTempMonth(next.month);
    setTempDay(next.day);
  };

  const changeCalendarMonth = (delta: number) => {
    const nextMonth = tempMonth + delta;

    if (nextMonth < 1 || nextMonth > 12) {
      return;
    }

    updateTempDate(currentYear, nextMonth, tempDay);
  };

  const getMinimumSelectableTime = (dateKey: string) => {
    if (dateKey !== todayKey) {
      return null;
    }

    const current = new Date();
    current.setSeconds(0, 0);
    current.setMinutes(current.getMinutes() + 1);

    if (formatDateKey(current) !== todayKey) {
      return null;
    }

    return {
      hours: current.getHours(),
      minutes: current.getMinutes(),
    };
  };

  const clampToSelectedDateTime = (
    dateKey: string,
    hours: number,
    minutes: number,
  ) => {
    const minimumTime = getMinimumSelectableTime(dateKey);

    if (!minimumTime) {
      return { hours, minutes };
    }

    if (hours < minimumTime.hours) {
      return minimumTime;
    }

    if (hours === minimumTime.hours && minutes < minimumTime.minutes) {
      return minimumTime;
    }

    return { hours, minutes };
  };

  const get12HourParts = (hours24: number) => ({
    hour12: hours24 % 12 === 0 ? 12 : hours24 % 12,
    meridiem: hours24 >= 12 ? 'PM' : 'AM',
  });

  const convert12HourTo24 = (hour12: number, meridiem: 'AM' | 'PM') => {
    const normalized = hour12 % 12;
    return meridiem === 'PM' ? normalized + 12 : normalized;
  };

  const buildSelectedDateTime = (selectedTime?: string, dateKey?: string) => {
    if (!selectedTime || !dateKey) {
      return null;
    }

    const [hours, minutes] = selectedTime
      .split(':')
      .map(value => parseInt(value, 10));
    const selected = new Date(`${dateKey}T00:00:00`);

    selected.setHours(hours, minutes, 0, 0);

    return selected;
  };

  const isPastTime = (selectedTime?: string, dateKey?: string) => {
    if (!selectedTime || !dateKey) {
      return false;
    }

    const selectedDateTime = buildSelectedDateTime(selectedTime, dateKey);

    if (!selectedDateTime) {
      return false;
    }

    return selectedDateTime.getTime() <= Date.now();
  };

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, _event => {
      setIsKeyboardVisible(true);
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 180,
        useNativeDriver: true,
      }).start();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 180,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardShift]);

  const canSave = title.trim().length > 0;
  const { hour12: tempHour12, meridiem: tempMeridiem } =
    get12HourParts(tempHours);

  const handleTimeOpen = () => {
    const minimumTime = getMinimumSelectableTime(selectedDate);

    if (time) {
      const [h, m] = time.split(':');
      const clampedTime = clampToSelectedDateTime(
        selectedDate,
        parseInt(h, 10),
        parseInt(m, 10),
      );
      setTempHours(clampedTime.hours);
      setTempMinutes(clampedTime.minutes);
    } else if (minimumTime) {
      setTempHours(minimumTime.hours);
      setTempMinutes(minimumTime.minutes);
    } else {
      setTempHours(9);
      setTempMinutes(0);
    }
    setShowTimePicker(true);
  };

  const handleTimeConfirm = () => {
    const clampedTime = clampToSelectedDateTime(
      selectedDate,
      tempHours,
      tempMinutes,
    );

    setTempHours(clampedTime.hours);
    setTempMinutes(clampedTime.minutes);
    setTime(
      `${clampedTime.hours.toString().padStart(2, '0')}:${clampedTime.minutes
        .toString()
        .padStart(2, '0')}`,
    );
    setShowTimePicker(false);
  };

  const handleTimeCancel = () => {
    setShowTimePicker(false);
  };

  const handleDateOpen = () => {
    const [year, month, day] = selectedDate
      .split('-')
      .map(value => parseInt(value, 10));
    updateTempDate(year, month, day);
    setShowDatePicker(true);
  };

  const handleDateConfirm = () => {
    const next = clampDateParts(currentYear, tempMonth, tempDay);
    const nextDateKey = `${next.year}-${next.month
      .toString()
      .padStart(2, '0')}-${next.day.toString().padStart(2, '0')}`;
    setSelectedDate(nextDateKey);

    if (time) {
      const [hours, minutes] = time
        .split(':')
        .map(value => parseInt(value, 10));
      const nextTime = clampToSelectedDateTime(nextDateKey, hours, minutes);
      setTime(
        `${nextTime.hours.toString().padStart(2, '0')}:${nextTime.minutes
          .toString()
          .padStart(2, '0')}`,
      );
    }

    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const calendarDays = getCalendarDays(currentYear, tempMonth);
  const tempDateKey = `${currentYear}-${tempMonth
    .toString()
    .padStart(2, '0')}-${tempDay.toString().padStart(2, '0')}`;

  const updateTempTime = (
    hour12: number,
    minutes: number,
    meridiem: 'AM' | 'PM',
  ) => {
    const nextHour24 = convert12HourTo24(hour12, meridiem);
    const clampedTime = clampToSelectedDateTime(
      selectedDate,
      nextHour24,
      minutes,
    );

    setTempHours(clampedTime.hours);
    setTempMinutes(clampedTime.minutes);
  };

  const adjustHour = (delta: number) => {
    const nextHour12 = ((tempHour12 - 1 + delta + 12) % 12) + 1;
    updateTempTime(nextHour12, tempMinutes, tempMeridiem as 'AM' | 'PM');
  };

  const adjustMinute = (delta: number) => {
    const nextMinute = (tempMinutes + delta + 60) % 60;
    updateTempTime(tempHour12, nextMinute, tempMeridiem as 'AM' | 'PM');
  };

  const setMeridiem = (nextMeridiem: 'AM' | 'PM') => {
    updateTempTime(tempHour12, tempMinutes, nextMeridiem);
  };

  const handleSave = () => {
    if (!canSave) return;

    if (isPastTime(time, selectedDate)) {
      Alert.alert(
        'Choose a future time',
        'Reminder time must be later than the current time.',
      );
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      time: time || undefined,
      date: time ? selectedDate : undefined,
      priority,
      category,
    };

    if (editingTask) {
      onEditTask(editingTask.id, taskData);
    } else {
      onAddTask(taskData);
    }

    setTitle('');
    setDescription('');
    setTime('');
    setSelectedDate(todayKey);
    setTempMonth(today.getMonth() + 1);
    setTempDay(today.getDate());
    setPriority(DEFAULT_PRIORITY);
    setCategory(DEFAULT_CATEGORY);
    onNavigate('Home');
  };

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.flex1}
    >
      <AppBackgroundDecor palette={palette} />
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.formScrollContent,
            isKeyboardVisible && styles.formScrollContentKeyboard,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: Animated.add(slideAnim, keyboardShift) },
                ],
              },
            ]}
          >
            <View style={styles.formHeader}>
              <View style={styles.formTitleRow}>
                <Text style={styles.formIconLarge}>
                  {editingTask ? '✏️' : '✨'}
                </Text>
                <View style={styles.formTitleWrap}>
                  <Text
                    variant="headlineSmall"
                    style={[styles.formTitle, { color: palette.textPrimary }]}
                  >
                    {editingTask ? 'Edit Task' : 'New Task'}
                  </Text>
                </View>
              </View>
            </View>

            <Card
              style={[
                styles.formCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              mode="outlined"
            >
              <Card.Content style={styles.formCardContent}>
                <View
                  style={[
                    styles.formCardGlow,
                    { backgroundColor: palette.cardGlow },
                  ]}
                />
                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Task Title *
                  </Text>
                  <TextInput
                    mode="outlined"
                    value={title}
                    onChangeText={setTitle}
                    style={[styles.input, { backgroundColor: palette.inputBg }]}
                    textColor={palette.textPrimary}
                    outlineColor="#DBE4FF"
                    activeOutlineColor="#4F46E5"
                    placeholder="What needs to be done?"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Description
                  </Text>
                  <TextInput
                    mode="outlined"
                    value={description}
                    onChangeText={setDescription}
                    style={[
                      styles.input,
                      styles.descriptionInput,
                      { backgroundColor: palette.inputBg },
                    ]}
                    textColor={palette.textPrimary}
                    outlineColor="#DBE4FF"
                    activeOutlineColor="#4F46E5"
                    placeholder="Add more details (optional)"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Date
                  </Text>
                  <TouchableRipple
                    onPress={handleDateOpen}
                    style={[
                      styles.calendarField,
                      {
                        backgroundColor: palette.inputBg,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.calendarFieldContent}>
                      <View>
                        <Text
                          style={[
                            styles.calendarFieldTitle,
                            { color: palette.textPrimary },
                          ]}
                        >
                          {formatDateDisplay(selectedDate)}
                        </Text>
                        <Text
                          style={[
                            styles.calendarFieldSubtitle,
                            { color: palette.textSecondary },
                          ]}
                        >
                          Schedule any day this year
                        </Text>
                      </View>
                      <Text style={styles.calendarFieldIcon}>📅</Text>
                    </View>
                  </TouchableRipple>
                </View>

                <View style={styles.formSection}>
                  <TouchableRipple
                    onPress={handleTimeOpen}
                    style={[
                      styles.timeButton,
                      {
                        backgroundColor: palette.inputBg,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.timeButtonContent}>
                      <Text
                        style={[
                          styles.timeButtonText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {time
                          ? `⏰ ${formatTaskTime(time)}`
                          : '⏰ Set time (optional)'}
                      </Text>
                    </View>
                  </TouchableRipple>
                </View>

                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Priority
                  </Text>
                  <View style={styles.optionRow}>
                    {priorityOptions.map(option => {
                      const isSelected = priority === option;

                      return (
                        <TouchableRipple
                          key={option}
                          onPress={() => setPriority(option)}
                          style={[
                            styles.optionChip,
                            isSelected
                              ? option === 'High'
                                ? styles.optionChipHighSelected
                                : option === 'Medium'
                                ? styles.optionChipMediumSelected
                                : styles.optionChipLowSelected
                              : styles.optionChipInactive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              isSelected
                                ? styles.optionChipTextSelected
                                : styles.optionChipTextDefault,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableRipple>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Category
                  </Text>
                  <View style={styles.optionRow}>
                    {categoryOptions.map(option => {
                      const isSelected = category === option;

                      return (
                        <TouchableRipple
                          key={option}
                          onPress={() => setCategory(option)}
                          style={[
                            styles.optionChip,
                            isSelected
                              ? styles.optionChipCategorySelected
                              : styles.optionChipInactive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              isSelected
                                ? styles.optionChipTextSelected
                                : styles.optionChipTextDefault,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableRipple>
                      );
                    })}
                  </View>
                </View>

                <Modal
                  visible={showDatePicker}
                  transparent
                  animationType="fade"
                  onRequestClose={handleDateCancel}
                >
                  <View style={styles.pickerPopupOverlay}>
                    <View style={styles.timePickerBox}>
                      <Text style={styles.timePickerTitle}>Select Date</Text>

                      <View style={styles.calendarPicker}>
                        <View style={styles.calendarHeader}>
                          <TouchableRipple
                            onPress={() => changeCalendarMonth(-1)}
                            disabled={tempMonth === currentMonth}
                            style={[
                              styles.calendarNavButton,
                              tempMonth === currentMonth &&
                                styles.calendarNavButtonDisabled,
                            ]}
                          >
                            <Text style={styles.calendarNavButtonText}>‹</Text>
                          </TouchableRipple>
                          <View>
                            <Text style={styles.calendarHeaderTitle}>
                              {monthNames[tempMonth - 1]} {currentYear}
                            </Text>
                            <Text style={styles.calendarHeaderSubtitle}>
                              {formatDateDisplay(tempDateKey)}
                            </Text>
                          </View>
                          <TouchableRipple
                            onPress={() => changeCalendarMonth(1)}
                            disabled={tempMonth === 12}
                            style={[
                              styles.calendarNavButton,
                              tempMonth === 12 &&
                                styles.calendarNavButtonDisabled,
                            ]}
                          >
                            <Text style={styles.calendarNavButtonText}>›</Text>
                          </TouchableRipple>
                        </View>

                        <View style={styles.calendarWeekRow}>
                          {weekdayNames.map((day, index) => (
                            <Text
                              key={`weekday-${index}`}
                              style={styles.calendarWeekday}
                            >
                              {day}
                            </Text>
                          ))}
                        </View>

                        <View style={styles.calendarGrid}>
                          {calendarDays.map((day, index) => {
                            if (!day) {
                              return (
                                <View
                                  key={`empty-${index}`}
                                  style={styles.calendarDaySpacer}
                                />
                              );
                            }

                            const dateKey = `${currentYear}-${tempMonth
                              .toString()
                              .padStart(2, '0')}-${day
                              .toString()
                              .padStart(2, '0')}`;
                            const isDisabled = dateKey < todayKey;
                            const isSelected = tempDay === day;
                            const isToday = dateKey === todayKey;

                            return (
                              <TouchableRipple
                                key={dateKey}
                                onPress={() =>
                                  !isDisabled &&
                                  updateTempDate(currentYear, tempMonth, day)
                                }
                                disabled={isDisabled}
                                style={[
                                  styles.calendarDayButton,
                                  isSelected &&
                                    styles.calendarDayButtonSelected,
                                  isToday && styles.calendarDayButtonToday,
                                  isDisabled &&
                                    styles.calendarDayButtonDisabled,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.calendarDayText,
                                    isSelected &&
                                      styles.calendarDayTextSelected,
                                    isDisabled &&
                                      styles.calendarDayTextDisabled,
                                  ]}
                                >
                                  {day}
                                </Text>
                              </TouchableRipple>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.timePickerButtonRow}>
                        <Button
                          mode="outlined"
                          onPress={handleDateCancel}
                          style={styles.timePickerButton}
                          labelStyle={styles.timePickerButtonLabel}
                          textColor="#4F46E5"
                        >
                          Cancel
                        </Button>
                        <Button
                          mode="contained"
                          onPress={handleDateConfirm}
                          style={[
                            styles.timePickerButton,
                            styles.timePickerConfirmButton,
                          ]}
                          labelStyle={styles.timePickerButtonLabel}
                          buttonColor="#4F46E5"
                        >
                          Done
                        </Button>
                      </View>
                    </View>
                  </View>
                </Modal>

                {showTimePicker && (
                  <View style={styles.timePickerModal}>
                    <View style={styles.timePickerBox}>
                      <Text style={styles.timePickerTitle}>Select Time</Text>

                      <View style={styles.pickerContainer}>
                        <View style={styles.compactPickerColumn}>
                          <TouchableRipple
                            onPress={() => adjustHour(1)}
                            style={styles.pickerAdjustButton}
                          >
                            <Text style={styles.pickerAdjustText}>+</Text>
                          </TouchableRipple>
                          <View style={styles.compactPickerValue}>
                            <Text style={styles.compactPickerValueText}>
                              {tempHour12.toString().padStart(2, '0')}
                            </Text>
                          </View>
                          <TouchableRipple
                            onPress={() => adjustHour(-1)}
                            style={styles.pickerAdjustButton}
                          >
                            <Text style={styles.pickerAdjustText}>-</Text>
                          </TouchableRipple>
                        </View>

                        <Text style={styles.pickerSeparator}>:</Text>

                        <View style={styles.compactPickerColumn}>
                          <TouchableRipple
                            onPress={() => adjustMinute(1)}
                            style={styles.pickerAdjustButton}
                          >
                            <Text style={styles.pickerAdjustText}>+</Text>
                          </TouchableRipple>
                          <View style={styles.compactPickerValue}>
                            <Text style={styles.compactPickerValueText}>
                              {tempMinutes.toString().padStart(2, '0')}
                            </Text>
                          </View>
                          <TouchableRipple
                            onPress={() => adjustMinute(-1)}
                            style={styles.pickerAdjustButton}
                          >
                            <Text style={styles.pickerAdjustText}>-</Text>
                          </TouchableRipple>
                        </View>

                        <View style={styles.meridiemColumn}>
                          {(['AM', 'PM'] as const).map(period => (
                            <TouchableRipple
                              key={period}
                              onPress={() => setMeridiem(period)}
                              style={[
                                styles.meridiemButton,
                                tempMeridiem === period &&
                                  styles.meridiemButtonActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.meridiemButtonText,
                                  tempMeridiem === period &&
                                    styles.meridiemButtonTextActive,
                                ]}
                              >
                                {period}
                              </Text>
                            </TouchableRipple>
                          ))}
                        </View>
                      </View>

                      <View style={styles.timePickerButtonRow}>
                        <Button
                          mode="outlined"
                          onPress={handleTimeCancel}
                          style={styles.timePickerButton}
                          labelStyle={styles.timePickerButtonLabel}
                          textColor="#4F46E5"
                        >
                          Cancel
                        </Button>
                        <Button
                          mode="contained"
                          onPress={handleTimeConfirm}
                          style={[
                            styles.timePickerButton,
                            styles.timePickerConfirmButton,
                          ]}
                          labelStyle={styles.timePickerButtonLabel}
                          buttonColor="#4F46E5"
                        >
                          Done
                        </Button>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => onNavigate('Home')}
                    style={styles.button}
                    labelStyle={styles.buttonLabel}
                    textColor="#4F46E5"
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSave}
                    disabled={!canSave}
                    style={[styles.button, styles.saveButton]}
                    labelStyle={styles.buttonLabel}
                    buttonColor="#4F46E5"
                  >
                    {editingTask ? 'Save' : 'Create'}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('Splash');
  const [screenParams, setScreenParams] = useState<any>(null);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const palette = isDarkMode ? DARK_PALETTE : LIGHT_PALETTE;
  const paperTheme = isDarkMode ? darkTheme : lightTheme;

  const navigate = (screen: Screen, params?: any) => {
    setCurrentScreen(screen);
    setScreenParams(params);
  };

  const showNotificationAccessAlert = React.useCallback(
    (needsAlarmPermission: boolean) => {
      Alert.alert(
        needsAlarmPermission ? 'Alarm access needed' : 'Notifications are off',
        needsAlarmPermission
          ? 'Enable Alarms & reminders in Android settings so reminders can fire while the app is closed.'
          : 'Enable notifications for this app, otherwise reminders and test alerts cannot appear.',
        [
          { text: 'Cancel', style: 'cancel' },
          needsAlarmPermission
            ? {
                text: 'Open Alarm Settings',
                onPress: () => {
                  notifee.openAlarmPermissionSettings();
                },
              }
            : {
                text: 'Open Notification Settings',
                onPress: () => {
                  notifee.openNotificationSettings();
                },
              },
        ],
      );
    },
    [],
  );

  const ensureNotificationAccess = React.useCallback(async () => {
    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
      showNotificationAccessAlert(false);
      return null;
    }

    if (settings.android.alarm === AndroidNotificationSetting.DISABLED) {
      showNotificationAccessAlert(true);
    }

    await notifee.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Task Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    return settings;
  }, [showNotificationAccessAlert]);

  const getTriggerTimestamp = React.useCallback(
    (task: Pick<Task, 'time' | 'date'>) => {
      if (!task.time) {
        return null;
      }

      const now = Date.now();
      const triggerDate = parseTaskDateTime(task, now);

      if (!triggerDate) {
        return null;
      }

      const isCurrentMinute =
        triggerDate.getHours() === new Date(now).getHours() &&
        triggerDate.getMinutes() === new Date(now).getMinutes() &&
        task.date === formatDateKey(new Date(now));

      if (triggerDate.getTime() <= now && isCurrentMinute) {
        triggerDate.setTime(now + 5000);
      }

      return triggerDate.getTime();
    },
    [],
  );

  const cancelTaskNotification = React.useCallback(async (taskId: string) => {
    try {
      await notifee.cancelTriggerNotification(taskId);
      await notifee.cancelDisplayedNotification(taskId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }, []);

  const scheduleNotification = React.useCallback(
    async (task: Task) => {
      try {
        if (!task.time) return;
        const settings = await ensureNotificationAccess();

        if (!settings) {
          return;
        }

        await cancelTaskNotification(task.id);
        const timestamp = getTriggerTimestamp(task);

        if (!timestamp || timestamp <= Date.now()) {
          return;
        }

        const notification = {
          id: task.id,
          title: 'Task Reminder',
          body: task.title,
          android: {
            channelId: NOTIFICATION_CHANNEL_ID,
            sound: 'default' as const,
            importance: AndroidImportance.HIGH,
            actions: [
              {
                title: 'Mark Done',
                pressAction: {
                  id: 'mark-done',
                },
              },
              {
                title: 'Snooze 10m',
                pressAction: {
                  id: 'snooze-10',
                },
              },
            ],
            pressAction: {
              id: 'default',
            },
          },
          ios: {
            sound: 'default' as const,
          },
        };

        const exactTrigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp,
          alarmManager: {
            type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
          },
        };

        try {
          await notifee.createTriggerNotification(notification, exactTrigger);
        } catch (exactAlarmError) {
          const fallbackTrigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp,
          };

          await notifee.createTriggerNotification(
            notification,
            fallbackTrigger,
          );
          console.warn(
            'Exact alarm unavailable, using standard scheduled notification.',
            exactAlarmError,
          );
        }

        console.log(
          `Alarm scheduled for: ${task.title} at ${task.date ?? 'today'} ${
            task.time
          }`,
        );
      } catch (error) {
        console.error('Failed to schedule notification:', error);
      }
    },
    [cancelTaskNotification, ensureNotificationAccess, getTriggerTimestamp],
  );

  // Initialize notifications on app startup
  React.useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await ensureNotificationAccess();
      } catch {
        // notification permissions not granted
      }
    };
    initializeNotifications();
  }, [ensureNotificationAccess]);

  React.useEffect(() => {
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      if (
        type !== EventType.ACTION_PRESS ||
        !detail.notification?.id ||
        !detail.pressAction?.id
      ) {
        return;
      }

      const taskId = detail.notification.id;

      if (detail.pressAction.id === 'mark-done') {
        setTasks(prev =>
          prev.map(task =>
            task.id === taskId ? { ...task, completed: true } : task,
          ),
        );
        await cancelTaskNotification(taskId);
        return;
      }

      if (detail.pressAction.id === 'snooze-10') {
        const task = tasks.find(item => item.id === taskId);

        if (!task) {
          return;
        }

        const baseDate = parseTaskDateTime(task, Date.now()) ?? new Date();
        const nextDate = new Date(Math.max(baseDate.getTime(), Date.now()));
        nextDate.setMinutes(nextDate.getMinutes() + 10);

        const updatedTask: Task = {
          ...task,
          time: `${nextDate.getHours().toString().padStart(2, '0')}:${nextDate
            .getMinutes()
            .toString()
            .padStart(2, '0')}`,
          date: formatDateKey(nextDate),
        };

        setTasks(prev =>
          prev.map(item => (item.id === taskId ? updatedTask : item)),
        );
        await scheduleNotification(updatedTask);
      }
    });
  }, [cancelTaskNotification, scheduleNotification, tasks]);

  React.useEffect(() => {
    if (!isReady) {
      return;
    }

    tasks.forEach(task => {
      if (task.time && !task.completed) {
        scheduleNotification(task).catch(err => {
          console.error('Failed to schedule notification:', err);
        });
      } else {
        cancelTaskNotification(task.id).catch(err => {
          console.error('Failed to cancel notification:', err);
        });
      }
    });
  }, [cancelTaskNotification, isReady, scheduleNotification, tasks]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScreen('Home');
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 2500);

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  React.useEffect(() => {
    if (currentScreen !== 'Splash') {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentScreen, fadeAnim]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setTasks(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setIsReady(true);
      }
    };

    loadTasks();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const saveTasks = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch {
        // ignore
      }
    };

    saveTasks();
  }, [tasks, isReady]);

  const addTask = (task: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: task.title,
      description: task.description,
      completed: false,
      time: task.time,
      date: task.date,
      priority: task.priority || DEFAULT_PRIORITY,
      category: task.category || DEFAULT_CATEGORY,
    };
    setTasks(prev => [newTask, ...prev]);

    // Schedule notification if time is set
    if (task.time) {
      scheduleNotification(newTask).catch(err => {
        console.error('Failed to schedule notification:', err);
      });
    }
  };

  const updateTask = (
    id: string,
    updatedTask: Omit<Task, 'id' | 'completed'>,
  ) => {
    setTasks(prev =>
      prev.map(task => (task.id === id ? { ...task, ...updatedTask } : task)),
    );
    const task = tasks.find(t => t.id === id);
    if (updatedTask.time && !task?.completed) {
      const updatedTaskWithId = { ...task, ...updatedTask } as Task;
      scheduleNotification(updatedTaskWithId).catch(err => {
        console.error('Failed to schedule notification:', err);
      });
    } else {
      cancelTaskNotification(id).catch(err => {
        console.error('Failed to cancel notification:', err);
      });
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );

    // When uncompleting a task, reset its alarm so it can fire again
    const task = tasks.find(t => t.id === id);
    if (task?.completed) {
      if (task.time) {
        scheduleNotification({ ...task, completed: false }).catch(err => {
          console.error('Failed to schedule notification:', err);
        });
      }
    } else {
      cancelTaskNotification(id).catch(err => {
        console.error('Failed to cancel notification:', err);
      });
    }
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    cancelTaskNotification(id).catch(err => {
      console.error('Failed to cancel notification:', err);
    });
  };

  if (currentScreen === 'Splash') {
    return (
      <>
        <StatusBar
          barStyle={palette.statusBar}
          backgroundColor="transparent"
          translucent
        />
        <SplashScreen palette={palette} />
      </>
    );
  }

  return (
    <PaperProvider theme={paperTheme as any}>
      <StatusBar
        barStyle={palette.statusBar}
        backgroundColor="transparent"
        translucent
      />
      <Animated.View style={[styles.flex1, { opacity: fadeAnim }]}>
        {currentScreen === 'Home' ? (
          <HomeScreen
            tasks={tasks}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onNavigate={navigate}
            palette={palette}
          />
        ) : currentScreen === 'EditTask' ? (
          <AddTaskScreen
            onAddTask={addTask}
            onEditTask={updateTask}
            onNavigate={navigate}
            editingTask={screenParams?.task}
            palette={palette}
          />
        ) : (
          <AddTaskScreen
            onAddTask={addTask}
            onEditTask={updateTask}
            onNavigate={navigate}
            palette={palette}
          />
        )}
      </Animated.View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  appBackgroundPattern: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  bgOrbOne: {
    width: 180,
    height: 180,
    top: -30,
    right: -40,
  },
  bgOrbTwo: {
    width: 140,
    height: 140,
    bottom: 80,
    left: -30,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  bgOrbThree: {
    width: 96,
    height: 96,
    top: '42%',
    right: 32,
    backgroundColor: 'rgba(168, 85, 247, 0.07)',
  },
  bgGridDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  bgGridDotOne: {
    top: 120,
    left: 34,
  },
  bgGridDotTwo: {
    top: 154,
    left: 64,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bgGridDotThree: {
    bottom: 160,
    right: 48,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splashOrbit: {
    position: 'absolute',
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashOrbitDot: {
    position: 'absolute',
    borderRadius: 999,
  },
  splashOrbitDotPrimary: {
    top: 18,
    width: 14,
    height: 14,
    backgroundColor: '#7C3AED',
  },
  splashOrbitDotSecondary: {
    bottom: 28,
    right: 30,
    width: 10,
    height: 10,
    backgroundColor: '#F59E0B',
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  splashIconShell: {
    width: 118,
    height: 118,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
    marginBottom: 24,
  },
  splashIconGradient: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIcon: {
    fontSize: 46,
    color: '#FFFFFF',
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  splashSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  flex1: {
    flex: 1,
  },
  header: {
    marginBottom: 12,
    paddingTop: 8,
  },
  headerTopButton: {
    borderRadius: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerIcon: {
    fontSize: 36,
  },
  headerTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 28,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%',
    marginBottom: 16,
  },
  modalDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalTime: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    fontFamily: 'Courier New',
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4F46E5',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalLargeContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalCalendarContainer: {
    maxHeight: 400,
    marginBottom: 12,
  },
  modalCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  modalCalendarMonthYear: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modalWeekday: {
    fontSize: 12,
    fontWeight: '600',
    width: '14.28%',
    textAlign: 'center',
  },
  modalCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  modalDayButton: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  modalDayButtonSelected: {
    backgroundColor: '#4F46E5',
  },
  modalDayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalDayTextSelected: {
    color: '#FFFFFF',
  },
  modalDayTextDefault: {
    color: '#1E293B',
  },
  modalDaySpacer: {
    width: '14.28%',
    aspectRatio: 1,
  },
  modalTimeSection: {
    marginHorizontal: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalTimeInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalTimeInputContainer: {
    alignItems: 'center',
    gap: 4,
  },
  timeUpButton: {
    padding: 6,
  },
  timeUpButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  modalTimeInput: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Courier New',
    minWidth: 40,
    textAlign: 'center',
  },
  timeDownButton: {
    padding: 6,
  },
  timeDownButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  modalTimeSeparator: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    width: '100%',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsContent: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  statNumberDone: {
    color: '#10B981',
  },
  statNumberMissed: {
    color: '#EF4444',
  },
  statNumberToday: {
    color: '#4F46E5',
  },
  statNumberUpcoming: {
    color: '#0F766E',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 10,
    marginLeft: 4,
  },
  searchInput: {
    marginBottom: 12,
    borderRadius: 16,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 0,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DBE4FF',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextInactive: {
    color: '#64748B',
  },
  sortRow: {
    gap: 8,
    paddingBottom: 0,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  sortScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  sortChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  sortChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sortChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  sortChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DBE4FF',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  sortChipTextInactive: {
    color: '#64748B',
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 20,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 8,
  },
  card: {
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.9)',
    elevation: 5,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  cardCompleted: {
    borderColor: '#86EFAC',
    backgroundColor: 'rgba(240, 253, 244, 0.98)',
  },
  cardMissed: {
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(254, 242, 242, 0.98)',
  },
  cardContent: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dropdownCardWrap: {
    marginBottom: 12,
  },
  dropdownCard: {
    borderRadius: 22,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -32,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkboxWrapper: {
    paddingTop: 2,
    paddingHorizontal: 4,
  },
  customCheckbox: {
    padding: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  dropdownTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  taskTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  smallTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  priorityHighTag: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  priorityMediumTag: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  priorityLowTag: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  categoryTag: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  dropdownRight: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  dropdownTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  dropdownPreview: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  dropdownDateTime: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dropdownChevron: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: '700',
  },
  dropdownBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  completedSection: {
    marginTop: 4,
  },
  completedHeader: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  completedHeaderContent: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  completedHeaderArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxBoxMissed: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskTextWrap: {
    flex: 1,
    paddingTop: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskTitle: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  taskDescription: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  statusBadgeDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.18)',
  },
  statusBadgeMissed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusBadgeTextLive: {
    color: '#4338CA',
  },
  statusBadgeTextDone: {
    color: '#059669',
  },
  statusBadgeTextMissed: {
    color: '#B91C1C',
  },
  timerBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  timerBadgeText: {
    color: '#B45309',
  },
  metaSection: {
    marginTop: 8,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    minWidth: 78,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
  },
  timeChip: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.16)',
  },
  dateChip: {
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  countdownChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  missedChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  metaChipCompleted: {
    backgroundColor: 'rgba(226, 232, 240, 0.55)',
    borderColor: 'rgba(203, 213, 225, 0.9)',
  },
  metaChipMissed: {
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  taskTime: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  taskMetaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskCountdown: {
    color: '#B45309',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  completedDescription: {
    textDecorationLine: 'line-through',
    color: '#CBD5E1',
  },
  completeIcon: {
    fontSize: 18,
    color: '#10B981',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  actionButtonWrap: {
    flex: 1,
    minWidth: 88,
    borderRadius: 999,
    overflow: 'hidden',
  },
  actionButton: {
    borderRadius: 999,
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#4F46E5',
    borderRadius: 60,
    width: 60,
    height: 60,
    elevation: 6,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabWithReminders: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  fabContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  reminderIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  reminderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  reminderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  formContainer: {
    width: '100%',
    justifyContent: 'center',
  },
  formScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  formScrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 20,
  },
  formHeader: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  formTitleWrap: {
    flex: 1,
  },
  formIconLarge: {
    fontSize: 30,
    marginTop: 1,
  },
  formCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(219, 228, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  formCardContent: {
    padding: 10,
  },
  formCardGlow: {
    position: 'absolute',
    top: -28,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(125, 211, 252, 0.15)',
  },
  formTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 26,
  },
  formSection: {
    marginBottom: 8,
  },
  inputLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    fontSize: 14,
    borderRadius: 16,
  },
  descriptionInput: {
    minHeight: 52,
  },
  calendarField: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  calendarFieldContent: {
    minHeight: 52,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarFieldTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  calendarFieldSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarFieldIcon: {
    fontSize: 20,
  },
  timeButton: {
    marginTop: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DBE4FF',
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
  },
  timeButtonContent: {
    minHeight: 44,
    paddingHorizontal: 15,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  timeButtonText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  optionChip: {
    paddingHorizontal: 13,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  optionChipInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#DBE4FF',
  },
  optionChipHighSelected: {
    backgroundColor: '#EF4444',
    borderColor: 'transparent',
  },
  optionChipMediumSelected: {
    backgroundColor: '#F59E0B',
    borderColor: 'transparent',
  },
  optionChipLowSelected: {
    backgroundColor: '#10B981',
    borderColor: 'transparent',
  },
  optionChipCategorySelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  optionChipTextDefault: {
    color: '#1E293B',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DBE4FF',
    minHeight: 42,
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  timePickerModal: {
    marginTop: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderRadius: 24,
    padding: 5,
  },
  pickerPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  timePickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  calendarPicker: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButtonDisabled: {
    opacity: 0.35,
  },
  calendarNavButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },
  calendarHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  calendarHeaderSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarDaySpacer: {
    width: '13.142%',
    aspectRatio: 1,
  },
  calendarDayButton: {
    width: '13.142%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(219, 228, 255, 0.9)',
  },
  calendarDayButtonSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  calendarDayButtonToday: {
    borderColor: '#4F46E5',
  },
  calendarDayButtonDisabled: {
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
  },
  calendarDayTextDisabled: {
    color: '#CBD5E1',
  },
  compactPickerColumn: {
    alignItems: 'center',
    gap: 6,
  },
  compactPickerValue: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPickerValueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4F46E5',
  },
  compactPickerYearValue: {
    minWidth: 82,
  },
  pickerAdjustButton: {
    width: 36,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAdjustPlaceholder: {
    width: 36,
    height: 30,
  },
  pickerAdjustText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },
  pickerSeparator: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4F46E5',
    marginHorizontal: 2,
  },
  meridiemColumn: {
    gap: 6,
    marginLeft: 4,
  },
  meridiemButton: {
    minWidth: 52,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBE4FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  meridiemButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  meridiemButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  meridiemButtonTextActive: {
    color: '#FFFFFF',
  },
  timePickerButtonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  timePickerButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  timePickerConfirmButton: {
    backgroundColor: '#4F46E5',
  },
  timePickerButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
