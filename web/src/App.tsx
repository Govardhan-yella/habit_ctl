import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, useTheme, useApplyTheme } from './themes/index';
import { useHabitStore } from './hooks/useHabitStore';
import { useReminders } from './hooks/useReminders';
import { HabitList } from './components/HabitList';
import { AddHabitModal } from './components/AddHabitModal';
import { ThemeToggle } from './components/ThemeToggle';
import { SettingsModal } from './components/Settings';
import { RoutineList } from './components/RoutineList';
import { AddRoutineModal } from './components/AddRoutineModal';

type Tab = 'habits' | 'routines';

function AppInner() {
  useApplyTheme();
  const { habits } = useHabitStore();
  const { clearAll: clearReminders } = useReminders(habits);
  const [modalOpen, setModalOpen] = useState(false);
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('habits');
  const [reminderToast, setReminderToast] = useState<{ habitName: string; time: string } | null>(null);
  const reminderToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for reminder events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setReminderToast({ habitName: e.detail.habitName, time: e.detail.time });
    };
    window.addEventListener('habitctl-reminder', handler as EventListener);
    return () => {
      window.removeEventListener('habitctl-reminder', handler as EventListener);
      clearReminders();
    };
  }, [clearReminders]);

  // Auto-dismiss toast after 8 seconds
  useEffect(() => {
    if (reminderToast) {
      reminderToastRef.current = setTimeout(() => setReminderToast(null), 8000);
      return () => { if (reminderToastRef.current) clearTimeout(reminderToastRef.current); };
    }
  }, [reminderToast]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-title">habitctl</span>
          <span className="header-version">v0.1.0</span>
        </div>
        <div className="header-right">
          <span className="header-date muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button
            className="theme-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings — export, import, theme"
            aria-label="Settings"
          >
            <span style={{ fontSize: '14px' }}>⚙</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'habits' ? ' active' : ''}`}
          onClick={() => setActiveTab('habits')}
        >
          Habits
        </button>
        <button
          className={`tab-btn${activeTab === 'routines' ? ' active' : ''}`}
          onClick={() => setActiveTab('routines')}
        >
          Routines
        </button>
      </nav>

      {/* Main */}
      <main className="main">
        {activeTab === 'habits' ? (
          <HabitList />
        ) : (
          <RoutineList onAddRoutine={() => setRoutineModalOpen(true)} />
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-left">
          <span className="footer-stat">
            habits <span className="footer-stat-value">{habits.length}</span>
          </span>
        </div>
        <div className="footer-right">
          <span className="muted small">local first · no account needed</span>
        </div>
      </footer>

      {/* Floating add buttons */}
      {!modalOpen && activeTab === 'habits' && (
        <button className="add-btn" onClick={() => setModalOpen(true)} aria-label="Add habit">
          +
        </button>
      )}
      {!routineModalOpen && activeTab === 'routines' && (
        <button className="add-btn" onClick={() => setRoutineModalOpen(true)} aria-label="Add routine">
          +
        </button>
      )}

      {/* Reminder toast */}
      {reminderToast && (
        <div className="reminder-toast">
          <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            🔔 {reminderToast.habitName}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--fg-dim)', marginLeft: '6px' }}>
            {reminderToast.time}
          </span>
        </div>
      )}
      {modalOpen && <AddHabitModal onClose={() => setModalOpen(false)} />}
      {routineModalOpen && (
        <AddRoutineModal onClose={() => setRoutineModalOpen(false)} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
