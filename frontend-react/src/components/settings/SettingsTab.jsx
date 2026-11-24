import React, { useState } from 'react';
import { Shield, Lock, Camera, LogOut, UserCheck, Volume2, Smartphone, Copy, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import { useWebRTC } from '../../context/WebRTCContext';
import { api } from '../../utils/api';
import Swal from 'sweetalert2';

export const SettingsTab = () => {
    const { user, logout } = useAuth();
    const { soundEnabled, hapticsEnabled, updatePreferences, playClickSound } = useSound();
    const { availableCameras, activeCameraId, switchCamera } = useWebRTC();

    const [privacyMode, setPrivacyMode] = useState(user?.privacy_mode || 'everyone');
    const [soundPref, setSoundPref] = useState(soundEnabled);
    const [hapticsPref, setHapticsPref] = useState(hapticsEnabled);
    const [isSaving, setIsSaving] = useState(false);

    const handleCopyUid = () => {
        if (!user?.sip_uid) return;
        navigator.clipboard.writeText(user.sip_uid);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'UID copied to clipboard!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1a1d21',
            color: '#fff'
        });
    };

    const handleCameraChange = async (e) => {
        const deviceId = e.target.value;
        playClickSound();
        await switchCamera(deviceId);
    };

    const handleSaveConfiguration = async () => {
        playClickSound();
        setIsSaving(true);
        updatePreferences(soundPref, hapticsPref);

        await api.updateSettings(privacyMode, user?.status_message || 'Available');
        setIsSaving(false);

        Swal.fire({
            title: 'Configuration Saved',
            text: 'Your privacy settings and audio preferences have been updated.',
            icon: 'success',
            background: '#1a1d21',
            color: '#fff',
            timer: 2000,
            showConfirmButton: false
        });
    };

    const handleLogout = () => {
        playClickSound();
        Swal.fire({
            title: 'Sign Out?',
            text: 'You will be logged out of this device session.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            confirmButtonText: 'Yes, Sign Out',
            background: '#1a1d21',
            color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
            }
        });
    };

    return (
        <div className="settings-container">
            {/* Account Identity */}
            <div className="settings-card">
                <h4><UserCheck size={18} className="text-primary" /> Account Identity</h4>
                <div className="setting-row">
                    <div className="setting-label">UID (Universal ID)</div>
                    <div
                        className="font-monospace fw-semibold text-white d-flex align-items-center gap-2"
                        style={{ cursor: 'pointer' }}
                        onClick={handleCopyUid}
                        title="Click to copy"
                    >
                        <span>{user?.sip_uid}</span>
                        <Copy size={14} className="text-primary" />
                    </div>
                </div>
                <div className="setting-row">
                    <div className="setting-label">Full Name</div>
                    <div className="fw-semibold text-white">{user?.full_name}</div>
                </div>
                <div className="setting-row">
                    <div className="setting-label">Registered Email</div>
                    <div className="fw-semibold text-white">{user?.email}</div>
                </div>
            </div>

            {/* Camera & Media Hardware */}
            <div className="settings-card">
                <h4><Camera size={18} className="text-warning" /> Camera & Media Hardware</h4>
                <div className="setting-row">
                    <div className="setting-label">Active Camera Device</div>
                    <select
                        className="form-select w-auto py-1 px-3 bg-dark text-white border-secondary"
                        value={activeCameraId}
                        onChange={handleCameraChange}
                    >
                        {availableCameras.length === 0 ? (
                            <option value="">Default WebRTC Camera</option>
                        ) : (
                            availableCameras.map((cam, idx) => (
                                <option key={cam.deviceId || idx} value={cam.deviceId}>
                                    {cam.label || `Camera ${idx + 1}`}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Audio & Sound Effects */}
            <div className="settings-card">
                <h4><Volume2 size={18} className="text-info" /> Audio & Sound Effects</h4>
                <div className="setting-row">
                    <div className="setting-label">Sound Effects & Ringtone</div>
                    <div className="form-check form-switch m-0">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            checked={soundPref}
                            onChange={(e) => setSoundPref(e.target.checked)}
                        />
                    </div>
                </div>
                <div className="setting-row">
                    <div className="setting-label d-flex align-items-center gap-1">
                        <Smartphone size={15} className="text-muted" /> Haptic Feedback (Vibration)
                    </div>
                    <div className="form-check form-switch m-0">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            checked={hapticsPref}
                            onChange={(e) => setHapticsPref(e.target.checked)}
                        />
                    </div>
                </div>
            </div>

            {/* Privacy Rules Section */}
            <div className="settings-card">
                <h4><Shield size={18} className="text-success" /> Privacy Rules</h4>
                <p className="text-muted small mb-3">Choose who is allowed to dial your 10-digit UID.</p>
                
                <div className="form-check mb-2">
                    <input
                        className="form-check-input"
                        type="radio"
                        name="privacyMode"
                        id="priv-everyone"
                        value="everyone"
                        checked={privacyMode === 'everyone'}
                        onChange={(e) => setPrivacyMode(e.target.value)}
                    />
                    <label className="form-check-label text-white" htmlFor="priv-everyone">
                        Allow Everyone (Standard)
                    </label>
                </div>

                <div className="form-check mb-2">
                    <input
                        className="form-check-input"
                        type="radio"
                        name="privacyMode"
                        id="priv-contacts"
                        value="contacts"
                        checked={privacyMode === 'contacts'}
                        onChange={(e) => setPrivacyMode(e.target.value)}
                    />
                    <label className="form-check-label text-white" htmlFor="priv-contacts">
                        Contacts Only
                    </label>
                </div>

                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="radio"
                        name="privacyMode"
                        id="priv-dnd"
                        value="dnd"
                        checked={privacyMode === 'dnd'}
                        onChange={(e) => setPrivacyMode(e.target.value)}
                    />
                    <label className="form-check-label text-white" htmlFor="priv-dnd">
                        Do Not Disturb (Silence all calls)
                    </label>
                </div>
            </div>

            {/* Save Configuration Button */}
            <div className="text-center my-3">
                <button
                    className="btn btn-primary px-5 py-2 rounded-pill fw-semibold shadow-sm"
                    onClick={handleSaveConfiguration}
                    disabled={isSaving}
                >
                    <CheckCircle2 size={16} className="me-2" />
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            {/* Account Session & Logout Section */}
            <div className="settings-card border-danger border-opacity-25 mt-4">
                <h4 className="text-danger"><Lock size={18} className="text-danger" /> Account Session</h4>
                <div className="setting-row border-0 pt-2 pb-0">
                    <div className="setting-label text-muted">Log out of current device session</div>
                    <button className="btn btn-outline-danger btn-sm rounded-pill px-4 d-flex align-items-center gap-2" onClick={handleLogout}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>
        </div>
    );
};
