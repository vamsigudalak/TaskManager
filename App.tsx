import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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

type Screen =
  | 'Splash'
  | 'Home'
  | 'AddTask'
  | 'EditTask'
  | 'DateTasks'
  | 'StatTasks';

type TaskPriority = NonNullable<Task['priority']>;
type TaskCategory = NonNullable<Task['category']>;

const STORAGE_KEY = '@todo_tasks_v1';
const NOTIFICATION_CHANNEL_ID = 'task-reminders';
const DEFAULT_PRIORITY: TaskPriority = 'Medium';
const DEFAULT_CATEGORY: TaskCategory = 'Personal';
const TIME_WHEEL_ITEM_HEIGHT = 42;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getTomorrowDateKey = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return formatDateKey(tomorrow);
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
  buttonGradient: string[];
  buttonColor: string;
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
  buttonGradient: ['#6366F1', '#8B5CF6'],
  buttonColor: '#6366F1',
  textPrimary: '#1E1B4B',
  textSecondary: '#64748B',
  surface: 'rgba(255, 255, 255, 0.96)',
  surfaceAlt: '#FFFFFF',
  border: 'rgba(196, 181, 253, 0.72)',
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
  buttonGradient: ['#22D3EE', '#8B5CF6'],
  buttonColor: '#22D3EE',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  surface: 'rgba(15, 23, 42, 0.92)',
  surfaceAlt: '#111827',
  border: 'rgba(34, 211, 238, 0.44)',
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

type HomeSectionKey = 'live' | 'missed' | 'completed';

interface AddTaskScreenProps {
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onEditTask: (id: string, task: Omit<Task, 'id' | 'completed'>) => void;
  onNavigate: (screen: Screen) => void;
  tasks: Task[];
  editingTask?: Task;
  palette: AppPalette;
}

interface DateTasksScreenProps {
  tasks: Task[];
  selectedDateKey: string;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNavigate: (screen: Screen, params?: any) => void;
  palette: AppPalette;
}

interface StatTasksScreenProps {
  tasks: Task[];
  filterType: 'total' | 'done' | 'missed' | 'today';
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNavigate: (screen: Screen, params?: any) => void;
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
  const safeAreaInsets = useSafeAreaInsets();
  const slideInAnim = React.useRef(new Animated.Value(100)).current;
  const statsEntranceAnim = React.useRef(new Animated.Value(0)).current;
  const frameEntranceAnim = React.useRef(new Animated.Value(0)).current;
  const capsulesPulseAnim = React.useRef(new Animated.Value(0)).current;
  const fabPulseAnim = React.useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(() => Date.now());
  const [activeSection, setActiveSection] = useState<HomeSectionKey | null>(
    null,
  );
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
  const homeCurrentMonth = new Date(now).getMonth() + 1;
  const scheduledDateSet = React.useMemo(
    () =>
      new Set(
        tasks
          .map(task => task.date)
          .filter((value): value is string => Boolean(value)),
      ),
    [tasks],
  );
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
    Animated.stagger(100, [
      Animated.timing(statsEntranceAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(frameEntranceAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const capsulesLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(capsulesPulseAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(capsulesPulseAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const fabLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fabPulseAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    capsulesLoop.start();
    fabLoop.start();

    return () => {
      capsulesLoop.stop();
      fabLoop.stop();
    };
  }, [capsulesPulseAnim, fabPulseAnim, frameEntranceAnim, statsEntranceAnim]);

  const statsScale = statsEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });
  const statsOpacity = statsEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const frameTranslateY = frameEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const frameOpacity = frameEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const capsulesScale = capsulesPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });
  const fabScale = fabPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    // Ensure section capsules start collapsed each time Home mounts.
    setActiveSection(null);
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
  const sortedTasks = [...tasks].sort((a, b) => {
    const aTimestamp =
      parseTaskDateTime(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTimestamp =
      parseTaskDateTime(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return aTimestamp - bTimestamp;
  });

  const liveTasks = sortedTasks.filter(task => {
    const taskState = getTaskState(task);
    return !task.completed && taskState.isLive;
  });
  const missedTasks = sortedTasks.filter(task => {
    const taskState = getTaskState(task);
    return !task.completed && taskState.isMissed;
  });
  const completedTasks = sortedTasks.filter(task => task.completed);

  const renderItem = ({ item }: { item: Task }) => {
    const isDone = item.completed;
    const taskState = getTaskState(item);
    const isMissed = !isDone && taskState.isMissed;
    const isExpanded = !!expandedTasks[item.id];
    const taskDateKey = item.date ?? todayKey;
    const taskDateLabel = formatTaskDateLabel(taskDateKey);
    const taskTimeLabel = item.time ? formatTaskTime(item.time) : 'Not set';
    const taskHint = isDone
      ? 'Great work. Keep the momentum with your next task.'
      : isMissed
      ? 'Missed task detected. Consider rescheduling this for tomorrow.'
      : 'Task is live now. A focused 10-minute sprint can help you finish.';

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
          <View style={styles.dropdownCardInner}>
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
                      <View style={styles.checkboxShell}>
                        <View
                          style={[
                            styles.checkboxInner,
                            isDone && styles.checkboxInnerChecked,
                            isMissed && styles.checkboxInnerMissed,
                          ]}
                        >
                          {isDone && (
                            <Text style={styles.checkboxCheck}>✓</Text>
                          )}
                        </View>
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
                      <View style={styles.taskScheduleBlock}>
                        <View style={styles.taskScheduleRow}>
                          <Text style={styles.taskScheduleIcon}>📅</Text>
                          <Text
                            style={[
                              styles.taskScheduleText,
                              { color: palette.textSecondary },
                              isDone && styles.completedDescription,
                            ]}
                          >
                            {taskDateLabel}
                          </Text>
                        </View>
                        <View style={styles.taskScheduleRow}>
                          <Text style={styles.taskScheduleIcon}>⏰</Text>
                          <Text
                            style={[
                              styles.taskScheduleText,
                              { color: palette.textSecondary },
                              isDone && styles.completedDescription,
                            ]}
                          >
                            {taskTimeLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.dropdownRight}>
                    <View style={styles.dropdownTagRow}>
                      {!isDone && (
                        <View
                          style={[
                            styles.statusDot3D,
                            isMissed
                              ? styles.statusDot3DMissed
                              : styles.statusDot3DLive,
                          ]}
                        >
                          <View style={styles.statusDot3DHighlight} />
                        </View>
                      )}
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

                  <View style={styles.taskHintBox}>
                    <Text style={styles.taskHintTitle}>Task Hint</Text>
                    <Text style={styles.taskHintText}>{taskHint}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableRipple
                      onPress={handleCheckPress}
                      style={styles.actionButtonWrap}
                      borderless
                    >
                      <LinearGradient
                        colors={
                          isDone
                            ? ['#6366F1', '#818CF8']
                            : ['#10B981', '#34D399']
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
                          colors={palette.buttonGradient}
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
                        colors={palette.buttonGradient}
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
          </View>
        </Card>
      </View>
    );
  };

  const renderTaskSection = (
    sectionKey: HomeSectionKey,
    title: string,
    tasksForSection: Task[],
    visible: boolean,
  ) => {
    if (tasksForSection.length === 0) {
      return null;
    }

    const sectionVariant =
      title === 'Live' ? 'live' : title === 'Missed' ? 'missed' : 'completed';
    const sectionIcon =
      sectionVariant === 'live'
        ? '🟢'
        : sectionVariant === 'missed'
        ? '🚨'
        : '✅';

    return (
      <Animated.View
        style={[
          styles.completedSection,
          visible && styles.completedSectionActive,
          { transform: [{ scale: capsulesScale }] },
        ]}
      >
        <View
          style={[
            styles.completedListBox,
            visible
              ? styles.completedListBoxActive
              : styles.completedListBoxCollapsed,
            sectionVariant === 'live' && styles.liveSectionBox,
            sectionVariant === 'missed' && styles.missedSectionBox,
            sectionVariant === 'completed' && styles.completedSectionBox,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
          ]}
        >
          <TouchableRipple
            onPress={() =>
              setActiveSection(prev =>
                prev === sectionKey ? null : sectionKey,
              )
            }
            style={[
              styles.completedHeader,
              visible && styles.completedHeaderActive,
            ]}
          >
            <View
              style={[
                styles.completedHeaderContent,
                visible && styles.completedHeaderContentActive,
                sectionVariant === 'live' && styles.liveHeaderContent,
                sectionVariant === 'missed' && styles.missedHeaderContent,
                sectionVariant === 'completed' &&
                  styles.completedHeaderContentDefault,
                {
                  borderBottomColor: palette.border,
                  backgroundColor: palette.surfaceAlt,
                },
              ]}
            >
              <Text
                style={[
                  styles.completedHeaderTitle,
                  sectionVariant === 'live' && styles.liveHeaderTitle,
                  sectionVariant === 'missed' && styles.missedHeaderTitle,
                  sectionVariant === 'completed' &&
                    styles.completedHeaderTitleDefault,
                ]}
              >
                {sectionIcon} {title} ({tasksForSection.length})
              </Text>
              <Text
                style={[
                  styles.completedHeaderArrow,
                  sectionVariant === 'live' && styles.liveHeaderArrow,
                  sectionVariant === 'missed' && styles.missedHeaderArrow,
                  sectionVariant === 'completed' &&
                    styles.completedHeaderArrowDefault,
                ]}
              >
                {visible ? '▴' : '▾'}
              </Text>
            </View>
          </TouchableRipple>
          {visible && (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(15, 23, 42, 0.34)',
                  'rgba(15, 23, 42, 0.16)',
                  'rgba(15, 23, 42, 0.06)',
                  'rgba(15, 23, 42, 0)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.completedHeaderActiveDividerGlow}
              />
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={[
                  styles.completedListScroll,
                  visible
                    ? styles.completedListScrollActive
                    : styles.completedListScrollCollapsed,
                ]}
                contentContainerStyle={[
                  styles.completedListContent,
                  styles.completedListContentActive,
                ]}
              >
                {tasksForSection.map(task => (
                  <View key={task.id}>{renderItem({ item: task })}</View>
                ))}

                <View style={styles.sectionPlannerFooter}>
                  <Text style={styles.sectionPlannerFooterTitle}>
                    📌 Task Focus
                  </Text>
                  <Text style={styles.sectionPlannerFooterSubtitle}>
                    {title} queue has {tasksForSection.length} task
                    {tasksForSection.length === 1 ? '' : 's'}.
                  </Text>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  const tasksWithReminders = tasks.filter(t => t.time && !t.completed);
  const hasReminders = tasksWithReminders.length > 0;
  const capsulesBottomPadding =
    activeSection === null ? Math.max(safeAreaInsets.bottom + 8, 16) : 0;

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
              Calendar
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
                  testID="home-calendar-prev-month"
                >
                  <Text style={styles.calendarNavButtonText}>‹</Text>
                </TouchableRipple>
                <Text
                  style={[
                    styles.modalCalendarMonthYear,
                    { color: palette.textPrimary },
                  ]}
                  testID="home-calendar-month-label"
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
                  testID="home-calendar-next-month"
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
                  const dateKey = `${tempModalYear}-${tempModalMonth
                    .toString()
                    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                  const isSunday =
                    new Date(`${dateKey}T00:00:00`).getDay() === 0;
                  const hasScheduledTask = scheduledDateSet.has(dateKey);
                  return (
                    <TouchableRipple
                      key={`modal-day-${day}`}
                      onPress={() => {
                        setTempModalDay(day);
                        setShowDateTimeModal(false);
                        onNavigate('DateTasks', { dateKey });
                      }}
                      style={[
                        styles.modalDayButton,
                        isSelected && styles.modalDayButtonSelected,
                      ]}
                      testID={`home-calendar-day-${dateKey}`}
                    >
                      <View style={styles.modalDayContent}>
                        <Text
                          style={[
                            styles.modalDayText,
                            isSelected
                              ? styles.modalDayTextSelected
                              : styles.modalDayTextDefault,
                            isSunday &&
                              !isSelected &&
                              styles.modalDayTextSunday,
                          ]}
                        >
                          {day}
                        </Text>
                        {hasScheduledTask && (
                          <View
                            style={[
                              styles.modalDayDot,
                              isSelected && styles.modalDayDotSelected,
                            ]}
                          />
                        )}
                      </View>
                    </TouchableRipple>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.modalButtonRow}>
              <TouchableRipple
                onPress={() => setShowDateTimeModal(false)}
                style={styles.modalButtonWrap}
              >
                <LinearGradient
                  colors={palette.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </LinearGradient>
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
            <View style={styles.headerTopRow}>
              <TouchableRipple
                onPress={() => setShowDateTimeModal(true)}
                style={[styles.headerTopButton, styles.headerTopMainButton]}
              >
                <View style={styles.headerTop}>
                  <Text style={styles.headerIcon}>📅</Text>
                  <View>
                    <Text
                      variant="headlineMedium"
                      style={[
                        styles.headerTitle,
                        { color: palette.textPrimary },
                      ]}
                    >
                      Task Manager
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

              <Animated.View
                style={[
                  styles.headerTopAddWrap,
                  { transform: [{ scale: fabScale }] },
                ]}
              >
                <TouchableRipple
                  onPress={() => onNavigate('AddTask')}
                  testID="home-add-task-button"
                  style={[
                    styles.headerTopAddButton,
                    hasReminders && styles.headerTopAddButtonWithReminders,
                  ]}
                >
                  <View style={styles.headerTopAddContent}>
                    <Text style={styles.headerTopAddIcon}>📝</Text>
                    {hasReminders && <View style={styles.headerTopAddDot} />}
                  </View>
                </TouchableRipple>
              </Animated.View>
            </View>

            <Animated.View
              style={{
                opacity: statsOpacity,
                transform: [{ scale: statsScale }],
              }}
            >
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
                    <TouchableRipple
                      onPress={() =>
                        onNavigate('StatTasks', { filterType: 'total' })
                      }
                      style={styles.statItem}
                      borderless
                    >
                      <View style={styles.statItemContent}>
                        <Text style={styles.statIcon}>📊</Text>
                        <Text style={styles.statNumber}>{tasks.length}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                      </View>
                    </TouchableRipple>
                    <View style={styles.statSeparator} />
                    <TouchableRipple
                      onPress={() =>
                        onNavigate('StatTasks', { filterType: 'done' })
                      }
                      style={styles.statItem}
                      borderless
                    >
                      <View style={styles.statItemContent}>
                        <Text style={styles.statIcon}>✅</Text>
                        <Text
                          style={[styles.statNumber, styles.statNumberDone]}
                        >
                          {completedCount}
                        </Text>
                        <Text style={styles.statLabel}>Done</Text>
                      </View>
                    </TouchableRipple>
                    <View style={styles.statSeparator} />
                    <TouchableRipple
                      onPress={() =>
                        onNavigate('StatTasks', { filterType: 'missed' })
                      }
                      style={styles.statItem}
                      borderless
                    >
                      <View style={styles.statItemContent}>
                        <Text style={styles.statIcon}>🚨</Text>
                        <Text
                          style={[styles.statNumber, styles.statNumberMissed]}
                        >
                          {missedCount}
                        </Text>
                        <Text style={styles.statLabel}>Missed</Text>
                      </View>
                    </TouchableRipple>
                    <View style={styles.statSeparator} />
                    <TouchableRipple
                      onPress={() =>
                        onNavigate('StatTasks', { filterType: 'today' })
                      }
                      style={styles.statItem}
                      borderless
                    >
                      <View style={styles.statItemContent}>
                        <Text style={styles.statIcon}>⏱️</Text>
                        <Text
                          style={[styles.statNumber, styles.statNumberToday]}
                        >
                          {todayCount}
                        </Text>
                        <Text style={styles.statLabel}>Today</Text>
                      </View>
                    </TouchableRipple>
                    <View style={styles.statSeparator} />
                    <TouchableRipple
                      onPress={() => setShowDateTimeModal(true)}
                      style={[styles.statItem, styles.statItemCalendarAction]}
                      borderless
                      testID="home-calendar-open-modal"
                    >
                      <View style={styles.statItemContent}>
                        <Text style={styles.statIcon}>📅</Text>
                        <Text
                          style={[styles.statNumber, styles.statNumberCalendar]}
                        >
                          🗓️
                        </Text>
                        <Text style={styles.statLabel}>Calendar</Text>
                      </View>
                    </TouchableRipple>
                  </View>
                </View>
              </Card>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.homeUnifiedFrame,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
              },
              {
                opacity: frameOpacity,
                transform: [{ translateY: frameTranslateY }],
              },
            ]}
          >
            <View style={styles.homeUnifiedFrameContent}>
              <View
                style={[
                  styles.homeCapsulesContainer,
                  {
                    paddingBottom: capsulesBottomPadding,
                  },
                ]}
              >
                {activeSection === null ? (
                  <>
                    {renderTaskSection('live', 'Live', liveTasks, false)}
                    {renderTaskSection('missed', 'Missed', missedTasks, false)}
                    {renderTaskSection(
                      'completed',
                      'Completed',
                      completedTasks,
                      false,
                    )}

                    <LinearGradient
                      colors={[
                        'rgba(56, 189, 248, 0.16)',
                        'rgba(255, 255, 255, 0.86)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.plannerCanvasCard}
                    >
                      <View style={styles.plannerCanvasGlowPrimary} />
                      <View style={styles.plannerCanvasGlowSecondary} />

                      <View style={styles.modalCalendarHeader}>
                        <TouchableRipple
                          onPress={() =>
                            setTempModalMonth(prev =>
                              prev > homeCurrentMonth ? prev - 1 : prev,
                            )
                          }
                          disabled={tempModalMonth === homeCurrentMonth}
                          style={[
                            styles.calendarNavButton,
                            tempModalMonth === homeCurrentMonth &&
                              styles.calendarNavButtonDisabled,
                          ]}
                        >
                          <Text style={styles.calendarNavButtonText}>‹</Text>
                        </TouchableRipple>

                        <Text style={styles.modalCalendarMonthYear}>
                          {monthNames[tempModalMonth - 1]} {tempModalYear}
                        </Text>

                        <TouchableRipple
                          onPress={() =>
                            setTempModalMonth(prev =>
                              prev < 12 ? prev + 1 : prev,
                            )
                          }
                          disabled={tempModalMonth === 12}
                          style={[
                            styles.calendarNavButton,
                            tempModalMonth === 12 &&
                              styles.calendarNavButtonDisabled,
                          ]}
                        >
                          <Text style={styles.calendarNavButtonText}>›</Text>
                        </TouchableRipple>
                      </View>

                      <View style={styles.modalWeekRow}>
                        {weekdayLabels.map((day, index) => (
                          <Text
                            key={`home-calendar-weekday-${index}`}
                            style={[
                              styles.modalWeekday,
                              index === 0 && styles.modalWeekdaySunday,
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
                                key={`home-calendar-empty-${index}`}
                                style={styles.modalDayButton}
                              />
                            );
                          }

                          const dateKey = `${tempModalYear}-${tempModalMonth
                            .toString()
                            .padStart(2, '0')}-${day
                            .toString()
                            .padStart(2, '0')}`;
                          const isSunday = index % 7 === 0;
                          const isToday = dateKey === todayKey;
                          const hasScheduledTask =
                            scheduledDateSet.has(dateKey);

                          return (
                            <TouchableRipple
                              key={dateKey}
                              onPress={() =>
                                onNavigate('DateTasks', { dateKey })
                              }
                              style={[
                                styles.modalDayButton,
                                isToday && styles.modalDayButtonSelected,
                              ]}
                              borderless
                            >
                              <View style={styles.modalDayContent}>
                                <Text
                                  style={[
                                    styles.modalDayText,
                                    isToday
                                      ? styles.modalDayTextSelected
                                      : styles.modalDayTextDefault,
                                    isSunday &&
                                      !isToday &&
                                      styles.modalDayTextSunday,
                                  ]}
                                >
                                  {day}
                                </Text>
                                {hasScheduledTask && (
                                  <View
                                    style={[
                                      styles.modalDayDot,
                                      isToday && styles.modalDayDotSelected,
                                    ]}
                                  />
                                )}
                              </View>
                            </TouchableRipple>
                          );
                        })}
                      </View>
                    </LinearGradient>
                  </>
                ) : (
                  <>
                    <TouchableRipple
                      onPress={() => setActiveSection(null)}
                      style={styles.activeSectionBackButton}
                    >
                      <Text style={styles.activeSectionBackText}>
                        ← Back to all sections
                      </Text>
                    </TouchableRipple>

                    {activeSection === 'live' &&
                      renderTaskSection('live', 'Live', liveTasks, true)}
                    {activeSection === 'missed' &&
                      renderTaskSection('missed', 'Missed', missedTasks, true)}
                    {activeSection === 'completed' &&
                      renderTaskSection(
                        'completed',
                        'Completed',
                        completedTasks,
                        true,
                      )}
                  </>
                )}

                {liveTasks.length === 0 &&
                  missedTasks.length === 0 &&
                  completedTasks.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyIcon}>📭</Text>
                      <Text
                        variant="headlineSmall"
                        style={[
                          styles.emptyTitle,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {tasks.length === 0
                          ? 'No tasks yet'
                          : 'No tasks available'}
                      </Text>
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.emptySubtitle,
                          { color: palette.textSecondary },
                        ]}
                      >
                        {tasks.length === 0
                          ? 'Tap the add button to create your first task!'
                          : 'Create a task to populate your sections.'}
                      </Text>
                    </View>
                  )}
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

function DateTasksScreen({
  tasks,
  selectedDateKey,
  onToggleTask,
  onDeleteTask,
  onNavigate,
  palette,
}: DateTasksScreenProps) {
  const headerEntranceAnim = React.useRef(new Animated.Value(0)).current;
  const listEntranceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerEntranceAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(listEntranceAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerEntranceAnim, listEntranceAnim]);

  const headerTranslate = headerEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const listTranslate = listEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const listScale = listEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  const tasksForDate = React.useMemo(() => {
    return tasks
      .filter(task => (task.date ?? selectedDateKey) === selectedDateKey)
      .sort((a, b) => {
        const aTime =
          parseTaskDateTime(a, Date.now())?.getTime() ??
          Number.MAX_SAFE_INTEGER;
        const bTime =
          parseTaskDateTime(b, Date.now())?.getTime() ??
          Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [selectedDateKey, tasks]);

  return (
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
            styles.dateTasksHeaderWrap,
            {
              opacity: headerEntranceAnim,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <TouchableRipple
            onPress={() => onNavigate('Home')}
            style={styles.dateTasksBackButton}
          >
            <Text style={styles.dateTasksBackText}>🌈 ← Back</Text>
          </TouchableRipple>
          <View style={styles.dateTasksTitleRow}>
            <Text style={styles.dateTasksTitleIcon}>📅</Text>
            <Text
              style={[styles.dateTasksTitle, { color: palette.textPrimary }]}
            >
              {formatTaskDateLabel(selectedDateKey)}
            </Text>
          </View>
          <Text
            style={[styles.dateTasksSubtitle, { color: palette.textSecondary }]}
          >
            🧾 {tasksForDate.length} task{tasksForDate.length === 1 ? '' : 's'}
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: listEntranceAnim,
            transform: [{ translateY: listTranslate }, { scale: listScale }],
          }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.dateTasksListContent}
          >
            {tasksForDate.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text
                  variant="headlineSmall"
                  style={[styles.emptyTitle, { color: palette.textPrimary }]}
                >
                  No tasks on this date
                </Text>
              </View>
            ) : (
              tasksForDate.map(task => {
                const isDone = task.completed;
                const dateTimeLabel = task.time
                  ? `⏰ ${formatTaskTime(task.time)}`
                  : 'No reminder';

                return (
                  <Card
                    key={task.id}
                    style={[
                      styles.dateTasksCard,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                      },
                      isDone && styles.cardCompleted,
                    ]}
                  >
                    <Card.Content style={styles.dateTasksCardContent}>
                      <View style={styles.dateTasksCardTop}>
                        <Text
                          style={[
                            styles.dateTasksCardTitle,
                            { color: palette.textPrimary },
                            isDone && styles.completedText,
                          ]}
                        >
                          {task.title}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            isDone
                              ? styles.statusBadgeDone
                              : styles.statusBadgeLive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isDone
                                ? styles.statusBadgeTextDone
                                : styles.statusBadgeTextLive,
                            ]}
                          >
                            {isDone ? 'Done' : 'Live'}
                          </Text>
                        </View>
                      </View>

                      {!!task.description && (
                        <Text
                          style={[
                            styles.dateTasksCardDescription,
                            { color: palette.textSecondary },
                            isDone && styles.completedDescription,
                          ]}
                        >
                          {task.description}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.dateTasksCardTime,
                          { color: palette.textSecondary },
                          isDone && styles.completedDescription,
                        ]}
                      >
                        {dateTimeLabel}
                      </Text>

                      <View style={styles.dateTasksActionsRow}>
                        <TouchableRipple
                          onPress={() => onToggleTask(task.id)}
                          style={styles.actionButtonWrap}
                          borderless
                        >
                          <LinearGradient
                            colors={
                              isDone
                                ? ['#6366F1', '#818CF8']
                                : ['#10B981', '#34D399']
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

                        <TouchableRipple
                          onPress={() => onDeleteTask(task.id)}
                          style={styles.actionButtonWrap}
                          borderless
                        >
                          <LinearGradient
                            colors={['#EF4444', '#F97316']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.actionButton}
                          >
                            <Text style={styles.actionLabel}>Delete</Text>
                          </LinearGradient>
                        </TouchableRipple>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatTasksScreen({
  tasks,
  filterType,
  onToggleTask,
  onDeleteTask,
  onNavigate,
  palette,
}: StatTasksScreenProps) {
  const [now, setNow] = useState(() => Date.now());
  const headerEntranceAnim = React.useRef(new Animated.Value(0)).current;
  const listEntranceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerEntranceAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(listEntranceAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerEntranceAnim, listEntranceAnim]);

  const headerTranslate = headerEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const listTranslate = listEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const listScale = listEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  const todayKey = formatDateKey(new Date(now));
  const screenTitle =
    filterType === 'done'
      ? 'Done Tasks'
      : filterType === 'missed'
      ? 'Missed Tasks'
      : filterType === 'today'
      ? 'Today Tasks'
      : 'All Tasks';
  const screenIcon =
    filterType === 'done'
      ? '✅'
      : filterType === 'missed'
      ? '🚨'
      : filterType === 'today'
      ? '🗓️'
      : '📚';

  const isMissedTask = React.useCallback(
    (task: Task) => {
      if (task.completed) {
        return false;
      }

      const scheduledAt = parseTaskDateTime(task, now);
      return Boolean(scheduledAt && scheduledAt.getTime() <= now);
    },
    [now],
  );

  const filteredTasks = React.useMemo(() => {
    const subset = tasks.filter(task => {
      if (filterType === 'done') {
        return task.completed;
      }

      if (filterType === 'missed') {
        return isMissedTask(task);
      }

      if (filterType === 'today') {
        return (task.date ?? todayKey) === todayKey;
      }

      return true;
    });

    return subset.sort((a, b) => {
      const aTime =
        parseTaskDateTime(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime =
        parseTaskDateTime(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [filterType, isMissedTask, now, tasks, todayKey]);

  return (
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
            styles.dateTasksHeaderWrap,
            {
              opacity: headerEntranceAnim,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <TouchableRipple
            onPress={() => onNavigate('Home')}
            style={styles.dateTasksBackButton}
          >
            <Text style={styles.dateTasksBackText}>🌈 ← Back</Text>
          </TouchableRipple>
          <Text style={[styles.dateTasksTitle, { color: palette.textPrimary }]}>
            {screenIcon} {screenTitle}
          </Text>
          <Text
            style={[styles.dateTasksSubtitle, { color: palette.textSecondary }]}
          >
            🧾 {filteredTasks.length} task
            {filteredTasks.length === 1 ? '' : 's'}
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: listEntranceAnim,
            transform: [{ translateY: listTranslate }, { scale: listScale }],
          }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.dateTasksListContent}
          >
            {filteredTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text
                  variant="headlineSmall"
                  style={[styles.emptyTitle, { color: palette.textPrimary }]}
                >
                  No tasks in this section
                </Text>
              </View>
            ) : (
              filteredTasks.map(task => {
                const isDone = task.completed;
                const isMissed = isMissedTask(task);
                const dateTimeLabel = task.time
                  ? `${formatTaskDateLabel(
                      task.date ?? todayKey,
                    )}  •  ${formatTaskTime(task.time)}`
                  : 'No reminder';

                return (
                  <Card
                    key={task.id}
                    style={[
                      styles.dateTasksCard,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                      },
                      isDone && styles.cardCompleted,
                      isMissed && styles.cardMissed,
                    ]}
                  >
                    <Card.Content style={styles.dateTasksCardContent}>
                      <View style={styles.dateTasksCardTop}>
                        <Text
                          style={[
                            styles.dateTasksCardTitle,
                            { color: palette.textPrimary },
                            isDone && styles.completedText,
                          ]}
                        >
                          {task.title}
                        </Text>
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
                      </View>

                      {!!task.description && (
                        <Text
                          style={[
                            styles.dateTasksCardDescription,
                            { color: palette.textSecondary },
                            isDone && styles.completedDescription,
                          ]}
                        >
                          {task.description}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.dateTasksCardTime,
                          { color: palette.textSecondary },
                          isDone && styles.completedDescription,
                        ]}
                      >
                        {dateTimeLabel}
                      </Text>

                      <View style={styles.dateTasksActionsRow}>
                        <TouchableRipple
                          onPress={() => onToggleTask(task.id)}
                          style={styles.actionButtonWrap}
                          borderless
                        >
                          <LinearGradient
                            colors={
                              isDone
                                ? ['#6366F1', '#818CF8']
                                : ['#10B981', '#34D399']
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

                        <TouchableRipple
                          onPress={() => onDeleteTask(task.id)}
                          style={styles.actionButtonWrap}
                          borderless
                        >
                          <LinearGradient
                            colors={['#EF4444', '#F97316']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.actionButton}
                          >
                            <Text style={styles.actionLabel}>Delete</Text>
                          </LinearGradient>
                        </TouchableRipple>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function AddTaskScreen({
  onAddTask,
  onEditTask,
  onNavigate,
  tasks,
  editingTask,
  palette,
}: AddTaskScreenProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const defaultDateKey = React.useMemo(() => getTomorrowDateKey(), []);
  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(
    editingTask?.description || '',
  );
  const [time, setTime] = useState(editingTask?.time || '');
  const [selectedDate, setSelectedDate] = useState(
    editingTask?.date || defaultDateKey,
  );
  const selectedDateParts = (editingTask?.date || defaultDateKey)
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
  const hourWheelRef = React.useRef<ScrollView | null>(null);
  const minuteWheelRef = React.useRef<ScrollView | null>(null);
  const meridiemWheelRef = React.useRef<ScrollView | null>(null);
  const pickerOpenedAtRef = React.useRef(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const formHeaderAnim = React.useRef(new Animated.Value(0)).current;
  const formCardAnim = React.useRef(new Animated.Value(0)).current;
  const formSectionAnims = React.useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0)),
  ).current;
  const pickerDialogAnim = React.useRef(new Animated.Value(0)).current;
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
  const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const scheduledDateSet = React.useMemo(
    () =>
      new Set(
        tasks
          .map(task => task.date)
          .filter((value): value is string => Boolean(value)),
      ),
    [tasks],
  );

  const closePickerPopups = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handlePickerOverlayPress = () => {
    // Ignore the first tap-through immediately after opening a picker.
    if (Date.now() - pickerOpenedAtRef.current < 180) {
      return;
    }

    closePickerPopups();
  };

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

    Animated.stagger(85, [
      Animated.timing(formHeaderAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formCardAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...formSectionAnims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ]).start();
  }, [fadeAnim, formCardAnim, formHeaderAnim, formSectionAnims, slideAnim]);

  React.useEffect(() => {
    if (!showDatePicker && !showTimePicker) {
      pickerDialogAnim.setValue(0);
      return;
    }

    Animated.spring(pickerDialogAnim, {
      toValue: 1,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [pickerDialogAnim, showDatePicker, showTimePicker]);

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
  const hourWheelValues = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  );
  const minuteWheelValues = React.useMemo(
    () => Array.from({ length: 60 }, (_, index) => index),
    [],
  );
  const meridiemWheelValues = React.useMemo(() => ['AM', 'PM'] as const, []);

  const handleTimeOpen = () => {
    setShowDatePicker(false);
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
    pickerOpenedAtRef.current = Date.now();
    requestAnimationFrame(() => {
      setShowTimePicker(true);
    });
  };

  const handleDateOpen = () => {
    setShowTimePicker(false);
    const [year, month, day] = selectedDate
      .split('-')
      .map(value => parseInt(value, 10));
    updateTempDate(year, month, day);
    pickerOpenedAtRef.current = Date.now();
    requestAnimationFrame(() => {
      setShowDatePicker(true);
    });
  };

  const calendarDays = getCalendarDays(currentYear, tempMonth);
  const formCalendarTitle = new Date(
    `${currentYear}-${tempMonth.toString().padStart(2, '0')}-01T00:00:00`,
  ).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
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

  const setMeridiem = (nextMeridiem: 'AM' | 'PM') => {
    updateTempTime(tempHour12, tempMinutes, nextMeridiem);
  };

  const scrollWheelToIndex = (
    ref: React.MutableRefObject<ScrollView | null>,
    index: number,
    animated = false,
  ) => {
    ref.current?.scrollTo({
      x: 0,
      y: index * TIME_WHEEL_ITEM_HEIGHT,
      animated,
    });
  };

  React.useEffect(() => {
    if (!showTimePicker) {
      return;
    }

    requestAnimationFrame(() => {
      scrollWheelToIndex(hourWheelRef, tempHour12 - 1);
      scrollWheelToIndex(minuteWheelRef, tempMinutes);
      scrollWheelToIndex(meridiemWheelRef, tempMeridiem === 'AM' ? 0 : 1);
    });
  }, [showTimePicker, tempHour12, tempMeridiem, tempMinutes]);

  const commitSelectedTime = () => {
    setTime(
      `${tempHours.toString().padStart(2, '0')}:${tempMinutes
        .toString()
        .padStart(2, '0')}`,
    );
    closePickerPopups();
  };

  const getWheelIndex = (offsetY: number, length: number) => {
    const raw = Math.round(offsetY / TIME_WHEEL_ITEM_HEIGHT);
    return Math.max(0, Math.min(length - 1, raw));
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
      date: selectedDate,
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
    setSelectedDate(defaultDateKey);
    const [, resetMonth, resetDay] = defaultDateKey
      .split('-')
      .map(value => parseInt(value, 10));
    setTempMonth(resetMonth);
    setTempDay(resetDay);
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
            <Animated.View
              style={[
                styles.formHeader,
                {
                  opacity: formHeaderAnim,
                  transform: [
                    {
                      translateY: formHeaderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
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
            </Animated.View>

            <Animated.View
              style={{
                opacity: formCardAnim,
                transform: [
                  {
                    translateY: formCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              }}
            >
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
                  <Animated.View
                    style={[
                      styles.formSection,
                      {
                        opacity: formSectionAnims[0],
                        transform: [
                          {
                            translateY: formSectionAnims[0].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
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
                      style={[
                        styles.input,
                        { backgroundColor: palette.inputBg },
                      ]}
                      textColor={palette.textPrimary}
                      outlineColor="#DBE4FF"
                      activeOutlineColor="#4F46E5"
                      placeholder="What needs to be done?"
                      placeholderTextColor="#94A3B8"
                    />
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.formSection,
                      {
                        opacity: formSectionAnims[1],
                        transform: [
                          {
                            translateY: formSectionAnims[1].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
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
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.formSection,
                      {
                        opacity: formSectionAnims[2],
                        transform: [
                          {
                            translateY: formSectionAnims[2].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.formInlineFieldsRow}>
                      <View style={styles.formInlineField}>
                        <Text
                          style={[
                            styles.inputLabel,
                            styles.formFieldTitle,
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
                            <View style={styles.formInlineContentWrap}>
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
                                Pick date
                              </Text>
                            </View>
                            <Text style={styles.calendarFieldIcon}>📅</Text>
                          </View>
                        </TouchableRipple>
                      </View>

                      <View style={styles.formInlineField}>
                        <Text
                          style={[
                            styles.inputLabel,
                            styles.formFieldTitle,
                            { color: palette.textSecondary },
                          ]}
                        >
                          Time
                        </Text>
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
                              {time ? formatTaskTime(time) : 'Set time'}
                            </Text>
                          </View>
                        </TouchableRipple>
                      </View>
                    </View>
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.formSection,
                      {
                        opacity: formSectionAnims[4],
                        transform: [
                          {
                            translateY: formSectionAnims[4].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
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
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.formSection,
                      {
                        opacity: formSectionAnims[5],
                        transform: [
                          {
                            translateY: formSectionAnims[5].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
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
                  </Animated.View>

                  <Modal
                    visible={showDatePicker}
                    transparent
                    animationType="fade"
                    onRequestClose={closePickerPopups}
                  >
                    <Pressable
                      style={styles.pickerPopupOverlay}
                      onPress={handlePickerOverlayPress}
                    >
                      <Animated.View
                        style={[
                          styles.pickerDialogAnimatedWrap,
                          {
                            opacity: pickerDialogAnim,
                            transform: [
                              {
                                translateY: pickerDialogAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [20, 0],
                                }),
                              },
                              {
                                scale: pickerDialogAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.96, 1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Pressable
                          style={styles.timePickerBox}
                          onPress={event => event.stopPropagation()}
                        >
                          <Text style={styles.timePickerTitle}>
                            Select Date
                          </Text>

                          <LinearGradient
                            colors={[
                              'rgba(59,130,246,0.08)',
                              'rgba(255,255,255,0.88)',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.homeMiniCalendar}
                          >
                            <View style={styles.homeMiniCalendarDivider} />
                            <View style={styles.homeMiniCalendarHeader}>
                              <TouchableRipple
                                onPress={() => changeCalendarMonth(-1)}
                                disabled={tempMonth === currentMonth}
                                style={[
                                  styles.homeMiniCalendarNavButton,
                                  tempMonth === currentMonth &&
                                    styles.formHomeCalendarNavButtonDisabled,
                                ]}
                              >
                                <Text style={styles.homeMiniCalendarNavText}>
                                  ‹
                                </Text>
                              </TouchableRipple>

                              <Text
                                style={[
                                  styles.homeMiniCalendarMonthPillText,
                                  { color: palette.textPrimary },
                                ]}
                              >
                                🗓️ {formCalendarTitle}
                              </Text>

                              <TouchableRipple
                                onPress={() => changeCalendarMonth(1)}
                                disabled={tempMonth === 12}
                                style={[
                                  styles.homeMiniCalendarNavButton,
                                  tempMonth === 12 &&
                                    styles.formHomeCalendarNavButtonDisabled,
                                ]}
                              >
                                <Text style={styles.homeMiniCalendarNavText}>
                                  ›
                                </Text>
                              </TouchableRipple>
                            </View>
                            <View style={styles.homeMiniCalendarDivider} />

                            <View style={styles.homeMiniCalendarWeekRow}>
                              {weekdayNames.map((day, index) => (
                                <Text
                                  key={`weekday-${index}`}
                                  style={[
                                    styles.homeMiniCalendarWeekday,
                                    index === 0 &&
                                      styles.homeMiniCalendarWeekdaySunday,
                                  ]}
                                >
                                  {day}
                                </Text>
                              ))}
                            </View>
                            <View style={styles.homeMiniCalendarDivider} />

                            <View style={styles.homeMiniCalendarGrid}>
                              {calendarDays.map((day, index) => {
                                if (!day) {
                                  return (
                                    <View
                                      key={`empty-${index}`}
                                      style={styles.homeMiniCalendarDaySpacer}
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
                                const hasScheduledTask =
                                  scheduledDateSet.has(dateKey);
                                const isSundayColumn = index % 7 === 0;

                                const dayInner = (
                                  <View
                                    style={[
                                      styles.homeMiniCalendarDayInner,
                                      isSelected &&
                                        styles.homeMiniCalendarDayInnerToday,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.homeMiniCalendarDayText,
                                        isSundayColumn &&
                                          !isSelected &&
                                          !isDisabled &&
                                          styles.homeMiniCalendarDayTextSunday,
                                        hasScheduledTask &&
                                          styles.homeMiniCalendarDayTextHasTasks,
                                        isSelected &&
                                          styles.homeMiniCalendarDayTextToday,
                                        isDisabled &&
                                          styles.formHomeCalendarDayTextDisabled,
                                      ]}
                                    >
                                      {day}
                                    </Text>
                                    {hasScheduledTask && (
                                      <View
                                        style={[
                                          styles.homeMiniCalendarDot,
                                          isSelected &&
                                            styles.formHomeCalendarDotSelected,
                                        ]}
                                      />
                                    )}
                                  </View>
                                );

                                return (
                                  <TouchableRipple
                                    key={dateKey}
                                    onPress={() => {
                                      if (isDisabled) {
                                        return;
                                      }

                                      updateTempDate(
                                        currentYear,
                                        tempMonth,
                                        day,
                                      );
                                      setSelectedDate(dateKey);
                                      closePickerPopups();
                                    }}
                                    disabled={isDisabled}
                                    style={[
                                      styles.homeMiniCalendarDay,
                                      isToday &&
                                        styles.homeMiniCalendarDayToday,
                                      hasScheduledTask &&
                                        styles.homeMiniCalendarDayHasTasks,
                                      isDisabled &&
                                        styles.formHomeCalendarDayDisabled,
                                    ]}
                                  >
                                    {isSelected ? (
                                      <LinearGradient
                                        colors={['#22D3EE', '#3B82F6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={
                                          styles.homeMiniCalendarTodayGradient
                                        }
                                      >
                                        {dayInner}
                                      </LinearGradient>
                                    ) : (
                                      dayInner
                                    )}
                                  </TouchableRipple>
                                );
                              })}
                            </View>
                          </LinearGradient>
                        </Pressable>
                      </Animated.View>
                    </Pressable>
                  </Modal>

                  <Modal
                    visible={showTimePicker}
                    transparent
                    animationType="fade"
                    onRequestClose={closePickerPopups}
                  >
                    <Pressable
                      style={styles.pickerPopupOverlay}
                      onPress={handlePickerOverlayPress}
                    >
                      <Animated.View
                        style={[
                          styles.pickerDialogAnimatedWrap,
                          {
                            opacity: pickerDialogAnim,
                            transform: [
                              {
                                translateY: pickerDialogAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [20, 0],
                                }),
                              },
                              {
                                scale: pickerDialogAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.96, 1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Pressable
                          style={[
                            styles.timePickerBox,
                            styles.timePickerBoxLarge,
                          ]}
                          onPress={event => event.stopPropagation()}
                        >
                          <View style={styles.timePickerHeaderRow}>
                            <Text style={styles.timePickerTitle}>
                              Select Time
                            </Text>
                            <TouchableRipple
                              onPress={closePickerPopups}
                              style={styles.timePickerCloseButton}
                            >
                              <Text style={styles.timePickerCloseButtonText}>
                                ✕
                              </Text>
                            </TouchableRipple>
                          </View>

                          <View style={styles.timePickerDivider} />

                          <View style={styles.timeWheelGrid}>
                            <View style={styles.timeWheelColumn}>
                              <ScrollView
                                ref={hourWheelRef}
                                style={styles.timeWheelScroll}
                                contentContainerStyle={
                                  styles.timeWheelScrollContent
                                }
                                snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
                                decelerationRate="fast"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                onMomentumScrollEnd={event => {
                                  const index = getWheelIndex(
                                    event.nativeEvent.contentOffset.y,
                                    hourWheelValues.length,
                                  );
                                  const nextHour12 = hourWheelValues[index];
                                  updateTempTime(
                                    nextHour12,
                                    tempMinutes,
                                    tempMeridiem as 'AM' | 'PM',
                                  );
                                  scrollWheelToIndex(hourWheelRef, index);
                                }}
                              >
                                {hourWheelValues.map((value, index) => {
                                  const isSelected = value === tempHour12;

                                  return (
                                    <TouchableRipple
                                      key={`hour-wheel-${value}`}
                                      onPress={() => {
                                        updateTempTime(
                                          value,
                                          tempMinutes,
                                          tempMeridiem as 'AM' | 'PM',
                                        );
                                        scrollWheelToIndex(
                                          hourWheelRef,
                                          index,
                                          true,
                                        );
                                      }}
                                      style={[
                                        styles.timeWheelItem,
                                        isSelected
                                          ? styles.timeWheelActiveButtonHour
                                          : styles.timeWheelGhostButton,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          isSelected
                                            ? styles.timeWheelActiveText
                                            : styles.timeWheelGhostText,
                                        ]}
                                      >
                                        {value.toString().padStart(2, '0')}
                                      </Text>
                                    </TouchableRipple>
                                  );
                                })}
                              </ScrollView>
                              <View
                                style={styles.timeWheelCenterGuide}
                                pointerEvents="none"
                              />
                            </View>

                            <View style={styles.timeWheelColumn}>
                              <ScrollView
                                ref={minuteWheelRef}
                                style={styles.timeWheelScroll}
                                contentContainerStyle={
                                  styles.timeWheelScrollContent
                                }
                                snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
                                decelerationRate="fast"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                onMomentumScrollEnd={event => {
                                  const index = getWheelIndex(
                                    event.nativeEvent.contentOffset.y,
                                    minuteWheelValues.length,
                                  );
                                  const nextMinute = minuteWheelValues[index];
                                  updateTempTime(
                                    tempHour12,
                                    nextMinute,
                                    tempMeridiem as 'AM' | 'PM',
                                  );
                                  scrollWheelToIndex(minuteWheelRef, index);
                                }}
                              >
                                {minuteWheelValues.map((value, index) => {
                                  const isSelected = value === tempMinutes;

                                  return (
                                    <TouchableRipple
                                      key={`minute-wheel-${value}`}
                                      onPress={() => {
                                        updateTempTime(
                                          tempHour12,
                                          value,
                                          tempMeridiem as 'AM' | 'PM',
                                        );
                                        scrollWheelToIndex(
                                          minuteWheelRef,
                                          index,
                                          true,
                                        );
                                      }}
                                      style={[
                                        styles.timeWheelItem,
                                        isSelected
                                          ? styles.timeWheelActiveButtonMinute
                                          : styles.timeWheelGhostButton,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          isSelected
                                            ? styles.timeWheelActiveText
                                            : styles.timeWheelGhostText,
                                        ]}
                                      >
                                        {value.toString().padStart(2, '0')}
                                      </Text>
                                    </TouchableRipple>
                                  );
                                })}
                              </ScrollView>
                              <View
                                style={styles.timeWheelCenterGuide}
                                pointerEvents="none"
                              />
                            </View>

                            <View style={styles.timeWheelColumn}>
                              <ScrollView
                                ref={meridiemWheelRef}
                                style={styles.timeWheelScroll}
                                contentContainerStyle={
                                  styles.timeWheelScrollContent
                                }
                                snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
                                decelerationRate="fast"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                onMomentumScrollEnd={event => {
                                  const index = getWheelIndex(
                                    event.nativeEvent.contentOffset.y,
                                    meridiemWheelValues.length,
                                  );
                                  const nextMeridiem =
                                    meridiemWheelValues[index];
                                  setMeridiem(nextMeridiem);
                                  scrollWheelToIndex(meridiemWheelRef, index);
                                }}
                              >
                                {meridiemWheelValues.map((value, index) => {
                                  const isSelected = value === tempMeridiem;

                                  return (
                                    <TouchableRipple
                                      key={`meridiem-wheel-${value}`}
                                      onPress={() => {
                                        setMeridiem(value);
                                        scrollWheelToIndex(
                                          meridiemWheelRef,
                                          index,
                                          true,
                                        );
                                      }}
                                      style={[
                                        styles.timeWheelItem,
                                        isSelected
                                          ? styles.timeWheelActiveButtonMeridiem
                                          : styles.timeWheelGhostButton,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          isSelected
                                            ? [
                                                styles.timeWheelActiveText,
                                                styles.timeWheelActiveTextLight,
                                              ]
                                            : styles.timeWheelGhostText,
                                        ]}
                                      >
                                        {value}
                                      </Text>
                                    </TouchableRipple>
                                  );
                                })}
                              </ScrollView>
                              <View
                                style={styles.timeWheelCenterGuide}
                                pointerEvents="none"
                              />
                            </View>
                          </View>

                          <View style={styles.timePickerDivider} />

                          <Text style={styles.timePickerPreviewText}>
                            {tempHour12.toString().padStart(2, '0')} :{' '}
                            {tempMinutes.toString().padStart(2, '0')}{' '}
                            {tempMeridiem}
                          </Text>

                          <View style={styles.timePickerFooterDivider} />

                          <View style={styles.timePickerActionRow}>
                            <TouchableRipple
                              onPress={closePickerPopups}
                              style={[
                                styles.timePickerCancelButton,
                                styles.appButtonBase,
                                styles.appButtonSecondary,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timePickerCancelText,
                                  styles.appButtonLabel,
                                ]}
                              >
                                Cancel
                              </Text>
                            </TouchableRipple>

                            <TouchableRipple
                              onPress={commitSelectedTime}
                              style={[
                                styles.timePickerConfirmWrap,
                                styles.appButtonBase,
                                styles.appButtonPrimary,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timePickerConfirmText,
                                  styles.appButtonLabel,
                                  styles.appButtonLabelPrimary,
                                ]}
                              >
                                Confirm
                              </Text>
                            </TouchableRipple>
                          </View>
                        </Pressable>
                      </Animated.View>
                    </Pressable>
                  </Modal>

                  <Animated.View
                    style={[
                      styles.buttonRow,
                      {
                        opacity: formSectionAnims[6],
                        transform: [
                          {
                            translateY: formSectionAnims[6].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableRipple
                      onPress={() => onNavigate('Home')}
                      style={[
                        styles.button,
                        styles.appButtonBase,
                        styles.appButtonSecondary,
                      ]}
                    >
                      <Text style={[styles.buttonLabel, styles.appButtonLabel]}>
                        Cancel
                      </Text>
                    </TouchableRipple>
                    <TouchableRipple
                      onPress={handleSave}
                      disabled={!canSave}
                      style={[
                        styles.saveGradientWrap,
                        styles.appButtonBase,
                        styles.appButtonPrimary,
                        !canSave && styles.saveGradientDisabled,
                      ]}
                    >
                      <View style={styles.saveGradientButton}>
                        <Text
                          style={[
                            styles.buttonLabel,
                            styles.appButtonLabel,
                            styles.appButtonLabelPrimary,
                          ]}
                        >
                          {editingTask ? 'Save' : 'Create'}
                        </Text>
                      </View>
                    </TouchableRipple>
                  </Animated.View>
                </Card.Content>
              </Card>
            </Animated.View>
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
        ) : currentScreen === 'DateTasks' ? (
          <DateTasksScreen
            tasks={tasks}
            selectedDateKey={screenParams?.dateKey ?? formatDateKey(new Date())}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onNavigate={navigate}
            palette={palette}
          />
        ) : currentScreen === 'StatTasks' ? (
          <StatTasksScreen
            tasks={tasks}
            filterType={screenParams?.filterType ?? 'total'}
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
            tasks={tasks}
            editingTask={screenParams?.task}
            palette={palette}
          />
        ) : (
          <AddTaskScreen
            onAddTask={addTask}
            onEditTask={updateTask}
            onNavigate={navigate}
            tasks={tasks}
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTopMainButton: {
    flex: 1,
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
  headerTopAddWrap: {
    marginBottom: 16,
  },
  headerTopAddButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FACC15',
    borderWidth: 1,
    borderColor: '#EAB308',
    shadowColor: '#A16207',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTopAddButtonWithReminders: {
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
  },
  headerTopAddContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTopAddIcon: {
    fontSize: 21,
    lineHeight: 24,
    color: '#1F2937',
  },
  headerTopAddDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  modalButtonWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
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
  modalWeekdaySunday: {
    color: '#DC2626',
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
  modalDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
  modalDayTextSunday: {
    color: '#DC2626',
  },
  modalDayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
    backgroundColor: '#4F46E5',
  },
  modalDayDotSelected: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
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
  statSeparator: {
    width: 1,
    marginVertical: 8,
    backgroundColor: 'rgba(167, 139, 250, 0.35)',
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  statItemUpcomingOnly: {
    opacity: 0.92,
  },
  statItemCalendarAction: {
    opacity: 0.98,
  },
  statItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 12,
    marginBottom: 1,
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
  statNumberCalendar: {
    color: '#2563EB',
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
  homeUnifiedFrame: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  homeUnifiedFrameContent: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  homeCapsulesContainer: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  plannerCanvasCard: {
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.54)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  plannerCanvasGlowPrimary: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    right: -22,
    top: -18,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  plannerCanvasGlowSecondary: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    left: -18,
    bottom: -20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  plannerCanvasHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  plannerCanvasTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  plannerCanvasSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4C5A78',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  plannerWeekStripRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  plannerWeekPill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  plannerWeekPillToday: {
    borderColor: 'rgba(37, 99, 235, 0.68)',
    backgroundColor: 'rgba(219, 234, 254, 0.88)',
  },
  plannerWeekPillInner: {
    alignItems: 'center',
  },
  plannerWeekPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  plannerWeekPillDayNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  plannerWeekPillDot: {
    marginTop: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.58)',
  },
  plannerWeekPillDotActive: {
    backgroundColor: '#22C55E',
  },
  plannerNextTasksWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  plannerNextTasksTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 6,
  },
  plannerNextTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  plannerNextTaskBullet: {
    fontSize: 8,
    color: '#2563EB',
  },
  plannerNextTaskText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  plannerNextTaskMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  plannerNextTaskEmpty: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  plannerCanvasActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  plannerCanvasActionPill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.66)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  plannerCanvasActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  homeMiniCalendar: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 0,
  },
  homeMiniCalendarDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    marginBottom: 8,
  },
  homeMiniCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeMiniCalendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
  },
  homeMiniCalendarNavText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '500',
    color: '#4C5A78',
  },
  homeMiniCalendarMonthPillText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  homeMiniCalendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  homeMiniCalendarWeekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#8B95AF',
  },
  homeMiniCalendarWeekdaySunday: {
    color: '#DC2626',
  },
  homeMiniCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  homeMiniCalendarDaySpacer: {
    width: '14.2857%',
    aspectRatio: 1.3,
  },
  homeMiniCalendarDay: {
    width: '14.2857%',
    aspectRatio: 1.3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMiniCalendarDayHasTasks: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  homeMiniCalendarDayToday: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  homeMiniCalendarTodayGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMiniCalendarDayInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    minHeight: 24,
  },
  homeMiniCalendarDayInnerToday: {
    minWidth: 42,
    minHeight: 42,
  },
  homeMiniCalendarDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#67718D',
  },
  homeMiniCalendarDayTextSunday: {
    color: '#DC2626',
  },
  homeMiniCalendarDayTextHasTasks: {
    color: '#4A5371',
  },
  homeMiniCalendarDayTextToday: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  homeMiniCalendarDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: '#7C86A1',
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
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
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
  taskSectionsContent: {
    paddingBottom: 100,
    gap: 12,
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
  dateTasksHeaderWrap: {
    marginTop: 10,
    marginBottom: 10,
  },
  dateTasksBackButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 8,
  },
  dateTasksBackText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#312E81',
  },
  dateTasksTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  dateTasksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTasksTitleIcon: {
    fontSize: 22,
  },
  dateTasksSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  dateTasksListContent: {
    paddingBottom: 110,
    gap: 10,
  },
  dateTasksCard: {
    borderRadius: 18,
    borderWidth: 1,
  },
  dateTasksCardContent: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dateTasksCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  dateTasksCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  dateTasksCardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },
  dateTasksCardTime: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  dateTasksActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.6)',
    elevation: 5,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
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
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  dropdownCardWrap: {
    marginBottom: 10,
  },
  dropdownCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.74)',
    elevation: 6,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  dropdownCardInner: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
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
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
  },
  checkboxShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.86)',
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  checkboxInnerChecked: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  checkboxInnerMissed: {
    borderColor: '#F87171',
    backgroundColor: 'rgba(254, 226, 226, 0.88)',
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
    paddingTop: 1,
  },
  taskTagRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  smallTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
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
  taskDateInlineTag: {
    flexShrink: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
  },
  taskDateInlineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskScheduleBlock: {
    marginTop: 4,
    gap: 2,
  },
  taskScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskScheduleIcon: {
    fontSize: 11,
    width: 14,
  },
  taskScheduleText: {
    fontSize: 11,
    fontWeight: '700',
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
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  dropdownChevron: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
  },
  dropdownBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  taskHintBox: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.76)',
    backgroundColor: 'rgba(239, 246, 255, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  taskHintTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.25,
  },
  taskHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 15,
  },
  completedSection: {
    marginTop: 0,
    position: 'relative',
    zIndex: 1,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  completedSectionActive: {
    flex: 1,
    minHeight: 0,
  },
  liveSectionBox: {
    borderColor: '#6EE7B7',
    backgroundColor: 'rgba(220, 252, 231, 0.94)',
  },
  missedSectionBox: {
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(254, 226, 226, 0.94)',
  },
  completedSectionBox: {
    borderColor: '#BFDBFE',
    backgroundColor: 'rgba(239, 246, 255, 0.94)',
  },
  completedSortWrap: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  completedSortScroll: {
    maxWidth: '100%',
  },
  completedSortRow: {
    gap: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  activeSectionBackButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  activeSectionBackText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#312E81',
  },
  completedListBox: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
  },
  completedListBoxCollapsed: {
    maxHeight: 430,
  },
  completedListBoxActive: {
    flex: 1,
    minHeight: 0,
    height: '100%',
  },
  completedListScroll: {
    width: '100%',
  },
  completedListScrollCollapsed: {
    maxHeight: 372,
  },
  completedListScrollActive: {
    flex: 1,
    minHeight: 0,
  },
  completedListContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  completedListContentActive: {
    flexGrow: 1,
  },
  sectionPlannerFooter: {
    marginTop: 'auto',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionPlannerFooterTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  sectionPlannerFooterSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  completedHeader: {
    borderRadius: 20,
    zIndex: 2,
    elevation: 2,
  },
  completedHeaderActive: {
    zIndex: 5,
    elevation: 8,
  },
  completedHeaderContent: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  completedHeaderContentActive: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  completedHeaderActiveDividerGlow: {
    height: 11,
    marginTop: -1,
    marginBottom: 2,
  },
  liveHeaderContent: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  missedHeaderContent: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  completedHeaderContentDefault: {
    borderLeftWidth: 4,
    borderLeftColor: '#64748B',
  },
  completedHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  liveHeaderTitle: {
    color: '#047857',
  },
  missedHeaderTitle: {
    color: '#B91C1C',
  },
  completedHeaderTitleDefault: {
    color: '#334155',
  },
  completedHeaderArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  liveHeaderArrow: {
    color: '#10B981',
  },
  missedHeaderArrow: {
    color: '#EF4444',
  },
  completedHeaderArrowDefault: {
    color: '#64748B',
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
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  taskDescription: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
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
    fontSize: 9,
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
  statusDot3D: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.26,
    shadowRadius: 5,
    elevation: 3,
    overflow: 'hidden',
  },
  statusDot3DLive: {
    borderColor: '#059669',
    backgroundColor: '#10B981',
    shadowColor: '#059669',
  },
  statusDot3DMissed: {
    borderColor: '#B91C1C',
    backgroundColor: '#EF4444',
    shadowColor: '#B91C1C',
  },
  statusDot3DHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 6,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.66)',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  timeChip: {
    backgroundColor: 'rgba(199, 210, 254, 0.45)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  dateChip: {
    backgroundColor: 'rgba(167, 243, 208, 0.45)',
    borderColor: 'rgba(20, 184, 166, 0.3)',
  },
  countdownChip: {
    backgroundColor: 'rgba(254, 215, 170, 0.48)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  missedChip: {
    backgroundColor: 'rgba(254, 202, 202, 0.48)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
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
    marginTop: 8,
    paddingTop: 8,
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
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.85)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
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
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  formFieldTitle: {
    marginBottom: 6,
  },
  formInlineFieldsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  formInlineField: {
    flex: 1,
    minWidth: 0,
  },
  formInlineContentWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
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
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  calendarFieldContent: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarFieldTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  calendarFieldSubtitle: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
  },
  calendarFieldIcon: {
    fontSize: 16,
  },
  timeButton: {
    marginTop: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBE4FF',
    backgroundColor: 'rgba(238, 242, 255, 0.9)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  timeButtonContent: {
    minHeight: 44,
    paddingHorizontal: 10,
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
    minHeight: 37,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  optionChipInactive: {
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    borderColor: 'rgba(196, 181, 253, 0.5)',
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
    gap: 8,
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
  saveGradientWrap: {
    flex: 1,
    borderRadius: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  saveGradientButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  saveGradientDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  appButtonBase: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appButtonSecondary: {
    borderColor: 'rgba(125, 211, 252, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  appButtonPrimary: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  appButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C5A78',
  },
  appButtonLabelPrimary: {
    color: '#FFFFFF',
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
  pickerDialogAnimatedWrap: {
    width: '100%',
  },
  timePickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 10,
    alignItems: 'center',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 7,
  },
  timePickerBoxLarge: {
    paddingTop: 8,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  timePickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#304D91',
    marginBottom: 0,
  },
  timePickerHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  timePickerCloseButton: {
    position: 'absolute',
    right: 0,
    top: -1,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#D5DCFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7683A9',
  },
  timePickerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#D7DEEF',
    marginTop: 8,
    marginBottom: 8,
  },
  timeWheelGrid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 0,
  },
  timeWheelColumn: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  timeWheelScroll: {
    width: '100%',
    height: TIME_WHEEL_ITEM_HEIGHT * 3,
  },
  timeWheelScrollContent: {
    paddingVertical: TIME_WHEEL_ITEM_HEIGHT,
  },
  timeWheelItem: {
    width: '100%',
    minHeight: TIME_WHEEL_ITEM_HEIGHT,
  },
  timeWheelGhostButton: {
    width: '100%',
    minHeight: TIME_WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  timeWheelGhostText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B0BAD8',
  },
  timeWheelActiveButtonHour: {
    width: '100%',
    minHeight: TIME_WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D5DEF7',
    backgroundColor: '#E8ECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWheelActiveButtonMinute: {
    width: '100%',
    minHeight: TIME_WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BCD6FA',
    backgroundColor: '#CFE2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWheelActiveButtonMeridiem: {
    width: '100%',
    minHeight: TIME_WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7B72F4',
    backgroundColor: '#6E63F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6E63F0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  timeWheelActiveText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F4D91',
  },
  timeWheelActiveTextLight: {
    color: '#FFFFFF',
  },
  timeWheelCenterGuide: {
    position: 'absolute',
    top: TIME_WHEEL_ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: TIME_WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.35)',
  },
  timePickerPreviewText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#2F4D91',
    marginBottom: 8,
  },
  timePickerFooterDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#D7DEEF',
    marginLeft: 0,
  },
  timePickerActionRow: {
    width: '100%',
    marginLeft: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  timePickerCancelButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C5A78',
  },
  timePickerConfirmWrap: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerCompactConfirmButton: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  timePickerConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  formHomeCalendar: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.22)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: 8,
  },
  formHomeCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formHomeCalendarHeaderTextWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHomeCalendarMonthText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#304D91',
  },
  formHomeCalendarSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7CA5',
  },
  formHomeCalendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
  },
  formHomeCalendarNavButtonDisabled: {
    opacity: 0.35,
  },
  formHomeCalendarNavText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '500',
    color: '#4C5A78',
  },
  formHomeCalendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  formHomeCalendarWeekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#8B95AF',
  },
  formHomeCalendarWeekdaySunday: {
    color: '#DC2626',
  },
  formHomeCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  formHomeCalendarDaySpacer: {
    width: '14.2857%',
    aspectRatio: 1,
  },
  formHomeCalendarDay: {
    width: '14.2857%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHomeCalendarDayToday: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  formHomeCalendarDaySunday: {
    backgroundColor: 'rgba(254, 226, 226, 0.35)',
  },
  formHomeCalendarDaySelected: {
    backgroundColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  formHomeCalendarDayDisabled: {
    opacity: 0.38,
  },
  formHomeCalendarDayInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    minHeight: 24,
  },
  formHomeCalendarDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A5371',
  },
  formHomeCalendarDayTextSelected: {
    color: '#FFFFFF',
  },
  formHomeCalendarDayTextToday: {
    color: '#0F4CD1',
    fontWeight: '800',
  },
  formHomeCalendarDayTextSunday: {
    color: '#DC2626',
  },
  formHomeCalendarDayTextDisabled: {
    color: '#AEB8CF',
  },
  formHomeCalendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: '#5B5DD8',
  },
  formHomeCalendarDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  calendarHeaderTextWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#312E81',
    textAlign: 'center',
  },
  calendarHeaderSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    textAlign: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 10,
    paddingVertical: 6,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  calendarWeekdaySunday: {
    color: '#DC2626',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  calendarDaySpacer: {
    width: '14.2857%',
    aspectRatio: 1,
  },
  calendarDayButton: {
    width: '14.2857%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(219, 228, 255, 0.9)',
  },
  calendarDayButtonSunday: {
    backgroundColor: 'rgba(254, 226, 226, 0.45)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
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
    backgroundColor: 'rgba(224, 231, 255, 0.8)',
    borderColor: '#6366F1',
  },
  calendarDayButtonDisabled: {
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  calendarDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  calendarDayTextSunday: {
    color: '#DC2626',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
  },
  calendarDayTextToday: {
    color: '#3730A3',
  },
  calendarDayTextDisabled: {
    color: '#CBD5E1',
  },
  calendarDayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
    backgroundColor: '#4F46E5',
  },
  calendarDayDotSelected: {
    backgroundColor: '#FFFFFF',
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
  timePickerConfirmShadow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  timePickerGradientWrap: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timePickerGradientButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  timePickerButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
