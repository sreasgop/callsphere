import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../context/WebRTCContext';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export const TopHeader = () => {
    const { user } = useAuth();
    const { isConnected } = useWebRTC();

    const copyUid = () => {
        if (!user || !user.sip_uid) return;
        navigator.clipboard.writeText(user.sip_uid);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'UID copied to clipboard!',
            showConfirmButton: false,
            timer: 2000,
            background: 'rgba(20, 22, 27, 0.95)',
            color: '#fff'
        });
    };

    return (
        <header className="content-header">
            <div className="user-status">
                <div className="status-dot"></div>
                <div>
                    <div className="user-name">{user ? user.full_name : 'Loading...'}</div>
                    <div className="user-uid-wrapper" onClick={copyUid} title="Click to Copy UID">
                        <span>{user ? user.sip_uid : '...'}</span>
                        <Copy className="copy-icon" size={14} />
                    </div>
                </div>
            </div>
            <div className="connection-status text-muted small d-flex align-items-center gap-1">
                {isConnected ? (
                    <>
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-success">Connected</span>
                    </>
                ) : (
                    <>
                        <AlertCircle size={14} className="text-warning" />
                        <span>Connecting...</span>
                    </>
                )}
            </div>
        </header>
    );
};
