import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Activity, 
  Settings, 
  Settings2,
  Moon, 
  Sun, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Sunrise, 
  BrainCircuit, 
  Coffee, 
  Check,
  X,
  Play,
  Pause,
  AlertTriangle,
  Smartphone,
  BatteryLow,
  VolumeX,
  HelpCircle,
  CheckCircle,
  Info,
  Plus,
  Music,
  Maximize,
  Minimize,
  Sparkles,
  ListTodo,
  Award,
  MessageSquare,
  Trash2,
  Zap,
  Target as TargetIcon,
  Rocket,
  Lightbulb,
  Mountain,
  Shield,
  Compass,
  Crown,
  Trophy,
  Star,
  Terminal,
  BookOpen,
  GripVertical,
  Download,
  Headphones,
  Maximize2,
  Minimize2,
  TableProperties,
  Timer,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement, RadialLinearScale } from 'chart.js';
import { Doughnut, Line, Bar, Radar } from 'react-chartjs-2';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { THEMES, RANKS, INITIAL_SETTINGS, BADGES } from './constants';
import { UserSettings, DailyData, DiagnosticData, Task, SubjectConfig, ThemeType, DailySession, BacklogItem, Plan } from './types';
import { getProductivityAdvice, generateDailyReflection } from './services/geminiService';
import { playChime, toggleAmbientNoise } from './lib/audio';
import { FokesLogo } from './components/Logo';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Filler, 
  BarElement,
  RadialLinearScale
);

// --- Utilities ---
const getDKey = (d: Date) => {
  const z = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return z.toISOString().split('T')[0];
};
const getYMKey = (dKey: string) => dKey.substring(0, 7);

function addMinutes(timeStr: string, mins: number) {
  if (!timeStr) return "00:00";
  let [h, m] = timeStr.split(':').map(Number);
  let totalMins = h * 60 + m + mins;
  let newH = Math.floor(totalMins / 60) % 24;
  let newM = totalMins % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

export default function App() {
  // --- State ---
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('focussync_settings');
    let loaded = saved ? { ...INITIAL_SETTINGS, ...JSON.parse(saved) } : INITIAL_SETTINGS;
    // Removed forced hardcoded theme so user saves work correctly
    return loaded;
  });
  const [db, setDb] = useState<DailyData>(() => {
    const saved = localStorage.getItem('focussync_db');
    return saved ? JSON.parse(saved) : {};
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticData>(() => {
    const saved = localStorage.getItem('focussync_diagnostics');
    return saved ? JSON.parse(saved) : {};
  });
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession[]>>(() => {
    const saved = localStorage.getItem('focussync_daily_sessions');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar' | 'stats' | 'pomodoro'>('daily');
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarQuarter, setCalendarQuarter] = useState(Math.floor(new Date().getMonth() / 3));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBadgesExpanded, setIsBadgesExpanded] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);
  const [draggedTaskIdx, setDraggedTaskIdx] = useState<number | null>(null);
  const [newSession, setNewSession] = useState<{title: string; duration: number; subjectId?: string}>({ title: '', duration: 30 });
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study');
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [diagDate, setDiagDate] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // Pomodoro States
  const [pomoConfig, setPomoConfig] = useState({
    focusTime: 25,
    breakTime: 5,
    longBreakTime: 15,
    rounds: 4,
    autoStartBreaks: false,
    autoStartRounds: false,
    sessionTitle: 'Focus Session',
    subjectId: ''
  });
  const [currentPomoRound, setCurrentPomoRound] = useState(1);
  const [isPomoBreak, setIsPomoBreak] = useState(false);
  const [pomoHistory, setPomoHistory] = useState<{id: string; title: string; date: string; duration: number}[]>(() => {
    const saved = localStorage.getItem('fokes_pomo_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('fokes_pomo_history', JSON.stringify(pomoHistory));
  }, [pomoHistory]);

  const startPomoSession = () => {
    setIsTimerOpen(true);
    setTimeLeft(pomoConfig.focusTime * 60);
    setActiveTask({
      id: `pomo-${Date.now()}`,
      group: 'Study',
      title: `${pomoConfig.sessionTitle} - Round ${currentPomoRound}`,
      hours: pomoConfig.focusTime / 60,
      subjectId: pomoConfig.subjectId || undefined
    });
    setTimerRunning(true);
    setTimerMode('study');
    setIsZenMode(true);
  };

  // New Feature States
  const [isProgramConfigOpen, setIsProgramConfigOpen] = useState(false);
  const [localPlans, setLocalPlans] = useState<Plan[]>([]);
  const [editingPlanIdx, setEditingPlanIdx] = useState(0);

  const openConfig = () => {
    const plansToEdit = settings.plans && settings.plans.length > 0 ? [...settings.plans] : [INITIAL_SETTINGS.plans[0]];
    setLocalPlans(JSON.parse(JSON.stringify(plansToEdit)));
    
    const addDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() + days);
      const z = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
      return z.toISOString().split('T')[0];
    };
    
    const idx = plansToEdit.findIndex(p => dateKey >= p.startDate && dateKey <= addDays(p.startDate, p.durationDays));
    setEditingPlanIdx(idx >= 0 ? idx : 0);
    setIsProgramConfigOpen(true);
  };
  
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [scratchpad, setScratchpad] = useState('');
  const [clearStartDate, setClearStartDate] = useState('');
  const [clearEndDate, setClearEndDate] = useState('');

  const handleClearData = () => {
    if (!clearStartDate || !clearEndDate) {
      showToast('Please select both start and end dates', 'error');
      return;
    }
    const start = new Date(clearStartDate);
    const end = new Date(clearEndDate);
    if (start > end) {
      showToast('Start date must be before end date', 'error');
      return;
    }

    const newDb = { ...db };
    const newSessions = { ...dailySessions };

    const formatDate = (date: Date) => {
      const z = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
      return z.toISOString().split('T')[0];
    };
    
    // We iterate exactly from start to end by day
    const loopDate = new Date(start);
    while (loopDate <= end) {
      const str = formatDate(loopDate);
      if (newDb[str]) delete newDb[str];
      if (newSessions[str]) delete newSessions[str];
      loopDate.setDate(loopDate.getDate() + 1);
    }

    setDb(newDb);
    setDailySessions(newSessions);
    
    setSettings(prev => {
      const newOverrides = { ...prev.dailyOverrides };
      const overrideLoopDate = new Date(start);
      while (overrideLoopDate <= end) {
        const str = formatDate(overrideLoopDate);
        if (newOverrides[str]) delete newOverrides[str];
        overrideLoopDate.setDate(overrideLoopDate.getDate() + 1);
      }
      return { ...prev, dailyOverrides: newOverrides };
    });

    showToast('Data cleared for selected period', 'success');
  };

  const handleSeedData = () => {
    const newDb = { ...db };
    const newDiagnostics = { ...diagnostics };
    const newDailySessions = { ...dailySessions };
    let totalXpGain = 0;

    const subjects = activePlan.subjects;
    const morningRoutine = activePlan.morningRoutine;
    const lifeRoutine = activePlan.lifeRoutine;
    const eveningRoutine = activePlan.eveningRoutine;

    const seedDays = 100;
    const todayObj = new Date();
    const startDateObj = new Date();
    startDateObj.setDate(todayObj.getDate() - seedDays);
    const startDateStr = getDKey(startDateObj);

    for (let i = 1; i <= seedDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = getDKey(d);
      
      // Skip if significantly already exists
      if (newDb[k] && newDb[k].length > 3) continue;

      const completedIds: string[] = [];
      const daySessions: DailySession[] = [];
      
      // Randomly decide if it's an off day (15% chance)
      const isOffDay = Math.random() < 0.15;
      if (isOffDay) continue;

      // Productive factor (0.4 to 1.0)
      const productivity = 0.4 + Math.random() * 0.6;

      // Morning Routine
      morningRoutine.forEach(r => {
        if (Math.random() < 0.8 * productivity) {
          completedIds.push(r.id);
          totalXpGain += 20;
        }
      });

      // Subject Tasks as Daily Sessions
      subjects.forEach(sub => {
        const blocks = Math.ceil(sub.targetHours / (sub.blockDuration / 60));
        for (let b = 1; b <= blocks; b++) {
          const sessionId = `seed-${k}-${sub.id}-${b}`;
          // We create the session even if not completed, so the section looks "filled"
          daySessions.push({
            id: sessionId,
            title: `Deep Work: ${sub.title} #${b}`,
            duration: sub.blockDuration,
            subjectId: sub.id
          });

          if (Math.random() < productivity) {
            completedIds.push(sessionId);
            totalXpGain += 50;
          }
        }
      });

      // Life/Evening Routine
      lifeRoutine.forEach(r => {
        if (Math.random() < 0.7 * productivity) {
          completedIds.push(r.id);
          totalXpGain += 20;
        }
      });
      eveningRoutine.forEach(r => {
        if (Math.random() < 0.9 * productivity) {
          completedIds.push(r.id);
          totalXpGain += 20;
        }
      });

      const totalPossible = morningRoutine.length + eveningRoutine.length + lifeRoutine.length + daySessions.length;
      
      if (completedIds.length === totalPossible && totalPossible > 0) {
        totalXpGain += 500;
      }

      newDb[k] = completedIds;
      newDailySessions[k] = daySessions;

      if (productivity < 0.5) {
        const reasons = ["Smartphone / Social Media", "Fatigue / Burnout", "Environmental Distraction", "Poor Planning / Ambiguity"];
        newDiagnostics[k] = reasons[Math.floor(Math.random() * reasons.length)];
      }
    }

    setDb(newDb);
    setDiagnostics(newDiagnostics);
    setDailySessions(newDailySessions);
    
    // Update active plan to cover the range
    setSettings(prev => {
      const newPlans = [...prev.plans];
      const planIdx = newPlans.findIndex(p => p.id === activePlan.id);
      if (planIdx >= 0) {
        newPlans[planIdx] = {
          ...newPlans[planIdx],
          startDate: startDateStr,
          durationDays: 150 
        };
      }
      return { ...prev, plans: newPlans, xp: prev.xp + totalXpGain };
    });

    showToast('Successfully seeded 100 days of random data!', 'success');
  };

  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [reflectionText, setReflectionText] = useState<string | null>(null);
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDayOpen, setIsEditDayOpen] = useState(false);
  const [editDayDraft, setEditDayDraft] = useState<Task[]>([]);
  const [customIsOffDay, setCustomIsOffDay] = useState(false);
  const [configEditorOpen, setConfigEditorOpen] = useState<'morningRoutine' | 'lifeRoutine' | 'eveningRoutine' | 'subjects' | null>(null);

  const prevXpRef = useRef(settings.xp);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('focussync_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('focussync_db', JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    localStorage.setItem('focussync_diagnostics', JSON.stringify(diagnostics));
  }, [diagnostics]);

  useEffect(() => {
    localStorage.setItem('focussync_daily_sessions', JSON.stringify(dailySessions));
  }, [dailySessions]);

  // --- Theme Application ---
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEMES[settings.theme] || THEMES['tokyo_night']; // Fallback for old themes
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });
    root.classList.toggle('dark', settings.isDarkMode);
    root.setAttribute('data-theme', settings.theme);
  }, [settings.theme, settings.isDarkMode]);

  // --- Derived Data ---
  useEffect(() => {
    if (localStorage.getItem('focussync_mocked_130_settings')) {
      localStorage.removeItem('focussync_db');
      localStorage.removeItem('focussync_settings');
      localStorage.removeItem('focussync_mocked_130_settings');
      localStorage.removeItem('focussync_mocked_130');
      window.location.reload();
    }
  }, []);

  const dateKey = useMemo(() => getDKey(currentDate), [currentDate]);
  const ymKey = useMemo(() => getYMKey(dateKey), [dateKey]);

  const activePlan = useMemo(() => {
    if (!settings.plans || settings.plans.length === 0) {
      return INITIAL_SETTINGS.plans[0];
    }
    
    // Find a active plan that encompasses the current dateKey
    const addDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() + days);
      const z = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
      return z.toISOString().split('T')[0];
    };

    const plan = settings.plans.find(p => dateKey >= p.startDate && dateKey <= addDays(p.startDate, p.durationDays));
    if (plan) return plan;
    
    return {
      ...settings.plans[0],
      id: 'fallback-off-season',
      name: 'Off-Season',
      subjects: []
    } as Plan;
  }, [settings.plans, dateKey]);

  const currentMonthConfig = activePlan; // Alias for backward compatibility with UI renders

  const updateActivePlan = (updates: Partial<Plan>) => {
    setSettings(prev => {
       const newPlans = [...(prev.plans || [])];
       const idx = newPlans.findIndex(p => p.id === activePlan.id);
       if (idx >= 0) {
          newPlans[idx] = { ...newPlans[idx], ...updates };
       } else {
          newPlans.push({ ...INITIAL_SETTINGS.plans[0], ...updates, id: `plan-${Date.now()}` });
       }
       return { ...prev, plans: newPlans };
    });
  };

  const tasksMeta = useMemo(() => {
    const override = settings.dailyOverrides?.[dateKey];
    if (override?.isOffDay) return [];
    if (override?.tasks) return override.tasks;

    const meta: Task[] = [];
    
    const defaults = INITIAL_SETTINGS.plans[0]!;
    const mr = activePlan.morningRoutine || defaults.morningRoutine!;
    const lr = activePlan.lifeRoutine || defaults.lifeRoutine!;
    const er = activePlan.eveningRoutine || defaults.eveningRoutine!;

    mr.forEach(r => meta.push({ id: r.id, group: 'Morning', title: r.title, hours: r.duration / 60 }));

    if (dailySessions[dateKey]) {
      dailySessions[dateKey].forEach(session => {
        const sub = activePlan.subjects.find(s => s.id === session.subjectId);
        meta.push({
          id: session.id,
          group: sub ? sub.title : 'Custom',
          title: session.title,
          hours: session.duration / 60,
          subjectId: session.subjectId
        });
      });
    } else {
      activePlan.subjects.forEach(sub => {
        const blockH = sub.blockDuration / 60;
        const blocks = Math.ceil(sub.targetHours / blockH);
        let cursorTime = sub.startTime;

        for (let i = 1; i <= blocks; i++) {
          let endTime = addMinutes(cursorTime, sub.blockDuration);
          meta.push({
            id: `${sub.id}-${i}`,
            group: sub.title,
            title: `${cursorTime} - ${endTime}`,
            hours: blockH,
            subjectId: sub.id
          });
          cursorTime = addMinutes(endTime, sub.breakDuration);
        }
      });
    }

    lr.forEach(r => meta.push({ id: r.id, group: 'Life', title: r.title, hours: r.duration / 60 }));
    er.forEach(r => meta.push({ id: r.id, group: 'Final', title: r.title, hours: r.duration / 60 }));

    return meta;
  }, [activePlan, dateKey, settings.dailyOverrides, dailySessions]);

  const completedTasks = db[dateKey] || [];
  const progress = Math.round((completedTasks.length / tasksMeta.length) * 100) || 0;

  const streak = useMemo(() => {
    let s = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    // If today is not done, start checking from yesterday
    const todayKey = getDKey(checkDate);
    const todayYM = getYMKey(todayKey);
    const todayConf = settings.monthlyConfig[todayYM] || Object.values(settings.monthlyConfig)[0];
    const todayExpected = 4 + todayConf.subjects.reduce((acc, s) => acc + Math.ceil(s.targetHours / (s.blockDuration / 60)), 0);

    if ((db[todayKey] || []).length < todayExpected) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dKey = getDKey(checkDate);
      if (dKey < settings.startDate) break;

      const ym = getYMKey(dKey);
      const conf = settings.monthlyConfig[ym] || Object.values(settings.monthlyConfig)[0];
      const expected = 4 + conf.subjects.reduce((acc, s) => acc + Math.ceil(s.targetHours / (s.blockDuration / 60)), 0);

      if ((db[dKey] || []).length >= expected) {
        s++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return s;
  }, [db, settings.startDate, settings.monthlyConfig]);

  const currentRank = useMemo(() => {
    return [...RANKS].reverse().find(r => settings.xp >= r.threshold) || RANKS[0];
  }, [settings.xp]);

  // --- Handlers ---
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleTask = (id: string, forceComplete = false) => {
    const isDone = completedTasks.includes(id);
    const task = tasksMeta.find(t => t.id === id);

    if (forceComplete && isDone) return; // Already completed, do nothing

    const newCompleted = isDone 
      ? completedTasks.filter(t => t !== id)
      : [...completedTasks, id];

    setDb(prev => ({ ...prev, [dateKey]: newCompleted }));

    if (!isDone) {
      const xpGain = task?.subjectId ? 50 : 20;
      setSettings(prev => ({ ...prev, xp: prev.xp + xpGain }));
      
      const expected = tasksMeta.length;
      if (newCompleted.length === expected) {
        setSettings(prev => ({ ...prev, xp: prev.xp + 500 }));
        showToast('Golden Day! +500 XP', 'success');
      }
    } else {
      const xpLoss = task?.subjectId ? 50 : 20;
      setSettings(prev => ({ ...prev, xp: Math.max(0, prev.xp - xpLoss) }));
    }
  };

  const changeDate = (days: number) => {
    if (days === 0) setCurrentDate(new Date());
    else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + days);
      setCurrentDate(next);
    }
  };

  const handleAddSession = () => {
    if (!newSession.title.trim()) return;
    
    setDailySessions(prev => {
      const current = prev[dateKey];
      let newSessions: DailySession[] = [];
      
      if (!current) {
        // Initialize with default blocks if empty
        const baseSessions: DailySession[] = [];
        currentMonthConfig.subjects.forEach(sub => {
          const blockH = sub.blockDuration / 60;
          const blocks = Math.ceil(sub.targetHours / blockH);
          let cursorTime = sub.startTime;
          for (let i = 1; i <= blocks; i++) {
            let endTime = addMinutes(cursorTime, sub.blockDuration);
            baseSessions.push({
              id: `${sub.id}-${i}`,
              title: `${cursorTime} - ${endTime}`,
              subjectId: sub.id,
              duration: sub.blockDuration
            });
            cursorTime = addMinutes(endTime, sub.breakDuration);
          }
        });
        newSessions = [...baseSessions];
      } else {
        newSessions = [...current];
      }

      newSessions.push({
        id: `custom-${Date.now()}`,
        title: newSession.title,
        subjectId: newSession.subjectId,
        duration: newSession.duration
      });

      return { ...prev, [dateKey]: newSessions };
    });
    
    setIsAddSessionOpen(false);
    setNewSession({ title: '', duration: 30 });
    showToast('Task added!', 'success');
  };

  const handleDeleteSession = (id: string) => {
    setDailySessions(prev => {
      const current = prev[dateKey];
      let newSessions: DailySession[] = [];
      
      if (!current) {
        // Initialize with default blocks if empty, then remove the target
        const baseSessions: DailySession[] = [];
        currentMonthConfig.subjects.forEach(sub => {
          const blockH = sub.blockDuration / 60;
          const blocks = Math.ceil(sub.targetHours / blockH);
          let cursorTime = sub.startTime;
          for (let i = 1; i <= blocks; i++) {
            let endTime = addMinutes(cursorTime, sub.blockDuration);
            baseSessions.push({
              id: `${sub.id}-${i}`,
              title: `${cursorTime} - ${endTime}`,
              subjectId: sub.id,
              duration: sub.blockDuration
            });
            cursorTime = addMinutes(endTime, sub.breakDuration);
          }
        });
        newSessions = baseSessions.filter(s => s.id !== id);
      } else {
        newSessions = current.filter(s => s.id !== id);
      }

      return { ...prev, [dateKey]: newSessions };
    });
    
    // Remove from completed if it was done
    if (completedTasks.includes(id)) {
      setDb(prev => ({ ...prev, [dateKey]: prev[dateKey].filter(t => t !== id) }));
    }
  };

  // --- Timer Logic ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && timerRunning) {
      if (settings.timerSoundEnabled) playChime();
      
      const isPomoSession = activeTask?.id.startsWith('pomo-');

      if (timerMode === 'study') {
        if (activeTask) toggleTask(activeTask.id, true);
        
        if (isPomoSession) {
          const isFinalRound = currentPomoRound >= pomoConfig.rounds;
          const isLongBreak = currentPomoRound % 4 === 0; // Standard pomodoro long break every 4 rounds
          
          setTimerMode('break');
          const breakDur = isLongBreak ? pomoConfig.longBreakTime : pomoConfig.breakTime;
          setTimeLeft(breakDur * 60);
          
          // Save to history
          setPomoHistory(prev => [{
            id: Date.now().toString(),
            title: pomoConfig.sessionTitle,
            date: dateKey,
            duration: pomoConfig.focusTime
          }, ...prev].slice(0, 50));

          showToast(`Round ${currentPomoRound} Complete! ${isLongBreak ? 'Time for a Long Break.' : 'Take a short break.'}`, 'success');
          
          if (!pomoConfig.autoStartBreaks) {
            setTimerRunning(false);
          }
        } else {
          setTimerMode('break');
          const sub = currentMonthConfig.subjects.find(s => s.id === activeTask?.subjectId);
          setTimeLeft((sub?.breakDuration || 5) * 60);
          showToast('Focus Session Complete! Time for a break.', 'success');
        }
      } else {
        // Break is over
        if (isPomoSession) {
          const nextRound = currentPomoRound + 1;
          const isComplete = currentPomoRound >= pomoConfig.rounds;

          if (isComplete) {
            setTimerRunning(false);
            setIsTimerOpen(false);
            setIsZenMode(false);
            setCurrentPomoRound(1);
            showToast('Full Pomodoro Set Complete! Great work.', 'success');
          } else {
            setCurrentPomoRound(nextRound);
            setTimerMode('study');
            setTimeLeft(pomoConfig.focusTime * 60);
            setActiveTask(prev => prev ? { 
              ...prev, 
              id: `pomo-${Date.now()}`,
              title: `${pomoConfig.sessionTitle} - Round ${nextRound}` 
            } : null);
            
            if (!pomoConfig.autoStartRounds) {
              setTimerRunning(false);
            }
            showToast(`Break over. Starting Round ${nextRound}!`, 'info');
          }
        } else {
          setTimerRunning(false);
          setIsTimerOpen(false);
          showToast('Break Over. Ready for the next session?', 'info');
        }
      }
    }
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft, timerMode, activeTask, settings.timerSoundEnabled, pomoConfig, currentPomoRound]);

  // --- Confetti & Badges Logic ---
  useEffect(() => {
    if (settings.xp > prevXpRef.current) {
      const oldRank = RANKS.slice().reverse().find(r => prevXpRef.current >= r.threshold);
      const newRank = RANKS.slice().reverse().find(r => settings.xp >= r.threshold);
      
      if (oldRank && newRank && oldRank.name !== newRank.name) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f97316', '#10b981', '#3b82f6', '#8b5cf6']
        });
        showToast(`Rank Up! You are now a ${newRank.name}`, 'success');
      }
      prevXpRef.current = settings.xp;
    }
  }, [settings.xp]);

  useEffect(() => {
    // Check badges
    const newBadges = new Set(settings.unlockedBadges);
    let unlockedAny = false;

    // First Step
    if ((Object.values(db) as string[][]).some(tasks => tasks.length > 0) && !newBadges.has('first_step')) {
      newBadges.add('first_step');
      unlockedAny = true;
    }

    // Streaks
    let currentStreak = 0;
    const start = new Date(settings.startDate);
    const today = new Date();
    for (let d = new Date(today); d >= start; d.setDate(d.getDate() - 1)) {
      if (db[getDKey(d)]?.length > 0) currentStreak++;
      else if (getDKey(d) !== getDKey(today)) break;
    }

    if (currentStreak >= 3 && !newBadges.has('streak_3')) { newBadges.add('streak_3'); unlockedAny = true; }
    if (currentStreak >= 7 && !newBadges.has('streak_7')) { newBadges.add('streak_7'); unlockedAny = true; }

    // Hours
    let totalHours = 0;
    (Object.entries(db) as [string, string[]][]).forEach(([k, tasks]) => {
      const ym = getYMKey(k);
      const conf = settings.monthlyConfig[ym] || Object.values(settings.monthlyConfig)[0];
      tasks.forEach(id => {
        const fixedTask = tasksMeta.find(t => t.id === id);
        if (fixedTask && !fixedTask.subjectId) totalHours += fixedTask.hours;
        else {
          const subId = id.split('-')[0];
          const sub = conf.subjects.find(s => s.id === subId);
          if (sub) totalHours += (sub.blockDuration / 60);
        }
      });
    });

    if (totalHours >= 10 && !newBadges.has('hours_10')) { newBadges.add('hours_10'); unlockedAny = true; }
    if (totalHours >= 50 && !newBadges.has('hours_50')) { newBadges.add('hours_50'); unlockedAny = true; }

    // Golden Day
    if ((Object.values(db) as string[][]).some(tasks => tasks.length >= tasksMeta.length) && !newBadges.has('golden_day')) {
      newBadges.add('golden_day');
      unlockedAny = true;
    }

    if (unlockedAny) {
      setSettings(prev => ({ ...prev, unlockedBadges: Array.from(newBadges) }));
      showToast('New Badge Unlocked!', 'success');
    }
  }, [db, settings.startDate, settings.monthlyConfig, settings.unlockedBadges, tasksMeta]);

  // --- Diagnostics Check ---
  // (Removed per user request to stop 'Friction Detected' popup on startup)

  // --- Data Backup & Restore ---
  const handleExportData = async () => {
    try {
      const dataToExport = {
        settings,
        db,
        diagnostics,
        dailySessions
      };
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `focus-sync-backup-${new Date().toISOString().slice(0, 10)}.json`,
            types: [{
              description: 'JSON File',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          showToast('Backup saved to PC successfully!', 'success');
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') showToast('Failed to save to PC', 'error');
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focus-sync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export data!', 'error');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.settings) setSettings(importedData.settings);
        if (importedData.db) setDb(importedData.db);
        if (importedData.diagnostics) setDiagnostics(importedData.diagnostics);
        if (importedData.dailySessions) setDailySessions(importedData.dailySessions);
        showToast('Backup imported successfully! Data restored.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Invalid backup file formatting!', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveDiagnostic = async (reason: string) => {
    setDiagnostics(prev => ({ ...prev, [diagDate]: reason }));
    setIsDiagOpen(false);
    showToast('Diagnostic Recorded');
    
    // Get AI Advice
    const advice = await getProductivityAdvice(reason, progress);
    setAiAdvice(advice);
  };

  // --- Chart Data ---
  const trendData = useMemo(() => {
    const labels = [];
    const data = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = getDKey(d);
      const ym = getYMKey(k);
      const conf = settings.monthlyConfig[ym] || Object.values(settings.monthlyConfig)[0];
      
      labels.push(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
      
      let dayH = 0;
      (db[k] || []).forEach(id => {
        if (id === 'F1') dayH += 0.5;
        const subId = id.split('-')[0];
        const sub = conf.subjects.find(s => s.id === subId);
        if (sub) dayH += (sub.blockDuration / 60);
      });
      data.push(dayH);
    }
    return { labels, data };
  }, [db, settings.monthlyConfig]);

  const distributionData = useMemo(() => {
    const hours: Record<string, number> = {};
    Object.entries(db).forEach(([k, tasks]) => {
      if (k.includes('_diag')) return;
      const ym = getYMKey(k);
      const conf = settings.monthlyConfig[ym] || Object.values(settings.monthlyConfig)[0];
      (tasks as string[]).forEach(id => {
        if (id === 'F1') hours['Review'] = (hours['Review'] || 0) + 0.5;
        const subId = id.split('-')[0];
        const sub = conf.subjects.find(s => s.id === subId);
        if (sub) hours[sub.title] = (hours[sub.title] || 0) + (sub.blockDuration / 60);
      });
    });
    return hours;
  }, [db, settings.monthlyConfig]);

  const streakData = useMemo(() => {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const start = new Date(settings.startDate);
    const today = new Date();
    
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const k = getDKey(d);
      if (db[k] && db[k].length > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    
    for (let d = new Date(today); d >= start; d.setDate(d.getDate() - 1)) {
      const k = getDKey(d);
      if (db[k] && db[k].length > 0) {
        currentStreak++;
      } else if (k !== getDKey(today)) {
        break;
      }
    }

    return { currentStreak, longestStreak };
  }, [db, settings.startDate]);

  const bestDayOfWeek = useMemo(() => {
    const dayHours = [0, 0, 0, 0, 0, 0, 0];
    
    Object.entries(db).forEach(([k, tasks]) => {
      if (k.includes('_diag')) return;
      const d = new Date(`${k}T12:00:00`);
      const day = d.getDay();
      dayHours[day] += (tasks as string[]).length;
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = 0;
    let max = 0;
    for (let i = 0; i < 7; i++) {
      if (dayHours[i] > max) {
        max = dayHours[i];
        bestDay = i;
      }
    }
    return max > 0 ? days[bestDay] : 'N/A';
  }, [db]);

  const dailyHours = useMemo(() => {
    let todayHours = 0;
    let yesterdayHours = 0;

    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = getDKey(yesterday);

    const calculateHours = (key: string, tasks: string[]) => {
      let h = 0;
      const ym = getYMKey(key);
      const conf = settings.monthlyConfig[ym] || Object.values(settings.monthlyConfig)[0];
      
      tasks.forEach(id => {
        // Check fixed tasks first
        const fixedTask = tasksMeta.find(t => t.id === id);
        if (fixedTask && !fixedTask.subjectId) {
          h += fixedTask.hours;
          return;
        }

        // Check custom daily sessions
        if (dailySessions[key]) {
          const customSession = dailySessions[key].find(s => s.id === id);
          if (customSession) {
            h += customSession.duration / 60;
            return;
          }
        }

        // Check default subject blocks
        const subId = id.split('-')[0];
        const sub = conf.subjects.find(s => s.id === subId);
        if (sub) h += (sub.blockDuration / 60);
      });
      return h;
    };

    todayHours = calculateHours(dateKey, completedTasks);
    yesterdayHours = calculateHours(yKey, db[yKey] || []);

    return { today: todayHours, yesterday: yesterdayHours };
  }, [completedTasks, db, dateKey, currentDate, settings.monthlyConfig, dailySessions, tasksMeta]);

  const taskTypeData = useMemo(() => {
    const counts: Record<string, number> = {
      'Morning Protocol': 0,
      'Deep Work': 0,
      'Life & Maintenance': 0,
      'Evening Wind-down': 0
    };
    
    Object.entries(db).forEach(([k, tasks]) => {
      if (k.includes('_diag')) return;
      (tasks as string[]).forEach(id => {
        const fixedTask = tasksMeta.find(t => t.id === id);
        if (fixedTask) {
          if (fixedTask.group === 'Morning') counts['Morning Protocol']++;
          else if (fixedTask.group === 'Life') counts['Life & Maintenance']++;
          else if (fixedTask.group === 'Final') counts['Evening Wind-down']++;
          else counts['Deep Work']++;
        } else {
          // Custom sessions or default blocks are Deep Work
          counts['Deep Work']++;
        }
      });
    });
    return counts;
  }, [db, tasksMeta]);

  const weeklyComparisonData = useMemo(() => {
    const thisWeek = [0, 0, 0, 0, 0, 0, 0];
    const lastWeek = [0, 0, 0, 0, 0, 0, 0];
    const labels = [];
    
    const today = new Date();
    
    // Generate labels and this week's data
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      
      const k = getDKey(d);
      thisWeek[6 - i] = (db[k] || []).length;
    }
    
    // Generate last week's data
    for (let i = 13; i >= 7; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = getDKey(d);
      lastWeek[13 - i] = (db[k] || []).length;
    }
    
    return { labels, thisWeek, lastWeek };
  }, [db]);

  const dateLabel = useMemo(() => {
    const today = new Date();
    const isToday = getDKey(currentDate) === getDKey(today);
    if (isToday) return "TODAY";
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (getDKey(currentDate) === getDKey(yesterday)) return "YESTERDAY";
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (getDKey(currentDate) === getDKey(tomorrow)) return "TOMORROW";

    return currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  }, [currentDate]);

  if (isMiniMode) {
    const nextTask = tasksMeta.find(t => !db[dateKey]?.includes(t.id));
    return (
      <div className={cn("min-h-screen font-sans p-4 transition-colors duration-500 flex flex-col justify-center items-center select-none", THEMES[settings.theme ? settings.theme : 'tokyo_night']?.className || THEMES['tokyo_night'].className, settings.isDarkMode ? "dark bg-slate-950" : "bg-brand-50")}>
        <div className="absolute top-2 right-2 flex gap-2">
           <button onClick={() => setIsMiniMode(false)} className="p-2 text-slate-400 hover:text-brand-500 bg-black/5 dark:bg-white/10 rounded-full transition-colors">
              <Maximize2 className="w-4 h-4" />
           </button>
        </div>
        <div className="text-center w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-brand-200 dark:border-slate-700 p-6 rounded-3xl shadow-2xl">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">FokeS Mini</h2>
          {nextTask ? (
            <>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">{nextTask.title}</p>
              <p className="text-xs font-semibold text-slate-400 mb-6">{nextTask.group} • {Math.round(nextTask.hours * 60)}m</p>
              <button 
                onClick={() => {
                  setIsMiniMode(false);
                  setActiveTask(nextTask);
                  setTimerMode(nextTask.group === 'Life' ? 'break' : 'study');
                  setTimeLeft(nextTask.hours * 60 * 60);
                  setIsTimerOpen(true);
                  setIsZenMode(true);
                }}
                className="w-full bg-brand-500 text-white font-bold py-3 rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/30"
              >
                Start Timer Fullscreen
              </button>
            </>
          ) : (
            <div className="py-6">
              <div className="flex justify-center mb-2"><Check className="w-8 h-8 text-emerald-500" /></div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">All done!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 h-screen flex overflow-hidden transition-colors duration-300 font-sans">
      {/* Navigation */}
      <nav className="fixed bottom-0 w-full md:relative md:w-24 lg:w-64 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 z-50 flex md:flex-col justify-around md:justify-start p-3 md:p-6 pb-safe transition-colors duration-300">
        <div className="hidden md:flex items-center gap-4 mb-10 text-brand-500 dark:text-brand-400">
          <FokesLogo className="w-10 h-10 lg:w-12 lg:h-12 transition-colors duration-300" />
          <span className="font-extrabold text-2xl tracking-tight hidden lg:block text-slate-900 dark:text-white">FokeS</span>
        </div>
        
        <div className="flex md:flex-col gap-2 w-full">
          <NavButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')} icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
          <NavButton active={activeTab === 'pomodoro'} onClick={() => setActiveTab('pomodoro')} icon={<Timer className="w-5 h-5" />} label="Pomodoro" />
          <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarDays className="w-5 h-5" />} label="Roadmap" />
          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Activity className="w-5 h-5" />} label="Analytics" />
        </div>

        <div className="hidden md:flex flex-col mt-auto w-full gap-3">
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-slate-800 font-semibold transition-all border border-brand-200 dark:border-slate-700">
            <Settings className="w-5 h-5" />
            <span className="hidden lg:block">Settings</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-8 max-w-6xl mx-auto w-full">
          <div>
            <p className="text-sm font-bold text-brand-600 dark:text-brand-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {settings.dailyOverrides?.[dateKey] && (
                <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded text-[10px] tracking-normal">
                  Custom Plan
                </span>
              )}
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {activeTab === 'daily' ? 'Daily Execution' : activeTab === 'pomodoro' ? 'Pomodoro Engine' : activeTab === 'calendar' ? 'Monthly Roadmaps' : 'Performance Analytics'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
            <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-md">
              <select 
                value={THEMES[settings.theme] ? settings.theme : 'tokyo_night'} 
                onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value as ThemeType }))}
                className="bg-transparent text-xs font-bold text-brand-900 dark:text-white outline-none cursor-pointer appearance-none pr-1"
              >
                <option value="cyberpunk">Cyberpunk</option>
                <option value="dracula">Dracula</option>
                <option value="nord">Nord</option>
                <option value="monochrome">Monochrome</option>
                <option value="synthwave">Synthwave</option>
                <option value="cafe">Cafe</option>
                <option value="tokyo_night">Tokyo Night</option>
                <option value="monokai">Monokai</option>
                <option value="gruvbox">Gruvbox</option>
                <option value="github_theme">GitHub</option>
                <option value="one_dark">One Dark</option>
                <option value="pumpy">Pumpy Brutalist</option>
                <option value="autumn">Autumn</option>
              </select>
              <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
              <button onClick={() => setSettings(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }))} className="text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center justify-center">
                {settings.isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-full p-1 border border-brand-100 dark:border-slate-700 shadow-sm transition-colors">
              <button onClick={() => changeDate(-1)} className="p-2 hover:bg-brand-50 dark:hover:bg-slate-700 rounded-full transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => changeDate(0)} className="px-3 text-xs font-bold text-brand-900 dark:text-slate-300 min-w-[80px] text-center">{dateLabel}</button>
              <button onClick={() => changeDate(1)} className="p-2 hover:bg-brand-50 dark:hover:bg-slate-700 rounded-full transition-colors"><ChevronRight className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
              <button 
                onClick={() => {
                  setEditDayDraft([...tasksMeta]);
                  setCustomIsOffDay(!!settings.dailyOverrides?.[dateKey]?.isOffDay);
                  setIsEditDayOpen(true);
                }}
                className="px-3 py-2 text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-full transition-colors flex items-center gap-1"
              >
                <Settings className="w-3 h-3" /> Edit Day
              </button>
            </div>
            <div className="bg-white/60 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm backdrop-blur-md">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">{streak} Streak</span>
            </div>
            <button 
              onClick={() => setIsMiniMode(true)}
              className="bg-white/60 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700 p-2.5 rounded-full hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 transition-colors shadow-sm backdrop-blur-md"
              title="Mini Player"
            >
              <Minimize2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'daily' && (
            <motion.div 
              key="daily"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6"
            >
              <div className="xl:col-span-2 space-y-6">
                {aiAdvice && (
                  <section className="bg-brand-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><BrainCircuit className="w-24 h-24" /></div>
                    <h3 className="font-bold mb-2 flex items-center gap-2"><Info className="w-5 h-5" /> AI Productivity Insight</h3>
                    <div className="text-sm font-medium leading-relaxed whitespace-pre-line">{aiAdvice}</div>
                    <button onClick={() => setAiAdvice(null)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                  </section>
                )}

                {tasksMeta.length === 0 ? (
                  <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-12 text-center rounded-3xl shadow-sm backdrop-blur-md">
                    <div className="flex justify-center mb-4"><span className="text-4xl" role="img" aria-label="island">🏝️</span></div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Off Day</h3>
                    <p className="text-sm text-slate-500">Enjoy your rest. If you want to set tasks, click "Edit Day" above.</p>
                  </section>
                ) : (
                  <>
                    <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm backdrop-blur-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sunrise className="w-5 h-5 text-brand-500" />
                          <h3 className="font-bold text-slate-900 dark:text-white">Morning Protocol</h3>
                        </div>
                        <div className="flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
                          <button onClick={() => setConfigEditorOpen('morningRoutine')} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500 px-2 py-1 rounded">Edit Template</button>
                          <button onClick={() => { setEditDayDraft(tasksMeta); setCustomIsOffDay(false); setIsEditDayOpen(true); }} className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors px-2 py-1 rounded">Edit Today</button>
                        </div>
                      </div>
                      {(() => {
                    const groupTasks = tasksMeta.filter(t => t.group === 'Morning');
                    const doneCount = groupTasks.filter(t => completedTasks.includes(t.id)).length;
                    const progress = Math.round((doneCount / groupTasks.length) * 100);
                    return (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progress</span>
                          <span className="text-xs font-bold text-slate-400">{doneCount}/{groupTasks.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-4 overflow-hidden">
                          <div className="h-full transition-all duration-500 bg-brand-500" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {groupTasks.map(t => (
                            <TaskBlock key={t.id} task={t as Task} isDone={completedTasks.includes(t.id)} onToggle={() => toggleTask(t.id)} />
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </section>

                <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-brand-600 dark:text-brand-500" />
                      <h3 className="font-bold text-slate-900 dark:text-white">Deep Work Sessions</h3>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setActiveTab('calendar')}
                        className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 uppercase tracking-wider"
                      >
                        <Settings2 className="w-3 h-3" /> Edit Template
                      </button>
                      <button 
                        onClick={() => setIsBacklogOpen(!isBacklogOpen)}
                        className="text-xs font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors flex items-center gap-1"
                      >
                        <ListTodo className="w-3 h-3" /> Backlog ({settings.backlog.length})
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isBacklogOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-6"
                      >
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Task Backlog</h4>
                          {settings.backlog.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No tasks in backlog right now.</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {settings.backlog.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                  <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{item.title}</p>
                                    <p className="text-xs text-slate-500">{item.duration} min</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        // Move to today
                                        const newSession: DailySession = {
                                          id: `custom-${Date.now()}`,
                                          title: item.title,
                                          duration: item.duration,
                                          subjectId: item.subjectId
                                        };
                                        setDailySessions(prev => ({
                                          ...prev,
                                          [dateKey]: [...(prev[dateKey] || []), newSession]
                                        }));
                                        // Remove from backlog
                                        setSettings(prev => ({
                                          ...prev,
                                          backlog: prev.backlog.filter(b => b.id !== item.id)
                                        }));
                                        showToast('Moved to today!', 'success');
                                      }}
                                      className="p-2 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors"
                                      title="Add to Today"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSettings(prev => ({
                                          ...prev,
                                          backlog: prev.backlog.filter(b => b.id !== item.id)
                                        }));
                                      }}
                                      className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Delete"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-6">
                    {currentMonthConfig.subjects.map(sub => {
                      const subTasks = tasksMeta.filter(t => t.subjectId === sub.id);
                      if (subTasks.length === 0) return null;
                      
                      const doneCount = subTasks.filter(t => completedTasks.includes(t.id)).length;
                      const subProgress = Math.round((doneCount / subTasks.length) * 100);
                      return (
                        <div key={sub.id}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{sub.title}</span>
                            <span className="text-xs font-bold text-slate-400">{doneCount}/{subTasks.length}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-3 overflow-hidden">
                            <div className={cn("h-full transition-all duration-500", sub.id === 'S1' ? 'bg-sub1' : sub.id === 'S2' ? 'bg-sub2' : sub.id === 'S3' ? 'bg-sub3' : 'bg-brand-500')} style={{ width: `${subProgress}%` }}></div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            {subTasks.map(t => (
                              <TaskBlock 
                                key={t.id} 
                                task={t as Task} 
                                isDone={completedTasks.includes(t.id)} 
                                onToggle={() => toggleTask(t.id)} 
                                subjectIndex={parseInt(sub.id.replace('S', ''))} 
                                onDelete={dailySessions[dateKey] ? () => handleDeleteSession(t.id) : undefined}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {currentMonthConfig.subjects.every(sub => tasksMeta.filter(t => t.subjectId === sub.id).length === 0) && (
                      <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No tasks scheduled for today.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <ListTodo className="w-5 h-5 text-brand-500" />
                      <h3 className="font-bold text-slate-900 dark:text-white">Daily Tasks</h3>
                    </div>
                    <button 
                      onClick={() => setIsAddSessionOpen(true)}
                      className="text-xs font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Task
                    </button>
                  </div>
                  
                  {(() => {
                    const customTasks = tasksMeta.filter(t => t.group === 'Custom');
                    if (customTasks.length === 0) {
                      return (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-2">No ad-hoc tasks for today.</p>
                          <span className="text-xs text-slate-400">Use "Add Task" for quick tasks like emails or calls.</span>
                        </div>
                      );
                    }
                    
                    const doneCount = customTasks.filter(t => completedTasks.includes(t.id)).length;
                    const subProgress = Math.round((doneCount / customTasks.length) * 100);
                    
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progress</span>
                          <span className="text-xs font-bold text-slate-400">{doneCount}/{customTasks.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-3 overflow-hidden">
                          <div className="h-full transition-all duration-500 bg-brand-500" style={{ width: `${subProgress}%` }}></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                          {customTasks.map(t => (
                            <TaskBlock 
                              key={t.id} 
                              task={t as Task} 
                              isDone={completedTasks.includes(t.id)} 
                              onToggle={() => toggleTask(t.id)} 
                              onDelete={dailySessions[dateKey] ? () => handleDeleteSession(t.id) : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Coffee className="w-5 h-5 text-brand-500" />
                        <h3 className="font-bold text-slate-900 dark:text-white">Life & Maintenance</h3>
                      </div>
                      <div className="flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
                        <button onClick={() => setConfigEditorOpen('lifeRoutine')} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500 px-2 py-1 rounded">Edit Template</button>
                        <button onClick={() => { setEditDayDraft(tasksMeta); setCustomIsOffDay(false); setIsEditDayOpen(true); }} className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors px-2 py-1 rounded">Edit Today</button>
                      </div>
                    </div>
                    {(() => {
                      const groupTasks = tasksMeta.filter(t => t.group === 'Life');
                      const doneCount = groupTasks.filter(t => completedTasks.includes(t.id)).length;
                      const progress = Math.round((doneCount / groupTasks.length) * 100);
                      return (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progress</span>
                            <span className="text-xs font-bold text-slate-400">{doneCount}/{groupTasks.length}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-4 overflow-hidden">
                            <div className="h-full transition-all duration-500 bg-brand-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {groupTasks.map(t => (
                              <TaskBlock key={t.id} task={t as Task} isDone={completedTasks.includes(t.id)} onToggle={() => toggleTask(t.id)} />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </section>
                  <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Moon className="w-5 h-5 text-brand-600" />
                        <h3 className="font-bold text-slate-900 dark:text-white">Evening Wind-down</h3>
                      </div>
                      <div className="flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
                        <button onClick={() => setConfigEditorOpen('eveningRoutine')} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500 px-2 py-1 rounded">Edit Template</button>
                        <button onClick={() => { setEditDayDraft(tasksMeta); setCustomIsOffDay(false); setIsEditDayOpen(true); }} className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors px-2 py-1 rounded">Edit Today</button>
                      </div>
                    </div>
                    {(() => {
                      const groupTasks = tasksMeta.filter(t => t.group === 'Final');
                      const doneCount = groupTasks.filter(t => completedTasks.includes(t.id)).length;
                      const progress = Math.round((doneCount / groupTasks.length) * 100);
                      return (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progress</span>
                            <span className="text-xs font-bold text-slate-400">{doneCount}/{groupTasks.length}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-4 overflow-hidden">
                            <div className="h-full transition-all duration-500 bg-brand-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {groupTasks.map(t => (
                              <TaskBlock key={t.id} task={t as Task} isDone={completedTasks.includes(t.id)} onToggle={() => toggleTask(t.id)} />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </section>
                </div>
                  </>
                )}

                {completedTasks.length > 0 && (
                  <button 
                    onClick={async () => {
                      setIsReflectionOpen(true);
                      setIsGenerating(true);
                      const reflection = await generateDailyReflection(completedTasks, dailyHours.today);
                      setReflectionText(reflection);
                      setIsGenerating(false);
                    }}
                    className="w-full py-4 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-bold border border-brand-100 dark:border-brand-800/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex justify-center items-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Complete Day & Get AI Reflection
                  </button>
                )}
              </div>

              <div className="space-y-6">
                <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden shadow-sm backdrop-blur-md">
                  <h3 className="font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest text-xs mb-6 w-full text-left">Daily Completion</h3>
                  <div className="relative flex items-center justify-center mb-6">
                    <svg width="200" height="200">
                      <circle className="text-brand-100 dark:text-slate-800" strokeWidth="12" stroke="currentColor" fill="transparent" r="88" cx="100" cy="100"/>
                      <motion.circle 
                        className="text-brand-500" 
                        strokeWidth="12" 
                        strokeDasharray="553" 
                        initial={{ strokeDashoffset: 553 }}
                        animate={{ strokeDashoffset: 553 - (553 * progress / 100) }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        strokeLinecap="round" 
                        stroke="currentColor" 
                        fill="transparent" 
                        r="88" cx="100" cy="100"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{progress}%</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{completedTasks.length} / {tasksMeta.length} Tasks</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-center mt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Rank</h4>
                    <div className={cn("text-xl font-black mb-1 transition-colors", currentRank.color)}>{currentRank.name}</div>
                    <div className="text-xs font-bold text-slate-400">{settings.xp} XP</div>
                  </div>

                  <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-center mt-4 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Hours</h4>
                      <div className="text-xl font-black text-slate-900 dark:text-white">{dailyHours.today.toFixed(1)}h</div>
                    </div>
                    <div className="text-right">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Yesterday</h4>
                      <div className="text-sm font-bold text-slate-400">{dailyHours.yesterday.toFixed(1)}h</div>
                      {dailyHours.today > dailyHours.yesterday && dailyHours.yesterday > 0 && (
                        <div className="text-[10px] font-bold text-emerald-500 mt-0.5">+{((dailyHours.today - dailyHours.yesterday) / dailyHours.yesterday * 100).toFixed(0)}%</div>
                      )}
                      {dailyHours.today < dailyHours.yesterday && dailyHours.yesterday > 0 && (
                        <div className="text-[10px] font-bold text-rose-500 mt-0.5">{((dailyHours.today - dailyHours.yesterday) / dailyHours.yesterday * 100).toFixed(0)}%</div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'pomodoro' && (
            <motion.div 
              key="pomodoro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm backdrop-blur-md">
                   <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="font-black text-2xl text-slate-900 dark:text-white mb-1">Custom Pomodoro</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Configuration</p>
                      </div>
                      <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-2xl">
                        <Timer className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                      </div>
                   </div>

                   <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Session Title</label>
                          <input 
                            type="text" 
                            value={pomoConfig.sessionTitle}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, sessionTitle: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                            placeholder="e.g. Deep Work, Reading, Coding"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Focus Subject</label>
                          <select 
                            value={pomoConfig.subjectId}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, subjectId: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none cursor-pointer hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                          >
                            <option value="">General Purpose</option>
                            {currentMonthConfig.subjects.map(s => (
                              <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Focus Min</label>
                          <input 
                            type="number" 
                            value={pomoConfig.focusTime}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, focusTime: parseInt(e.target.value) || 25 }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-center hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Short Break</label>
                          <input 
                            type="number" 
                            value={pomoConfig.breakTime}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, breakTime: parseInt(e.target.value) || 5 }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-center hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Long Break</label>
                          <input 
                            type="number" 
                            value={pomoConfig.longBreakTime}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, longBreakTime: parseInt(e.target.value) || 15 }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-center hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Rounds</label>
                          <input 
                            type="number" 
                            value={pomoConfig.rounds}
                            onChange={(e) => setPomoConfig(prev => ({ ...prev, rounds: parseInt(e.target.value) || 4 }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-center hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <div className="relative">
                             <input 
                               type="checkbox" 
                               checked={pomoConfig.autoStartBreaks}
                               onChange={(e) => setPomoConfig(prev => ({ ...prev, autoStartBreaks: e.target.checked }))}
                               className="sr-only p-check"
                             />
                             <div className={cn("w-10 h-6 rounded-full transition-colors", pomoConfig.autoStartBreaks ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                             <div className={cn("absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm", pomoConfig.autoStartBreaks ? "translate-x-4" : "translate-x-0")}></div>
                           </div>
                           <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-brand-500 transition-colors uppercase tracking-widest">Auto Breaks</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <div className="relative">
                             <input 
                               type="checkbox" 
                               checked={pomoConfig.autoStartRounds}
                               onChange={(e) => setPomoConfig(prev => ({ ...prev, autoStartRounds: e.target.checked }))}
                               className="sr-only p-check"
                             />
                             <div className={cn("w-10 h-6 rounded-full transition-colors", pomoConfig.autoStartRounds ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                             <div className={cn("absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm", pomoConfig.autoStartRounds ? "translate-x-4" : "translate-x-0")}></div>
                           </div>
                           <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-brand-500 transition-colors uppercase tracking-widest">Auto Rounds</span>
                        </label>
                      </div>

                      <button 
                        onClick={startPomoSession}
                        className="w-full mt-8 py-5 rounded-[1.5rem] bg-brand-600 text-white font-black text-lg shadow-xl shadow-brand-500/30 hover:bg-brand-500 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center justify-center gap-3"
                      >
                        <Rocket className="w-6 h-6" />
                        Engage Pomodoro
                      </button>
                   </div>
                </section>

                <section className="space-y-6">
                  <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm backdrop-blur-md w-full">
                     <div className="flex items-center justify-between mb-6">
                        <div>
                           <h3 className="font-black text-2xl text-slate-900 dark:text-white mb-1">Recent Sessions</h3>
                           <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">History</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <button onClick={() => setPomoHistory([])} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest">Clear</button>
                           <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-2xl">
                             <History className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                           </div>
                        </div>
                     </div>

                     <div className="space-y-3 overflow-y-auto pr-2 pb-2">
                        {pomoHistory.length === 0 ? (
                          <div className="py-12 text-center">
                             <Sparkles className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                             <p className="text-sm font-bold text-slate-400">History is empty.</p>
                          </div>
                        ) : (
                          pomoHistory.map((h, i) => (
                            <div key={h.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group hover:border-brand-300 transition-all">
                               <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{h.title}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{h.date} • {h.duration}m</p>
                               </div>
                               <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Check className="w-4 h-4" />
                               </div>
                            </div>
                          ))
                        )}
                     </div>
                  </div>

                  <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm backdrop-blur-md w-full">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-black text-2xl text-slate-900 dark:text-white mb-1">Today's Focus</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Performance Metrics</p>
                      </div>
                      <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-2xl">
                         <TargetIcon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
                         <div className="flex items-center gap-2 mb-2">
                           <Timer className="w-4 h-4 text-brand-500" />
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Focus Time</p>
                         </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black text-slate-900 dark:text-white">{pomoHistory.filter(h => h.date === dateKey).reduce((sum, h) => sum + h.duration, 0)}</p>
                          <span className="text-xs font-bold text-slate-500">min</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                           <ListTodo className="w-4 h-4 text-brand-500" />
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessions</p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black text-slate-900 dark:text-white">{pomoHistory.filter(h => h.date === dateKey).length}</p>
                          <span className="text-xs font-bold text-slate-500">completed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
          {activeTab === 'calendar' && (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-7xl mx-auto"
            >
              <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 md:p-10 rounded-[2.5rem] shadow-sm backdrop-blur-md">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Monthly Roadmaps</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={openConfig}
                      className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                    >
                      <Settings2 className="w-4 h-4" />
                      Configure Program
                    </button>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <button onClick={() => {
                        if (calendarQuarter === 0) {
                          setCalendarQuarter(3);
                          setCalendarYear(y => y - 1);
                        } else {
                          setCalendarQuarter(q => q - 1);
                        }
                      }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-600 dark:text-slate-300"><ChevronLeft className="w-5 h-5" /></button>
                      <span className="text-xl font-black text-brand-600 dark:text-brand-400 min-w-[140px] text-center">
                        Q{calendarQuarter + 1} &nbsp;{calendarYear}
                      </span>
                      <button onClick={() => {
                        if (calendarQuarter === 3) {
                          setCalendarQuarter(0);
                          setCalendarYear(y => y + 1);
                        } else {
                          setCalendarQuarter(q => q + 1);
                        }
                      }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-600 dark:text-slate-300"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const monthIndex = (calendarQuarter * 3) + i;
                    const monthStr = (monthIndex + 1).toString().padStart(2, '0');
                    return (
                      <CalendarMonth 
                        key={`${calendarYear}-${monthStr}`}
                        monthKey={`${calendarYear}-${monthStr}`} 
                        db={db} 
                        settings={settings} 
                        dailySessions={dailySessions}
                        onDateClick={(d) => { setCurrentDate(d); setActiveTab('daily'); }} 
                      />
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <StatCard label="Total Input" value={`${(Object.values(db) as string[][]).flat().length * 0.5}h`} />
                <StatCard label="Golden Days" value={(Object.values(db) as string[][]).filter(tasks => tasks.length >= tasksMeta.length).length.toString()} />
                <StatCard label="Current Streak" value={`${streakData.currentStreak} Days`} />
                <StatCard label="Longest Streak" value={`${streakData.longestStreak} Days`} />
              </div>

              <ContributionGraph db={db} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md flex flex-col justify-center items-center text-center">
                  <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest mb-2">Best Day of Week</h3>
                  <div className="text-4xl font-black text-brand-600 dark:text-brand-500">{bestDayOfWeek}</div>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md flex flex-col justify-center items-center text-center">
                  <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest mb-2">Avg. Efficiency</h3>
                  <div className="text-4xl font-black text-emerald-500">{Math.round((Object.values(db) as string[][]).reduce((acc, t) => acc + (t.length / tasksMeta.length), 0) / (Object.keys(db).length || 1) * 100)}%</div>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md flex flex-col justify-center items-center text-center">
                  <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest mb-2">Avg Hours/Day</h3>
                  <div className="text-4xl font-black text-brand-600 dark:text-brand-400">
                    {Object.keys(db).length > 0 
                      ? ((Object.values(db) as string[][]).reduce((acc, t) => {
                          const hours = t.reduce((sum, tid) => {
                            const taskObj = tasksMeta.find(meta => meta.id === tid);
                            return sum + (taskObj?.hours || 0);
                          }, 0);
                          return acc + hours;
                        }, 0) / Object.keys(db).length).toFixed(1) 
                      : '0.0'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider mb-6">Output Trend (Last 14 Days)</h3>
                  <div className="h-72 w-full">
                    <Line 
                      data={{
                        labels: trendData.labels,
                        datasets: [{
                          label: 'Hours',
                          data: trendData.data,
                          borderColor: THEMES[settings.theme]['--brand-500'],
                          backgroundColor: 'rgba(249, 115, 22, 0.1)',
                          fill: true,
                          tension: 0,
                          pointRadius: 6,
                          pointHoverRadius: 8,
                          pointBackgroundColor: THEMES[settings.theme]['--brand-500'],
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { 
                          y: { 
                            beginAtZero: true,
                            ticks: { color: settings.isDarkMode ? '#94a3b8' : '#64748b' },
                            grid: { color: settings.isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                          }, 
                          x: { 
                            ticks: { color: settings.isDarkMode ? '#94a3b8' : '#64748b' },
                            grid: { display: false } 
                          } 
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider mb-6">Weekly Comparison</h3>
                  <div className="h-72 w-full">
                    <Bar 
                      data={{
                        labels: weeklyComparisonData.labels,
                        datasets: [
                          {
                            label: 'This Week',
                            data: weeklyComparisonData.thisWeek,
                            backgroundColor: THEMES[settings.theme]['--brand-500'],
                            borderRadius: 4,
                          },
                          {
                            label: 'Last Week',
                            data: weeklyComparisonData.lastWeek,
                            backgroundColor: settings.isDarkMode ? '#334155' : '#cbd5e1',
                            borderRadius: 4,
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                          legend: { 
                            position: 'top', 
                            labels: { 
                              boxWidth: 10, 
                              usePointStyle: true,
                              color: settings.isDarkMode ? '#94a3b8' : '#475569'
                            } 
                          } 
                        },
                        scales: { 
                          y: { 
                            beginAtZero: true,
                            ticks: { color: settings.isDarkMode ? '#94a3b8' : '#64748b' },
                            grid: { color: settings.isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                          }, 
                          x: { 
                            ticks: { color: settings.isDarkMode ? '#94a3b8' : '#64748b' },
                            grid: { display: false } 
                          } 
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
                    <TargetIcon className="w-5 h-5 text-brand-500" /> Skill Trees
                  </h3>
                  <div className="h-64">
                    {Object.keys(distributionData).length > 0 ? (
                      <Radar 
                        data={{
                          labels: Object.keys(distributionData),
                          datasets: [{
                            label: 'Skill Level',
                            data: Object.values(distributionData).map((v) => Math.min(100, Math.round((v as number) * 2))), // scaling purely for fun display
                            backgroundColor: `${THEMES[settings.theme]?.['--brand-500']}40` || 'rgba(100,116,139,0.2)',
                            borderColor: THEMES[settings.theme]?.['--brand-500'] || '#64748b',
                            pointBackgroundColor: THEMES[settings.theme]?.['--brand-500'] || '#64748b',
                            pointBorderColor: '#fff',
                            borderWidth: 2,
                            fill: true,
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            r: {
                              angleLines: { color: settings.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                              grid: { color: settings.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                              pointLabels: {
                                color: settings.isDarkMode ? '#94a3b8' : '#475569',
                                font: { size: 10, family: "'JetBrains Mono', monospace", weight: 700 }
                              },
                              ticks: { display: false }
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Doughnut 
                          data={{
                            labels: ['No Data'],
                            datasets: [{
                              data: [1],
                              backgroundColor: [settings.isDarkMode ? '#1e293b' : '#f1f5f9'],
                              borderWidth: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { enabled: false } }
                          }}
                        />
                        <span className="absolute text-xs font-bold uppercase tracking-widest">No Data Yet</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider mb-6">Task Type Breakdown</h3>
                  <div className="h-64">
                    {(Object.values(taskTypeData) as number[]).some(v => v > 0) ? (
                      <Doughnut 
                        data={{
                          labels: Object.keys(taskTypeData),
                          datasets: [{
                            data: Object.values(taskTypeData),
                            backgroundColor: [
                              THEMES[settings.theme]?.['--brand-500'] || '#64748b',
                              THEMES[settings.theme]?.['--sub1'] || '#cbd5e1',
                              THEMES[settings.theme]?.['--sub2'] || '#94a3b8',
                              THEMES[settings.theme]?.['--sub3'] || '#475569',
                            ],
                            borderWidth: 1,
                            borderColor: settings.isDarkMode ? '#1e293b' : '#ffffff'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { 
                            legend: { 
                              position: 'bottom', 
                              labels: { 
                                boxWidth: 10, 
                                usePointStyle: true,
                                color: settings.isDarkMode ? '#94a3b8' : '#475569'
                              } 
                            } 
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 relative">
                        <Doughnut 
                          data={{
                            labels: ['No Data'],
                            datasets: [{
                              data: [1],
                              backgroundColor: [settings.isDarkMode ? '#1e293b' : '#f1f5f9'],
                              borderWidth: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { enabled: false } }
                          }}
                        />
                        <span className="absolute text-xs font-bold uppercase tracking-widest">No Data Yet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-brand-500" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Achievements & Badges</h3>
                  </div>
                  <button 
                    onClick={() => setIsBadgesExpanded(!isBadgesExpanded)}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5 rounded-full"
                  >
                    <span>{isBadgesExpanded ? 'Show Less' : 'Show All'}</span>
                    <ChevronRight className={cn("w-4 h-4 transition-transform", isBadgesExpanded ? "-rotate-90" : "rotate-90")} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[...BADGES]
                    .sort((a, b) => {
                      const aUn = settings.unlockedBadges.includes(a.id) ? 1 : 0;
                      const bUn = settings.unlockedBadges.includes(b.id) ? 1 : 0;
                      return bUn - aUn;
                    })
                    .slice(0, isBadgesExpanded ? BADGES.length : 6)
                    .map(badge => {
                    const isUnlocked = settings.unlockedBadges.includes(badge.id);
                    const IconComponent = {
                      CheckCircle, Flame, Activity, BrainCircuit, Sun,
                      Moon, Sunrise, CalendarDays, Sparkles, Zap, Target: TargetIcon,
                      Rocket, ListTodo, Lightbulb, Mountain, Shield, Compass,
                      Crown, Coffee, Music, Trophy, Star, Terminal, BookOpen, Settings2
                    }[badge.icon] || Award;

                    return (
                      <div key={badge.id} className={cn(
                        "flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300",
                        isUnlocked 
                          ? "bg-white dark:bg-slate-800 border-brand-200 dark:border-slate-700 shadow-sm" 
                          : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60 grayscale"
                      )}>
                        <div className={cn("p-3 rounded-full mb-3", isUnlocked ? "bg-brand-50 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800")}>
                          <IconComponent className={cn("w-6 h-6", isUnlocked ? badge.color : "text-slate-400")} />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{badge.name}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{badge.description}</p>
                      </div>
                    );
                  })}
                </div>
                
                {!isBadgesExpanded && (
                  <button 
                    onClick={() => setIsBadgesExpanded(true)}
                    className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[1rem] text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition-all flex items-center justify-center gap-2"
                  >
                    <span>View {BADGES.length - 6} More Badges</span>
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isReflectionOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Daily Debrief</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Your AI Coach's thoughts on today's performance.</p>
              
              {isGenerating ? (
                <div className="py-8 flex justify-center">
                  <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-left border border-slate-100 dark:border-slate-700">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">"{reflectionText}"</p>
                </div>
              )}

              <button 
                onClick={() => setIsReflectionOpen(false)}
                className="mt-8 w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {isTimerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[110] flex items-center justify-center px-4 transition-colors duration-500",
              isZenMode ? "bg-slate-950" : "bg-slate-900/80 backdrop-blur-md"
            )}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn(
                "border p-10 rounded-[3rem] w-full max-w-md shadow-2xl flex flex-col items-center transition-all duration-500",
                isZenMode 
                  ? "bg-slate-950 border-slate-900 text-white scale-110" 
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              )}
            >
              <div className="w-full flex justify-between items-center mb-8">
                <button 
                  onClick={() => {
                    const newAmbient = !ambientPlaying;
                    setAmbientPlaying(newAmbient);
                    toggleAmbientNoise(newAmbient);
                  }}
                  className={cn("p-3 rounded-full transition-colors", ambientPlaying ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500")}
                  title="Toggle Ambient Noise (Brown Noise)"
                >
                  <Music className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsZenMode(!isZenMode)}
                  className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500 transition-colors"
                  title="Toggle Zen Mode"
                >
                  {isZenMode ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>

              <h2 className={cn("text-xl font-bold mb-2 uppercase tracking-widest", isZenMode ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                {timerMode === 'study' ? `Focus: ${activeTask?.title}` : 'Recovery Phase'}
              </h2>
              {activeTask?.id.startsWith('pomo-') && (
                <div className="flex gap-2 mb-4">
                  {Array.from({ length: pomoConfig.rounds }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-3 h-3 rounded-full border transition-all",
                        i + 1 < currentPomoRound ? "bg-brand-500 border-brand-500" : 
                        i + 1 === currentPomoRound ? "bg-brand-500 border-brand-500 animate-pulse" : 
                        "bg-transparent border-slate-300 dark:border-slate-700"
                      )}
                    />
                  ))}
                </div>
              )}
              <div className={cn("text-8xl font-black mb-8 tracking-tighter", timerMode === 'study' ? "text-brand-600 dark:text-brand-500" : "text-emerald-500 dark:text-emerald-400")}>
                {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <div className="flex gap-4 justify-center mb-8">
                <button onClick={() => { 
                  setIsTimerOpen(false); 
                  setTimerRunning(false); 
                  setIsZenMode(false);
                  if (ambientPlaying) {
                    setAmbientPlaying(false);
                    toggleAmbientNoise(false);
                  }
                }} className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                  <X className="w-8 h-8" />
                </button>
                <button onClick={() => setTimerRunning(!timerRunning)} className="p-4 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-colors">
                  {timerRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>
              </div>

              {!isZenMode && (
                <div className="w-full mt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-left">Distraction Log / Scratchpad</label>
                  <textarea 
                    value={scratchpad}
                    onChange={(e) => setScratchpad(e.target.value)}
                    placeholder="Dump distracting thoughts here..."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none focus:border-brand-500 resize-none h-24"
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {isDiagOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/90 backdrop-blur-lg flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6 text-rose-600 dark:text-rose-500">
                <AlertTriangle className="w-8 h-8" />
                <h2 className="text-2xl font-black">Friction Detected</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium leading-relaxed">
                You fell below the 80% execution threshold on <strong>{new Date(diagDate).toLocaleDateString()}</strong>. 
                Identify the primary blocker to refine your Analytics.
              </p>
              <div className="space-y-3">
                <DiagButton label="Smartphone / Social Media" icon={<Smartphone className="w-5 h-5" />} onClick={() => saveDiagnostic('Smartphone / Social Media')} />
                <DiagButton label="Fatigue / Burnout" icon={<BatteryLow className="w-5 h-5" />} onClick={() => saveDiagnostic('Fatigue / Burnout')} />
                <DiagButton label="Environmental Distraction" icon={<VolumeX className="w-5 h-5" />} onClick={() => saveDiagnostic('Environmental Distraction')} />
                <DiagButton label="Poor Planning / Ambiguity" icon={<HelpCircle className="w-5 h-5" />} onClick={() => saveDiagnostic('Poor Planning / Ambiguity')} />
              </div>
            </motion.div>
          </motion.div>
        )}

        {isProgramConfigOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Program Configuration</h2>
                  <p className="text-sm font-bold text-slate-500">Configure roadmaps for specific periods of time.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select 
                    value={editingPlanIdx}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        const newPlan: Plan = {
                          ...INITIAL_SETTINGS.plans[0],
                          id: `plan-${Date.now()}`,
                          name: `Sprint ${localPlans.length + 1}`,
                          startDate: new Date().toISOString().split('T')[0],
                          durationDays: 30
                        };
                        setLocalPlans([...localPlans, newPlan]);
                        setEditingPlanIdx(localPlans.length);
                      } else {
                        setEditingPlanIdx(parseInt(e.target.value));
                      }
                    }}
                    className="flex-1 md:flex-none w-full md:w-auto bg-slate-100 dark:bg-slate-800 border-none font-bold text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl outline-none"
                  >
                    {localPlans.map((p, i) => (
                      <option key={p.id} value={i}>{p.name} ({p.startDate})</option>
                    ))}
                    <option value="new">+ Create New Program</option>
                  </select>
                </div>
              </div>

              {localPlans[editingPlanIdx] && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plan Name</label>
                      <input 
                        type="text" 
                        value={localPlans[editingPlanIdx].name || ''} 
                        onChange={(e) => {
                          const newPlans = [...localPlans];
                          newPlans[editingPlanIdx].name = e.target.value;
                          setLocalPlans(newPlans);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                      <input 
                        type="date" 
                        value={localPlans[editingPlanIdx].startDate} 
                        onChange={(e) => {
                          const newPlans = [...localPlans];
                          newPlans[editingPlanIdx].startDate = e.target.value;
                          setLocalPlans(newPlans);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration (Days)</label>
                      <input 
                        type="number" 
                        value={localPlans[editingPlanIdx].durationDays} 
                        onChange={(e) => {
                          const newPlans = [...localPlans];
                          newPlans[editingPlanIdx].durationDays = parseInt(e.target.value) || 30;
                          setLocalPlans(newPlans);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                      />
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                    <label className="block text-xs font-bold text-brand-600 uppercase mb-3">Subject Configuration</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {localPlans[editingPlanIdx].subjects.map((sub, index) => (
                        <div key={sub.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Course {index + 1}</label>
                            <button 
                              onClick={() => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects = newPlans[editingPlanIdx].subjects.filter((_, i) => i !== index);
                                setLocalPlans(newPlans);
                              }}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <input 
                              type="text" 
                              value={sub.title} 
                              onChange={(e) => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects[index].title = e.target.value;
                                setLocalPlans(newPlans);
                              }}
                              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                              placeholder="Name"
                            />
                            <input 
                              type="number" 
                              min="0.5" 
                              step="0.5" 
                              title="Total Daily Hrs" 
                              value={sub.targetHours}
                              onChange={(e) => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects[index].targetHours = parseFloat(e.target.value);
                                setLocalPlans(newPlans);
                              }}
                              className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors text-center px-1" 
                              placeholder="Hrs"
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="time" 
                              title="Start Time" 
                              value={sub.startTime}
                              onChange={(e) => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects[index].startTime = e.target.value;
                                setLocalPlans(newPlans);
                              }}
                              className="w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors"
                            />
                            <select 
                              title="Focus Block Duration" 
                              value={sub.blockDuration}
                              onChange={(e) => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects[index].blockDuration = parseInt(e.target.value);
                                setLocalPlans(newPlans);
                              }}
                              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors"
                            >
                              <option value="25">25m Focus</option>
                              <option value="30">30m Focus</option>
                              <option value="45">45m Focus</option>
                              <option value="60">60m Focus</option>
                              <option value="90">90m Focus</option>
                            </select>
                            <select 
                              title="Break Duration" 
                              value={sub.breakDuration}
                              onChange={(e) => {
                                const newPlans = [...localPlans];
                                newPlans[editingPlanIdx].subjects[index].breakDuration = parseInt(e.target.value);
                                setLocalPlans(newPlans);
                              }}
                              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors"
                            >
                              <option value="5">5m Break</option>
                              <option value="10">10m Break</option>
                              <option value="15">15m Break</option>
                              <option value="20">20m Break</option>
                              <option value="30">30m Break</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newSubjectId = `S${Date.now()}`;
                          const newSubject = {
                            id: newSubjectId,
                            title: 'New Subject',
                            targetHours: 1,
                            startTime: '12:00',
                            blockDuration: 25,
                            breakDuration: 5
                          };
                          const newPlans = [...localPlans];
                          newPlans[editingPlanIdx].subjects.push(newSubject);
                          setLocalPlans(newPlans);
                        }}
                        className="w-full text-xs font-bold text-brand-500 p-4 border border-dashed border-brand-200 dark:border-brand-800/50 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add Subject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => {
                    setSettings({ ...settings, plans: localPlans });
                    setIsProgramConfigOpen(false);
                    showToast('Settings applied across roadmap successfully!', 'success');
                  }} 
                  className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 dark:bg-brand-500 hover:bg-slate-800 dark:hover:bg-brand-600 transition-colors text-lg shadow-xl shadow-brand-500/20 flex justify-center items-center gap-2"
                >
                  <Check className="w-5 h-5" /> Apply Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">App Settings</h2>
              
              <div className="space-y-6">
                {/* Clear Data Segment */}
                <div>
                  <label className="block text-xs font-bold text-rose-600 uppercase mb-3">Clear App Data</label>
                  <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/50">
                    <p className="text-xs text-rose-600 dark:text-rose-400 mb-4 font-medium">Permanently delete tasks, sessions, and overrides for a specific date range. This cannot be undone unless you have a backup.</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-rose-500 uppercase font-bold mb-1 block">From</label>
                        <input type="date" value={clearStartDate} onChange={e => setClearStartDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/50 p-2 rounded-lg text-sm outline-none focus:border-rose-400" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-rose-500 uppercase font-bold mb-1 block">To</label>
                        <input type="date" value={clearEndDate} onChange={e => setClearEndDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/50 p-2 rounded-lg text-sm outline-none focus:border-rose-400" />
                      </div>
                    </div>
                    <button 
                      onClick={handleClearData} 
                      className="w-full text-xs font-bold bg-rose-500 text-white py-3 rounded-lg hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Clear Selected Period
                    </button>
                  </div>
                </div>

                {/* Data Backup Segment */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Data Management</label>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <p className="text-xs text-slate-500 font-medium">Download a complete backup of your database and settings to your PC, or restore a previous record.</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleExportData}
                        className="flex-1 text-xs font-bold bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 py-3 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                      >
                        Export Backup (JSON)
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 py-3 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        Import Backup
                      </button>
                      <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImportData} 
                      />
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Development Tools</p>
                      <button 
                        onClick={handleSeedData}
                        className="w-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500 py-3 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-900/30"
                      >
                        <Zap className="w-4 h-4" /> Seed 100 Days of Random Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Close Settings</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {configEditorOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">
                Edit {configEditorOpen === 'morningRoutine' ? 'Morning Protocol' : configEditorOpen === 'lifeRoutine' ? 'Life & Maintenance' : 'Evening Wind-down'} Template
              </h2>
              <p className="text-sm text-slate-500 mb-6 font-medium">Changes here will apply to your active long-term plan. Check "Edit Today" if you only want to customize the current day.</p>
              
              <div className="space-y-2">
                {(() => {
                  const defaultYm = INITIAL_SETTINGS.startDate.substring(0, 7);
                  const defaults = INITIAL_SETTINGS.monthlyConfig[defaultYm]!;
                  const key = configEditorOpen as 'morningRoutine' | 'lifeRoutine' | 'eveningRoutine';
                  const routine = currentMonthConfig[key] || defaults[key]!;

                  return (
                    <>
                      {routine.map((t, index) => (
                        <div key={t.id + '-' + index} className="flex gap-2">
                          <input 
                            type="text" 
                            value={t.title} 
                            onChange={(e) => {
                              const newRoutine = [...routine];
                              newRoutine[index] = { ...t, title: e.target.value };
                              updateActivePlan({ [key]: newRoutine });
                            }}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm font-semibold outline-none text-slate-900 dark:text-white"
                          />
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                            <input 
                              type="number" 
                              value={t.duration} 
                              onChange={(e) => {
                                const newRoutine = [...routine];
                                newRoutine[index] = { ...t, duration: parseInt(e.target.value) || 0 };
                                updateActivePlan({ [key]: newRoutine });
                              }}
                              className="w-12 bg-transparent text-sm font-semibold text-center outline-none text-slate-900 dark:text-white"
                            />
                            <span className="text-xs text-slate-400 font-bold">m</span>
                          </div>
                          <button 
                            onClick={() => {
                              const newRoutine = [...routine];
                              newRoutine.splice(index, 1);
                              updateActivePlan({ [key]: newRoutine });
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newRoutine = [...routine, { id: `${key}-${Date.now()}`, title: 'New Activity', duration: 15 }];
                          updateActivePlan({ [key]: newRoutine });
                        }}
                        className="w-full text-xs font-bold text-brand-500 py-2 border border-dashed border-brand-200 dark:border-brand-800/50 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors mt-4"
                      >
                        + Add Activity
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setConfigEditorOpen(null)} className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-lg shadow-brand-500/30">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isAddSessionOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">Add Custom Task</h2>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                  <input 
                    type="text" 
                    value={newSession.title} 
                    onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Send 3 emails"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration (Minutes)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newSession.duration} 
                    onChange={(e) => setNewSession(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsAddSessionOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                <button onClick={handleAddSession} className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors">Add Task</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        
        {selectedHistoricalDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Time Travel</h2>
                <button onClick={() => setSelectedHistoricalDate(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-4">
                {new Date(selectedHistoricalDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <div className="space-y-4">
                {db[selectedHistoricalDate] && db[selectedHistoricalDate].length > 0 ? (
                  <>
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-800">
                      <p className="text-sm font-black text-brand-900 dark:text-brand-100 mb-1">Tasks Completed</p>
                      <p className="text-3xl font-mono text-brand-600 dark:text-brand-400">{db[selectedHistoricalDate].length}</p>
                    </div>
                    {settings.reflections?.[selectedHistoricalDate] && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mt-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Daily Reflection</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{settings.reflections[selectedHistoricalDate]}"</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No activity recorded on this day.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {isEditDayOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">Edit Daily Plan ({dateLabel})</h2>
              
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <input 
                  type="checkbox" 
                  id="offDay" 
                  checked={customIsOffDay}
                  onChange={e => setCustomIsOffDay(e.target.checked)}
                  className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="offDay" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex-1">
                  Mark as Off Day (No Tasks)
                </label>
              </div>

              {!customIsOffDay && (
                <div className="space-y-4 mb-6">
                  {[
                    { id: 'Morning', title: 'Morning Routine & Maintenance' },
                    ...activePlan.subjects.map(s => ({ id: s.title, title: `Focus: ${s.title}`, subjectId: s.id })),
                    { id: 'Custom', title: 'Deep Work & Custom Tasks' },
                    { id: 'Life', title: 'Life & Activity' },
                    { id: 'Final', title: 'Evening Wind-down' }
                  ].map(group => {
                    const groupName = group.id;
                    const groupTitle = group.title;
                    const groupTasks = editDayDraft.filter(t => t.group === groupName || (groupName === 'Custom' && t.group !== 'Morning' && t.group !== 'Life' && t.group !== 'Final' && !activePlan.subjects.some(s => s.title === t.group)));
                    if (groupTasks.length === 0 && groupName !== 'Custom' && !group.subjectId) return null;
                    return (
                      <div key={groupName} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                          {groupTitle}
                        </h3>
                        <div className="space-y-2">
                          {groupTasks.map((t, index) => (
                            <div 
                              key={t.id + '-' + index} 
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('sourceId', t.id);
                                setDraggedTaskIdx(t.id);
                                e.currentTarget.style.opacity = '0.4';
                              }}
                              onDragEnd={(e) => {
                                setDraggedTaskIdx(null);
                                e.currentTarget.style.opacity = '1';
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const sourceId = e.dataTransfer.getData('sourceId');
                                if (sourceId === t.id) return;
                                
                                const newDraft = [...editDayDraft];
                                const sourceIndex = newDraft.findIndex(x => x.id === sourceId);
                                const targetIndex = newDraft.findIndex(x => x.id === t.id);
                                
                                if (sourceIndex > -1 && targetIndex > -1) {
                                  const [item] = newDraft.splice(sourceIndex, 1);
                                  if (item.group !== groupName) {
                                    item.group = groupName;
                                    item.subjectId = group.subjectId;
                                  }
                                  newDraft.splice(targetIndex, 0, item);
                                  setEditDayDraft(newDraft);
                                }
                                setDraggedTaskIdx(null);
                              }}
                              className={cn(
                                "flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border transition-all cursor-move",
                                draggedTaskIdx === t.id ? "border-brand-500 shadow-md" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                              )}
                            >
                              <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                              <input 
                                type="text"
                                value={t.title}
                                onChange={(e) => {
                                  const newDraft = [...editDayDraft];
                                  const taskIndex = newDraft.findIndex(x => x.id === t.id);
                                  if (taskIndex > -1) newDraft[taskIndex].title = e.target.value;
                                  setEditDayDraft(newDraft);
                                }}
                                className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none"
                              />
                              <input 
                                type="number"
                                value={Math.round(t.hours * 60)}
                                onChange={(e) => {
                                  const newDraft = [...editDayDraft];
                                  const taskIndex = newDraft.findIndex(x => x.id === t.id);
                                  if (taskIndex > -1) newDraft[taskIndex].hours = (parseInt(e.target.value) || 0) / 60;
                                  setEditDayDraft(newDraft);
                                }}
                                className="w-14 bg-slate-100 dark:bg-slate-800 rounded p-1 text-xs text-center outline-none text-slate-700 dark:text-slate-300"
                              />
                              <span className="text-xs font-bold text-slate-400">m</span>
                              <button 
                                onClick={() => {
                                  const newDraft = [...editDayDraft];
                                  const taskIndex = newDraft.findIndex(x => x.id === t.id);
                                  if (taskIndex > -1) newDraft.splice(taskIndex, 1);
                                  setEditDayDraft(newDraft);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newTask: Task = {
                                id: `custom-${groupName.toLowerCase()}-${Date.now()}`,
                                title: group.subjectId ? `Focus Session` : 'New Task',
                                hours: group.subjectId ? 0.5 : 0.25,
                                group: groupName,
                                subjectId: group.subjectId
                              };
                              setEditDayDraft([...editDayDraft, newTask]);
                            }}
                            className="w-full text-xs font-bold text-brand-500 py-2 border border-dashed border-brand-200 dark:border-brand-800/50 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors mt-2"
                          >
                            + Add {group.subjectId ? 'Focus Block' : 'Task'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsEditDayOpen(false)} 
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const newOverrides = { ...settings.dailyOverrides };
                    if (customIsOffDay) {
                      newOverrides[dateKey] = { isOffDay: true };
                    } else {
                      newOverrides[dateKey] = { tasks: editDayDraft };
                    }
                    setSettings(prev => ({ ...prev, dailyOverrides: newOverrides }));
                    setIsEditDayOpen(false);
                    showToast('Daily plan updated!', 'success');
                  }} 
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors"
                >
                  Save Day
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={cn(
              "fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-xl font-bold text-sm shadow-xl flex items-center gap-3 text-white",
              toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-brand-600'
            )}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex-1 md:flex-none flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl font-semibold transition-all",
        active ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30" : "text-slate-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800"
      )}
    >
      {icon}
      <span className="hidden lg:block">{label}</span>
    </button>
  );
}

function TaskBlock({ task, isDone, onToggle, subjectIndex, onDelete }: { task: Task; isDone: boolean; onToggle: () => void; subjectIndex?: number; onDelete?: () => void; key?: React.Key }) {
  const activeBg = subjectIndex === 1 ? 'bg-sub1 border-sub1' : subjectIndex === 2 ? 'bg-sub2 border-sub2' : subjectIndex === 3 ? 'bg-sub3 border-sub3' : 'bg-brand-500 border-brand-500';

  return (
    <div className="relative group">
      <motion.div 
        whileTap={{ scale: 0.98 }}
        onClick={onToggle}
        className={cn(
          "flex flex-col items-center justify-center p-3 rounded-2xl border cursor-pointer select-none min-h-[80px] transition-all",
          isDone ? "bg-brand-50/50 dark:bg-slate-800/50 border-transparent opacity-60" : "bg-white dark:bg-slate-800 border-brand-100 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600 shadow-sm"
        )}
      >
        <div className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center mb-2 transition-colors",
          isDone ? activeBg : "border-slate-300 dark:border-slate-600"
        )}>
          {isDone && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center line-clamp-2">
          {task.title}
        </span>
        {task.hours > 0 && (
          <span className="text-[9px] font-semibold text-slate-400 mt-1">{Math.round(task.hours * 60)}m</span>
        )}
      </motion.div>
      {onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm backdrop-blur-md">
      <p className="text-xs font-bold uppercase text-brand-600 mb-2">{label}</p>
      <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function DiagButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 transition-all text-left flex justify-between items-center">
      {label}
      {icon}
    </button>
  );
}

function ContributionGraph({ db, onDateClick }: { db: DailyData; onDateClick?: (dateKey: string) => void }) {
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  
  const weeks: ({ date: Date; count: number } | null)[][] = [];
  const startDay = new Date(todayTime);
  startDay.setDate(startDay.getDate() - 364); 
  // Adjust to start on a Sunday (or Monday, matching GitHub which is Sunday)
  startDay.setDate(startDay.getDate() - startDay.getDay());

  let current = new Date(startDay);
  while (current <= new Date(todayTime)) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      if (current > new Date(todayTime)) {
        week.push(null);
      } else {
        const k = getDKey(current);
        week.push({
          date: new Date(current),
          count: db[k]?.length || 0
        });
      }
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/50';
    if (count <= 2) return 'bg-brand-500 opacity-30';
    if (count <= 4) return 'bg-brand-500 opacity-60';
    if (count <= 7) return 'bg-brand-500 opacity-80';
    return 'bg-brand-600 shadow-sm shadow-brand-500/20 scale-105';
  };

  const getMonthLabels = () => {
    const labels = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const week = weeks[w];
      const firstDay = week.find(d => d !== null);
      if (firstDay) {
        const m = firstDay.date.getMonth();
        if (m !== lastMonth) {
          labels.push({ month: firstDay.date.toLocaleString('default', { month: 'short' }), index: w });
          lastMonth = m;
        }
      }
    }
    return labels;
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 border border-brand-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm backdrop-blur-md overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-brand-500" />
        <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">365-Day Activity</h3>
      </div>
      <div ref={scrollRef} className="w-full overflow-x-auto pb-4 hide-scroll smooth-scroll">
        <div className="min-w-max relative">
          {/* Months header */}
          <div className="h-4 text-[10px] font-bold text-slate-400 mb-2 w-full">
            {getMonthLabels().map((l, i) => (
              <div 
                key={i} 
                className="absolute top-0"
                style={{ left: `${(l.index * 16) + 18}px` }}
              >
                {l.month}
              </div>
            ))}
          </div>

          <div className="flex gap-[4px] min-w-max">
            {/* Days sidebar */}
            <div className="flex flex-col gap-[4px] pr-2 text-[10px] font-bold text-slate-400 justify-between py-[2px] leading-[10px]">
              <div>S</div>
              <div>M</div>
              <div>T</div>
              <div>W</div>
              <div>T</div>
              <div>F</div>
              <div>S</div>
            </div>

            {/* Matrix */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[4px]">
                {week.map((day, dIdx) => {
                  if (!day) return <div key={dIdx} className="w-3 h-3 rounded-[3px] bg-transparent" />;
                  return (
                    <div 
                      key={dIdx} 
                      title={`${day.count} tasks on ${day.date.toLocaleDateString()}`}
                      onClick={() => onDateClick && onDateClick(getDKey(day.date))}
                      className={cn("w-3 h-3 rounded-[3px] transition-colors cursor-pointer hover:ring-2 hover:ring-brand-400 dark:hover:ring-brand-300 hover:scale-125 z-10", getColor(day.count))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="flex justify-end items-center mt-4 gap-2 text-[10px] font-bold text-slate-400">
            <span>Less</span>
            <div className={`w-3 h-3 rounded-[3px] ${getColor(0)}`} />
            <div className={`w-3 h-3 rounded-[3px] ${getColor(1)}`} />
            <div className={`w-3 h-3 rounded-[3px] ${getColor(3)}`} />
            <div className={`w-3 h-3 rounded-[3px] ${getColor(6)}`} />
            <div className={`w-3 h-3 rounded-[3px] ${getColor(8)}`} />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CalendarMonth: React.FC<{ monthKey: string; db: DailyData; settings: UserSettings; dailySessions: Record<string, DailySession[]>; onDateClick: (d: Date) => void }> = ({ monthKey, db, settings, dailySessions, onDateClick }) => {
  const dObj = new Date(`${monthKey}-01T00:00:00`);
  const monthTitle = dObj.toLocaleDateString('en-US', { month: 'long' });
  
  const daysInMonth = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 0).getDate();
  const firstDay = new Date(dObj.getFullYear(), dObj.getMonth(), 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const days = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(dObj.getFullYear(), dObj.getMonth(), i));

  return (
    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
      <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mb-4 text-center text-lg">{monthTitle}</h3>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-400 uppercase text-center mb-3">
        <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const k = getDKey(date);
          const completed = db[k]?.length || 0;
          const conf = settings.monthlyConfig[getYMKey(k)] || Object.values(settings.monthlyConfig)[0];
          const customSessions = dailySessions[k];
          
          // 8 is the number of fixed tasks (4 morning + 4 evening/life)
          const expected = customSessions 
            ? 8 + customSessions.length 
            : 8 + conf.subjects.reduce((acc, s) => acc + Math.ceil(s.targetHours / (s.blockDuration / 60)), 0);
          
          let styling = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-600';
          if (completed >= expected && expected > 0) styling = 'bg-brand-500 text-white shadow-md border-transparent font-black';
          else if (completed > 0) styling = 'bg-brand-300 dark:bg-brand-600/50 text-brand-900 dark:text-brand-100 border-transparent font-bold';

          const isToday = k === getDKey(new Date());

          return (
            <div 
              key={k}
              onClick={() => onDateClick(date)}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-xs cursor-pointer transition-transform duration-200 hover:scale-110 relative", 
                styling,
                isToday && "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900"
              )}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
