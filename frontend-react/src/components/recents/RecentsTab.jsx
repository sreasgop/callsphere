import React, { useState, useEffect } from 'react';
import { PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { api } from '../../utils/api';
import { formatISTTime } from '../../utils/time';
import { useWebRTC } from '../../context/WebRTCContext';
import { useAuth } from '../../context/AuthContext';

export const RecentsTab = () => {
    const [history, setHistory] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [filter, setFilter] = useState('all');
    const { user } = useAuth();
    const { startCall } = useWebRTC();

    useEffect(() => {
        api.getContacts().then(res => setContacts(Array.isArray(res) ? res : []));
        api.getCallHistory().then(res => {
            if (Array.isArray(res)) setHistory(res);
            else setHistory([]);
        });
    }, []);

    const resolvePeerInfo = (peerUid) => {
        const found = contacts.find(c => (c.contact_uid || c.target_uid) === peerUid);
        if (found) {
            return {
                name: found.contact_name || found.nickname,
                uid: peerUid
            };
        }
        return {
            name: peerUid,
            uid: peerUid
        };
    };

    const safeHistory = Array.isArray(history) ? history : [];
    const filteredLogs = safeHistory.filter(item => {
        if (!item) return false;
        if (filter === 'missed') {
            return item.status === 'MISSED' || item.status === 'REJECTED';
        }
        return true;
    });

    const getCallIcon = (item) => {
        if (!user || !item) return <PhoneIncoming size={16} />;
        const isOutgoing = String(item.caller_uid) === String(user.sip_uid);
        if (item.status === 'MISSED' || item.status === 'REJECTED') {
            return <PhoneMissed size={16} className="text-danger" />;
        }
        return isOutgoing 
            ? <PhoneOutgoing size={16} className="text-info" /> 
            : <PhoneIncoming size={16} className="text-success" />;
    };

    return (
        <div>
            <div className="section-header">
                <h3>Recent Calls</h3>
                <div className="filter-pills">
                    <div
                        className={`pill ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </div>
                    <div
                        className={`pill ${filter === 'missed' ? 'active' : ''}`}
                        onClick={() => setFilter('missed')}
                    >
                        Missed
                    </div>
                </div>
            </div>

            <div className="history-list">
                {filteredLogs.length === 0 ? (
                    <div className="text-center text-muted my-5">No recent calls found</div>
                ) : (
                    filteredLogs.map((item, index) => {
                        const peerUid = String(item.caller_uid) === String(user?.sip_uid) ? item.callee_uid : item.caller_uid;
                        const peerInfo = resolvePeerInfo(String(peerUid || ''));
                        const displayDuration = item.duration && Number(item.duration) > 0 ? `${item.duration}s` : item.status;

                        return (
                            <div key={index} className="list-item">
                                <div className="item-info">
                                    <div className="item-avatar">
                                        {peerInfo.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="item-text">
                                        <h4>{peerInfo.name}</h4>
                                        <p className="d-flex align-items-center gap-1">
                                            {getCallIcon(item)}
                                            <span>{displayDuration}</span>
                                            <span>•</span>
                                            <span className="font-monospace">{peerInfo.uid}</span>
                                            <span>•</span>
                                            <span>{formatISTTime(item.timestamp || item.start_time)}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    className="icon-btn"
                                    onClick={() => startCall(peerInfo.uid, true)}
                                    title="Redial Call"
                                >
                                    <PhoneCall size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
