import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SoundProvider } from './context/SoundContext';
import { WebRTCProvider } from './context/WebRTCContext';
import { AppShell } from './components/layout/AppShell';
import { AuthView } from './components/auth/AuthView';
import { LandingNav } from './components/landing/LandingNav';
import { LandingView } from './components/landing/LandingView';
import { TeamView } from './components/landing/TeamView';
import { ArchitectureView } from './components/landing/ArchitectureView';
import { ContactView } from './components/landing/ContactView';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';
import './styles/landing.css';

const MainContent = () => {
    const { user } = useAuth();
    const [publicView, setPublicView] = useState('landing');

    if (user) {
        return <AppShell />;
    }

    return (
        <div className="public-portal-container">
            <LandingNav currentView={publicView} setCurrentView={setPublicView} />
            <div className={`public-view-body ${publicView === 'auth' ? 'd-flex align-items-center justify-content-center' : ''}`} style={publicView === 'auth' ? { minHeight: '100vh', paddingTop: '80px' } : {}}>
                {publicView === 'landing' && <LandingView setCurrentView={setPublicView} />}
                {publicView === 'team' && <div className="container"><TeamView /></div>}
                {publicView === 'architecture' && <div className="container"><ArchitectureView /></div>}
                {publicView === 'contact' && <div className="container"><ContactView /></div>}
                {publicView === 'auth' && <AuthView onBack={() => setPublicView('landing')} />}
            </div>
        </div>
    );
};

export default function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <SoundProvider>
                    <WebRTCProvider>
                        <div className="bg-orb orb-1"></div>
                        <div className="bg-orb orb-2"></div>
                        <MainContent />
                    </WebRTCProvider>
                </SoundProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}
