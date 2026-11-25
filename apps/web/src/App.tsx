import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { api, type UserProfile } from './lib/api';
import { AppPage } from './pages/AppPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AuthPage } from './pages/AuthPage';
import { ContactPage } from './pages/ContactPage';
import { LandingPage } from './pages/LandingPage';
import { TeamPage } from './pages/TeamPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center">
        <div className="size-6 rounded-full border-2 border-border-default border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/auth"
            element={
              user ? (
                <Navigate to="/app" replace />
              ) : (
                <AuthPage onAuthenticated={setUser} />
              )
            }
          />
          <Route
            path="/app"
            element={
              user ? (
                <AppPage
                  user={user}
                  onUserUpdated={setUser}
                  onLoggedOut={() => setUser(null)}
                />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
