import { BrowserRouter, Route, Routes } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/ui';
import { Overview } from './pages/Overview';
import { Cards } from './pages/Cards';
import { CardWorkspace } from './pages/CardWorkspace';
import { Placeholder } from './pages/Placeholder';

export function App() {
  return (
    <BrowserRouter basename="/desktop">
      <Tooltip.Provider>
        <ToastProvider>
          <Shell>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/cards/:id" element={<CardWorkspace />} />
              <Route path="/activity" element={<Placeholder id="activity" />} />
              <Route path="/plan" element={<Placeholder id="plan" />} />
              <Route path="/simulators" element={<Placeholder id="simulators" />} />
              <Route path="/spaces" element={<Placeholder id="spaces" />} />
              <Route path="/offers" element={<Placeholder id="offers" />} />
              <Route path="/settings" element={<Placeholder id="settings" />} />
              <Route path="*" element={<Overview />} />
            </Routes>
          </Shell>
        </ToastProvider>
      </Tooltip.Provider>
    </BrowserRouter>
  );
}
