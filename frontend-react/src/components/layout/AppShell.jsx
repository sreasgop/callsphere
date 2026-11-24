import React, { useState } from 'react';
import { Navigation } from './Navigation';
import { TopHeader } from './TopHeader';
import { DialerTab } from '../dialer/DialerTab';
import { RecentsTab } from '../recents/RecentsTab';
import { MessagesTab } from '../messaging/MessagesTab';
import { ContactsTab } from '../contacts/ContactsTab';
import { GroupsTab } from '../groups/GroupsTab';
import { SettingsTab } from '../settings/SettingsTab';
import { ActiveCallOverlay } from '../calling/ActiveCallOverlay';
import { IncomingCallOverlay } from '../calling/IncomingCallOverlay';
import { useWebRTC } from '../../context/WebRTCContext';

export const AppShell = () => {
    const [activeTab, setActiveTab] = useState('dialer');
    const { callState } = useWebRTC();

    return (
        <div className="app-shell">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className={`app-content ${activeTab !== 'dialer' ? 'hide-mobile-header' : ''}`}>
                <TopHeader />

                <div className={`tab-view ${activeTab === 'dialer' ? 'active' : ''}`}>
                    <DialerTab setActiveTab={setActiveTab} />
                </div>

                <div className={`tab-view ${activeTab === 'recents' ? 'active' : ''}`}>
                    <RecentsTab setActiveTab={setActiveTab} />
                </div>

                <div className={`tab-view ${activeTab === 'messages' ? 'active' : ''}`} id="tab-messages">
                    <MessagesTab />
                </div>

                <div className={`tab-view ${activeTab === 'contacts' ? 'active' : ''}`}>
                    <ContactsTab setActiveTab={setActiveTab} />
                </div>

                <div className={`tab-view ${activeTab === 'groups' ? 'active' : ''}`}>
                    <GroupsTab />
                </div>

                <div className={`tab-view ${activeTab === 'settings' ? 'active' : ''}`}>
                    <SettingsTab />
                </div>

                {callState === 'RINGING' && <IncomingCallOverlay />}
                {(callState === 'CALLING' || callState === 'CONNECTED') && <ActiveCallOverlay />}
            </div>
        </div>
    );
};
