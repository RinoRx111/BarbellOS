import { useState, useEffect } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
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
  
  // Clerk states
  const [clerkActive, setClerkActive] = useState<boolean>(false);
  const [clerkPublishableKey, setClerkPublishableKey] = useState<string | null>(null);

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
        const response = await api.get<any>('/auth/status');
        setOnboarded(response.onboarded);
        setClerkActive(!!response.clerk_active);
        setClerkPublishableKey(response.clerk_publishable_key || null);
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

    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setCurrentView(customEvent.detail);
      }
    };

    const handleContextOpen = () => {
      setIsAiOpen(true);
    };


    window.addEventListener('change-tab', handleTabChange);
    window.addEventListener('change-tab-context', handleContextOpen);
    return () => {
      window.removeEventListener('change-tab', handleTabChange);
      window.removeEventListener('change-tab-context', handleContextOpen);
    };
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

  if (clerkActive && clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkAppWrapper
          currentView={currentView}
          setCurrentView={setCurrentView}
          gymName={gymName}
          readerConnected={readerConnected}
          doorUnlocked={doorUnlocked}
          handleManualOverride={handleManualOverride}
          isAiOpen={isAiOpen}
          setIsAiOpen={setIsAiOpen}
          adminName={adminName}
          renderView={renderView}
          handleLock={handleLock}
        />
      </ClerkProvider>
    );
  }

  if (!unlocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

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

// Clerk Wrapper
const ClerkAppWrapper: React.FC<{
  currentView: string;
  setCurrentView: (v: string) => void;
  gymName: string;
  readerConnected: boolean;
  doorUnlocked: boolean;
  handleManualOverride: () => Promise<void>;
  isAiOpen: boolean;
  setIsAiOpen: (open: boolean) => void;
  adminName: string;
  renderView: () => React.ReactNode;
  handleLock: () => void;
}> = ({
  currentView,
  setCurrentView,
  gymName,
  readerConnected,
  doorUnlocked,
  handleManualOverride,
  isAiOpen,
  setIsAiOpen,
  adminName,
  renderView,
  handleLock
}) => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        api.setToken(token);
      });
    } else {
      api.setToken(null);
    }
  }, [isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
        <p style={{ color: 'var(--text-primary)' }}>Loading authentication context...</p>
      </div>
    );
  }

  return (
    <>
      <SignedOut>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-dark)',
          color: 'var(--text-primary)'
        }}>
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>BarbellOS Clerk Sign In</h2>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
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
      </SignedIn>
    </>
  );
};

export default App;
