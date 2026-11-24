import React from 'react';
import { Grid, Clock, MessageSquare, Users, UserCheck, Settings } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { useWebRTC } from '../../context/WebRTCContext';

export const Navigation = ({ activeTab, setActiveTab }) => {
    const { playClickSound } = useSound();
    const { unreadMessages } = useWebRTC();

    const totalUnread = Object.values(unreadMessages).reduce((acc, curr) => acc + curr, 0);

    const handleTabChange = (tab) => {
        playClickSound();
        setActiveTab(tab);
    };

    return (
        <nav className="app-nav">
            <div className="mb-4 text-white fs-4 d-none d-md-block">
                <Grid size={28} />
            </div>

            <button
                className={`nav-btn ${activeTab === 'dialer' ? 'active' : ''}`}
                onClick={() => handleTabChange('dialer')}
                title="Keypad"
            >
                <Grid size={22} />
            </button>

            <button
                className={`nav-btn ${activeTab === 'recents' ? 'active' : ''}`}
                onClick={() => handleTabChange('recents')}
                title="Recent Calls"
            >
                <Clock size={22} />
            </button>

            <button
                className={`nav-btn ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => handleTabChange('messages')}
                title="Messages"
                style={{ position: 'relative' }}
            >
                <MessageSquare size={22} />
                {totalUnread > 0 && (
                    <span
                        className="badge rounded-pill bg-danger unread-nav-badge"
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            fontSize: '0.65rem'
                        }}
                    >
                        {totalUnread}
                    </span>
                )}
            </button>

            <button
                className={`nav-btn ${activeTab === 'contacts' ? 'active' : ''}`}
                onClick={() => handleTabChange('contacts')}
                title="Contacts"
            >
                <UserCheck size={22} />
            </button>

            <button
                className={`nav-btn ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => handleTabChange('groups')}
                title="Groups"
            >
                <Users size={22} />
            </button>

            <button
                className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleTabChange('settings')}
                title="Settings"
            >
                <Settings size={22} />
            </button>
        </nav>
    );
};
