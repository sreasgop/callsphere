import React from 'react';
import { Grid3X3, ArrowRight } from 'lucide-react';

export const LandingNav = ({ currentView, setCurrentView }) => {
    return (
        <nav className="public-nav">
            <div className="logo" onClick={() => setCurrentView('landing')} style={{ cursor: 'pointer' }}>
                <Grid3X3 className="text-primary me-2" size={24} />
                <span>CallSphere</span>
            </div>

            <div className="nav-links">
                <button
                    className={`nav-link-btn ${currentView === 'landing' ? 'active' : ''}`}
                    onClick={() => setCurrentView('landing')}
                >
                    Features
                </button>
                <button
                    className={`nav-link-btn ${currentView === 'team' ? 'active' : ''}`}
                    onClick={() => setCurrentView('team')}
                >
                    The Team
                </button>
                <button
                    className={`nav-link-btn ${currentView === 'architecture' ? 'active' : ''}`}
                    onClick={() => setCurrentView('architecture')}
                >
                    Architecture
                </button>
                <button
                    className={`nav-link-btn ${currentView === 'contact' ? 'active' : ''}`}
                    onClick={() => setCurrentView('contact')}
                >
                    Contact
                </button>
                <button
                    className="btn-cta ms-3"
                    onClick={() => setCurrentView('auth')}
                >
                    <span>Login / Register</span>
                    <ArrowRight size={16} className="ms-1" />
                </button>
            </div>
        </nav>
    );
};
