import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useApp, onNotice } from './lib/store';
import { SignIn } from './pages/SignIn';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Shell } from './components/Shell';
import { ToastProvider, useToast } from './components/ui';

// Each page is its own file, so the sign-in page and the first screen load quickly. Once the workspace
// is up, the rest load in the background, so moving between pages stays instant.
const PAGES = {
  Overview: () => import('./pages/Overview').then((m) => ({ default: m.Overview })),
  Cards: () => import('./pages/Cards').then((m) => ({ default: m.Cards })),
  CardWorkspace: () => import('./pages/CardWorkspace').then((m) => ({ default: m.CardWorkspace })),
  Activity: () => import('./pages/Activity').then((m) => ({ default: m.Activity })),
  Plan: () => import('./pages/Plan').then((m) => ({ default: m.Plan })),
  Simulators: () => import('./pages/Simulators').then((m) => ({ default: m.Simulators })),
  Spaces: () => import('./pages/Spaces').then((m) => ({ default: m.Spaces })),
  Offers: () => import('./pages/Offers').then((m) => ({ default: m.Offers })),
  OffersAdmin: () => import('./pages/OffersAdmin').then((m) => ({ default: m.OffersAdmin })),
  Settings: () => import('./pages/Settings').then((m) => ({ default: m.Settings }))
};
const Overview = lazy(PAGES.Overview);
const Cards = lazy(PAGES.Cards);
const CardWorkspace = lazy(PAGES.CardWorkspace);
const Activity = lazy(PAGES.Activity);
const Plan = lazy(PAGES.Plan);
const Simulators = lazy(PAGES.Simulators);
const Spaces = lazy(PAGES.Spaces);
const Offers = lazy(PAGES.Offers);
const OffersAdmin = lazy(PAGES.OffersAdmin);
const Settings = lazy(PAGES.Settings);

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
  useEffect(() => {
    const t = window.setTimeout(() => Object.values(PAGES).forEach((load) => { load().catch(() => {}); }), 1500);
    return () => window.clearTimeout(t);
  }, []);
  return (
          <Shell>
            <Suspense fallback={null}>
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
            </Suspense>
          </Shell>
  );
}
