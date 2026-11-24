import React, { useState, useEffect } from 'react';
import { PhoneCall, Delete } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { useWebRTC } from '../../context/WebRTCContext';
import { api } from '../../utils/api';

export const DialerTab = () => {
    const [dialValue, setDialValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    const { playKeyTone, playClickSound } = useSound();
    const { startCall } = useWebRTC();

    useEffect(() => {
        api.getContacts().then(res => setContacts(Array.isArray(res) ? res : []));
        api.getAllUsers().then(res => setAllUsers(Array.isArray(res) ? res : []));
    }, []);

    const keyFrequencies = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };

    const handleKeyClick = (val) => {
        const freqs = keyFrequencies[val] || [697, 1209];
        playKeyTone(freqs[0], freqs[1]);
        const newValue = dialValue + val;
        setDialValue(newValue);
        filterSuggestions(newValue);
    };

    const filterSuggestions = (val) => {
        if (!val || val.length < 2) {
            setSuggestions([]);
            return;
        }
        const lowerVal = val.toLowerCase();
        const contactMatches = contacts.filter(c => {
            const name = (c.contact_name || c.nickname || '').toLowerCase();
            const uid = String(c.contact_uid || c.target_uid || '');
            return name.includes(lowerVal) || uid.includes(lowerVal);
        }).map(c => ({
            name: c.contact_name || c.nickname || 'Contact',
            uid: String(c.contact_uid || c.target_uid)
        }));

        const userMatches = allUsers.filter(u => {
            const name = (u.full_name || '').toLowerCase();
            const uid = String(u.sip_uid || '');
            return (name.includes(lowerVal) || uid.includes(lowerVal)) &&
                !contactMatches.some(cm => cm.uid === uid);
        }).map(u => ({
            name: u.full_name,
            uid: String(u.sip_uid)
        }));

        setSuggestions([...contactMatches, ...userMatches].slice(0, 5));
    };

    const handleCall = () => {
        if (!dialValue || dialValue.length < 3) return;
        startCall(dialValue, true);
    };

    const handleBackspace = () => {
        playClickSound();
        const nextVal = dialValue.slice(0, -1);
        setDialValue(nextVal);
        filterSuggestions(nextVal);
    };

    return (
        <div className="dialer-container">
            <div className="dial-display-wrapper">
                <input
                    type="text"
                    className="dial-display"
                    placeholder="Enter 10-Digit UID"
                    value={dialValue}
                    onChange={(e) => {
                        setDialValue(e.target.value);
                        filterSuggestions(e.target.value);
                    }}
                />
                {suggestions.length > 0 && (
                    <div className="dialer-suggestions d-block">
                        {suggestions.map((c, i) => (
                            <div
                                key={i}
                                className="suggestion-item"
                                onClick={() => {
                                    setDialValue(c.uid);
                                    setSuggestions([]);
                                }}
                            >
                                <span>{c.name}</span>
                                <span className="text-muted">{c.uid}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="keypad-grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                    <button key={k} className="key-btn" onClick={() => handleKeyClick(k)}>
                        {k}
                    </button>
                ))}
            </div>

            <div className="d-flex gap-3 align-items-center justify-content-center mt-3">
                <button className="key-btn" onClick={handleBackspace} title="Backspace" style={{ width: '56px', height: '56px' }}>
                    <Delete size={22} />
                </button>
                <button className="call-btn" onClick={handleCall} title="Initiate Call">
                    <PhoneCall size={28} />
                </button>
            </div>
        </div>
    );
};
