import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp, onNotice } from './lib/store';
import { SignIn } from './pages/SignIn';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Shell } from './components/Shell';
import { ToastProvider, useToast } from './components/ui';
import { Overview } from './pages/Overview';
import { Cards } from './pages/Cards';
import { CardWorkspace } from './pages/CardWorkspace';
import { Activity } from './pages/Activity';
import { Plan } from './pages/Plan';
import { Simulators } from './pages/Simulators';
import { Spaces } from './pages/Spaces';
import { Offers } from './pages/Offers';
import { OffersAdmin } from './pages/OffersAdmin';
import { Settings } from './pages/Settings';

// Loading → sign-in → the workspace, as the account's sign-in state changes
function Splash() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-brand font-serif text-[26px] font-semibold text-white">S</span>
    </div>
  );
}

// The store's notices (recurring charges, offline, back online) as toasts, from the first screen on
function Notices() {
  const toast = useToast();
  useEffect(() => onNotice((n) => toast(n.text, { tone: n.tone, action: n.action })), [toast]);
  return null;
}

export function App() {
  const app = useApp();
  return (
    <BrowserRouter basename="/desktop">
      <Tooltip.Provider>
        <ToastProvider>
          <Notices />
          {app.status === 'starting' ? <Splash /> : app.status === 'signedOut' ? <SignIn /> : <Workspace />}
        </ToastProvider>
      </Tooltip.Provider>
    </BrowserRouter>
  );
}

function Workspace() {
  return (
          <Shell>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/cards/:id" element={<CardWorkspace />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/simulators" element={<Simulators />} />
              <Route path="/spaces" element={<Spaces />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/offers/admin" element={<OffersAdmin />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Overview />} />
            </Routes>
          </Shell>
  );
}
