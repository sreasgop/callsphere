import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCw } from 'lucide-react';
import { useWebRTC } from '../../context/WebRTCContext';
import { api } from '../../utils/api';

export const ActiveCallOverlay = () => {
    const {
        remoteUser,
        callState,
        callDuration,
        isMuted,
        isVideoOff,
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
        switchCamera,
        toggleMute,
        toggleVideo,
        hangupCall
    } = useWebRTC();

    const [resolvedName, setResolvedName] = useState(null);

    useEffect(() => {
        if (remoteUser?.sip_uid) {
            api.getContacts().then(contacts => {
                if (Array.isArray(contacts)) {
                    const found = contacts.find(c => (c.contact_uid || c.target_uid) === remoteUser.sip_uid);
                    if (found) setResolvedName(found.contact_name || found.nickname);
                }
            });
        }
    }, [remoteUser?.sip_uid]);

    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const displayName = resolvedName || remoteUser?.callerName || remoteUser?.sip_uid || 'Calling...';

    return (
        <div className="call-overlay d-block">
            <div className="video-wrapper">
                <video ref={remoteVideoRef} id="remote-video" autoPlay playsInline></video>
                <video ref={localVideoRef} id="local-video" autoPlay playsInline muted></video>
                <audio ref={remoteAudioRef} id="remote-audio" autoPlay playsInline style={{ display: 'none' }}></audio>
            </div>

            <div className="call-header-overlay">
                <h3 className="text-white fw-bold drop-shadow mb-1">{displayName}</h3>
                <div className="text-muted font-monospace small drop-shadow mb-1">{remoteUser?.sip_uid}</div>
                <p className="text-success fw-medium font-monospace drop-shadow">
                    {callState === 'CONNECTED' ? formatTimer(callDuration) : 'Ringing...'}
                </p>
            </div>

            <div className="call-controls">
                <button className={`ctrl-btn ${isMuted ? 'bg-danger' : ''}`} onClick={toggleMute} title="Toggle Audio">
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button className={`ctrl-btn ${isVideoOff ? 'bg-danger' : ''}`} onClick={toggleVideo} title="Toggle Video">
                    {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <button className="ctrl-btn" onClick={() => switchCamera()} title="Switch Camera (Front/Back/External)">
                    <RefreshCw size={20} />
                </button>
                <button className="ctrl-btn hangup" onClick={hangupCall} title="End Call">
                    <PhoneOff size={22} />
                </button>
            </div>
        </div>
    );
};
