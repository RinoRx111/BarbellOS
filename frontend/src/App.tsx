import { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { LockScreen } from './components/LockScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { PlansView } from './components/PlansView';
import { ExpensesView } from './components/ExpensesView';
import { SettingsView } from './components/SettingsView';
import { AiChatDrawer } from './components/AiChatDrawer';
import api from './services/api';

function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [adminName, setAdminName] = useState('Owner');
  const [gymName, setGymName] = useState('Iron Temple Gym');
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Real-time status indicators
  const [readerConnected] = useState(true);
  const [doorUnlocked, setDoorUnlocked] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Check Onboarding Status on start (with retries to await backend server boot)
  const checkOnboardStatus = async () => {
    let retries = 15;
    const delay = 500; // ms

    while (retries > 0) {
      try {
        const response = await api.get<{ onboarded: boolean }>('/auth/status');
        setOnboarded(response.onboarded);
        if (response.onboarded) {
          // Load settings to fetch gym details
          const settings = await api.get<{ gym_name: string; owner_name: string }>('/settings');
          if (settings) {
            setGymName(settings.gym_name);
            setAdminName(settings.owner_name);
          }
        }
        return; // Success, exit retry loop
      } catch (e) {
        retries -= 1;
        if (retries === 0) {
          console.error("Failed to connect to backend after multiple retries.", e);
          setOnboarded(false);
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  };


  useEffect(() => {
    checkOnboardStatus();
  }, []);

  const handleUnlock = (name: string, token: string) => {
    api.setToken(token);
    setAdminName(name);
    setUnlocked(true);
    // Reload settings
    api.get<{ gym_name: string }>('/settings').then(settings => {
      if (settings) {
        setGymName(settings.gym_name);
      }
    });
  };

  const handleLock = () => {
    api.setToken(null);
    setUnlocked(false);
  };


  const handleManualOverride = async () => {
    try {
      await api.post('/attendance/manual-override');
      setDoorUnlocked(true);
      
      // Auto relock door after 3 seconds
      setTimeout(() => {
        setDoorUnlocked(false);
      }, 3000);
    } catch (e) {
      console.error("Failed to run manual override", e);
    }
  };

  if (onboarded === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0B0F19' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Initializing management terminal...</p>
      </div>
    );
  }

  if (!onboarded) {
    return <Onboarding onSuccess={() => setOnboarded(true)} />;
  }

  if (!unlocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  // Render the selected module view
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'members':
        return <MembersView />;
      case 'plans':
        return <PlansView />;
      case 'expenses':
        return <ExpensesView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-dark)' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLock={handleLock}
        gymName={gymName}
      />

      {/* Main Container */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Header Indicators Bar */}
        <Header
          title={currentView}
          readerConnected={readerConnected}
          doorUnlocked={doorUnlocked}
          onManualOverride={handleManualOverride}
          isAiOpen={isAiOpen}
          onToggleAi={() => setIsAiOpen(!isAiOpen)}
          adminName={adminName}
        />

        {/* View viewport & AI slider split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Main Module View viewport */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderView()}
          </div>

          {/* AI Drawer (Slides out from right) */}
          {isAiOpen && (
            <AiChatDrawer onClose={() => setIsAiOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
