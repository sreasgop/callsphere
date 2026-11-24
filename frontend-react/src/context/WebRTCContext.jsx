import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSound } from './SoundContext';
import { api } from '../utils/api';
import Swal from 'sweetalert2';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children }) => {
    const { user } = useAuth();
    const { startRingtone, stopRingtone, startRingback, stopRingback, playMessageNotification } = useSound();

    const [isConnected, setIsConnected] = useState(false);
    const [callState, setCallState] = useState('IDLE'); // IDLE, CALLING, RINGING, CONNECTED
    const [remoteUser, setRemoteUser] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [activeCameraId, setActiveCameraId] = useState('');
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    // Messaging & Typing States
    const [unreadMessages, setUnreadMessages] = useState({});
    const [activeTypingUsers, setActiveTypingUsers] = useState(new Set());
    const [activeChatTarget, setActiveChatTarget] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    // Refs for WebRTC & Audio/Video
    const wsRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const callTimerRef = useRef(null);
    const typingTimeoutsRef = useRef({});
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const iceCandidatesBufferRef = useRef([]);

    // Refs for avoiding stale closure in event handlers
    const activeChatTargetRef = useRef(activeChatTarget);
    useEffect(() => {
        activeChatTargetRef.current = activeChatTarget;
    }, [activeChatTarget]);

    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const contactsRef = useRef(contacts);
    useEffect(() => {
        contactsRef.current = contacts;
    }, [contacts]);

    const allUsersRef = useRef(allUsers);
    useEffect(() => {
        allUsersRef.current = allUsers;
    }, [allUsers]);

    const conversationsRef = useRef(conversations);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:turn.callsphere.org:3478?transport=udp',
                username: 'callsphere_user',
                credential: 'CallSphereTurn2026SecureKey!'
            }
        ]
    };

    // Load camera hardware devices
    const loadCameraDevices = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevs = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoDevs);
            if (videoDevs.length > 0 && !activeCameraId) {
                setActiveCameraId(videoDevs[0].deviceId);
            }
            return videoDevs;
        } catch (e) {
            return [];
        }
    };

    useEffect(() => {
        loadCameraDevices();
    }, []);

    // --- WEBSOCKET CONNECTION & EVENT DISPATCH ---
    useEffect(() => {
        if (!user || !user.sip_uid) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setIsConnected(false);
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? `${window.location.hostname}:5000` 
            : window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/${user.sip_uid}`;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
            console.log('[WebSocket] Connected');
            setIsConnected(true);
            loadConversations();
        };

        socket.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                handleSignalMessage(data);
            } catch (err) {
                console.error('[WebSocket] Message parse error:', err);
            }
        };

        socket.onclose = () => {
            console.log('[WebSocket] Disconnected');
            setIsConnected(false);
        };

        socket.onerror = (err) => {
            console.error('[WebSocket] Error:', err);
        };

        return () => {
            socket.close();
        };
    }, [user?.sip_uid]);

    // Send WebSocket signal helper
    const sendSignal = (payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        }
    };

    // Flush any ICE candidates buffered before setRemoteDescription
    const flushIceCandidates = async () => {
        if (!pcRef.current) return;
        while (iceCandidatesBufferRef.current.length > 0) {
            const candidate = iceCandidatesBufferRef.current.shift();
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
            }
        }
    };

    // --- WEBRTC CORE HELPERS ---
    const createPeerConnection = (targetUid) => {
        if (pcRef.current) {
            pcRef.current.close();
        }

        iceCandidatesBufferRef.current = [];
        const pc = new RTCPeerConnection(rtcConfig);
        pcRef.current = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                sendSignal({
                    type: 'send-ice',
                    targetUid,
                    candidate: e.candidate
                });
            }
        };

        pc.ontrack = (e) => {
            if (remoteVideoRef.current && e.streams[0]) {
                remoteVideoRef.current.srcObject = e.streams[0];
                remoteStreamRef.current = e.streams[0];
            }
            if (remoteAudioRef.current && e.streams[0]) {
                remoteAudioRef.current.srcObject = e.streams[0];
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        return pc;
    };

    const getUserMedia = async (video = true, deviceId = null) => {
        const constraints = {
            audio: true,
            video: video ? (deviceId ? { deviceId: { exact: deviceId } } : true) : false
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream;
        } catch (e) {
            console.error('Failed to get user media with video, falling back to audio-only:', e);
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = audioOnly;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
            return audioOnly;
        }
    };

    const switchCamera = async (newDeviceId = null) => {
        if (!localStreamRef.current) return;
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (!currentVideoTrack) return;

        let targetId = newDeviceId;
        if (!targetId && availableCameras.length > 1) {
            const currentIndex = availableCameras.findIndex(c => c.deviceId === activeCameraId);
            const nextIndex = (currentIndex + 1) % availableCameras.length;
            targetId = availableCameras[nextIndex].deviceId;
        }

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: targetId ? { deviceId: { exact: targetId } } : { facingMode: 'environment' }
            });
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (pcRef.current) {
                const senders = pcRef.current.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                }
            }

            localStreamRef.current.removeTrack(currentVideoTrack);
            currentVideoTrack.stop();
            localStreamRef.current.addTrack(newVideoTrack);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            if (targetId) setActiveCameraId(targetId);
        } catch (e) {
            console.error('[WebRTC] Camera switch failed:', e);
        }
    };

    // --- CALL ACTIONS ---
    const startCall = async (targetUid, isVideo = true) => {
        setRemoteUser({ sip_uid: targetUid });
        setCallState('CALLING');
        startRingback();

        await getUserMedia(isVideo, activeCameraId);
        const pc = createPeerConnection(targetUid);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendSignal({
            type: 'make-offer',
            targetUid,
            offer: pc.localDescription,
            callerName: user?.full_name || 'Caller'
        });
    };

    const answerCall = async () => {
        stopRingtone();
        setCallState('CONNECTED');
        startCallTimer();

        await getUserMedia(true, activeCameraId);
        const pc = createPeerConnection(remoteUser.sip_uid);

        if (remoteUser.pendingOffer) {
            await pc.setRemoteDescription(new RTCSessionDescription(remoteUser.pendingOffer));
            await flushIceCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal({
                type: 'make-answer',
                targetUid: remoteUser.sip_uid,
                answer: pc.localDescription
            });
        }
    };

    const rejectCall = () => {
        stopRingtone();
        if (remoteUser) {
            sendSignal({ type: 'reject-call', targetUid: remoteUser.sip_uid });
        }
        endCall();
    };

    const hangupCall = () => {
        if (remoteUser) {
            sendSignal({ type: 'end-call', targetUid: remoteUser.sip_uid });
        }
        endCall();
    };

    const endCall = () => {
        stopRingback();
        stopRingtone();
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        iceCandidatesBufferRef.current = [];
        setCallState('IDLE');
        setRemoteUser(null);
        setCallDuration(0);
    };

    const startCallTimer = () => {
        setCallDuration(0);
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // --- SIGNAL HANDLER (ALIGNED WITH BACKEND) ---
    const handleSignalMessage = async (data) => {
        const eventType = data.type;
        const fromUid = data.from;

        switch (eventType) {
            case 'incoming-call':
                setRemoteUser({
                    sip_uid: fromUid,
                    callerName: data.callerName || 'Caller',
                    pendingOffer: data.offer
                });
                setCallState('RINGING');
                startRingtone();
                break;

            case 'call-answered':
                stopRingback();
                setCallState('CONNECTED');
                startCallTimer();
                if (pcRef.current && data.answer) {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    await flushIceCandidates();
                }
                break;

            case 'remote-ice-candidate':
                if (data.candidate) {
                    if (pcRef.current && pcRef.current.remoteDescription) {
                        try {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) {
                            console.warn('[WebRTC] Error adding received ICE candidate:', e);
                        }
                    } else {
                        iceCandidatesBufferRef.current.push(data.candidate);
                    }
                }
                break;

            case 'call-ended':
            case 'call-rejected':
                endCall();
                break;

            case 'call-error':
                Swal.fire('Call Failed', data.message || 'Unable to place call', 'error');
                endCall();
                break;

            case 'presence-update':
                if (data.uid) {
                    setOnlineUsers(prev => {
                        const next = new Set(prev);
                        if (data.status === 'online') next.add(data.uid);
                        else next.delete(data.uid);
                        return next;
                    });
                }
                break;

            case 'typing':
                if (fromUid) {
                    if (data.isTyping) {
                        setActiveTypingUsers(prev => new Set(prev).add(fromUid));
                        if (typingTimeoutsRef.current[fromUid]) clearTimeout(typingTimeoutsRef.current[fromUid]);
                        typingTimeoutsRef.current[fromUid] = setTimeout(() => {
                            setActiveTypingUsers(prev => {
                                const next = new Set(prev);
                                next.delete(fromUid);
                                return next;
                            });
                        }, 3500);
                    } else {
                        if (typingTimeoutsRef.current[fromUid]) clearTimeout(typingTimeoutsRef.current[fromUid]);
                        setActiveTypingUsers(prev => {
                            const next = new Set(prev);
                            next.delete(fromUid);
                            return next;
                        });
                    }
                }
                break;

            case 'chat-message':
                playMessageNotification();
                const currentActiveTarget = activeChatTargetRef.current;
                if (currentActiveTarget === fromUid) {
                    const newMsg = {
                        id: data.id || Date.now(),
                        sender_uid: fromUid,
                        receiver_uid: userRef.current?.sip_uid,
                        text: data.text,
                        created_at: data.created_at || new Date().toISOString()
                    };
                    setChatMessages(prev => [...(Array.isArray(prev) ? prev : []), newMsg]);
                    if (userRef.current?.sip_uid) {
                        api.markMessagesRead(userRef.current.sip_uid, fromUid);
                    }
                } else if (fromUid) {
                    setUnreadMessages(prev => ({
                        ...prev,
                        [fromUid]: (prev[fromUid] || 0) + 1
                    }));
                }
                loadConversations();
                break;

            case 'chat-message-ack':
                if (data.message) {
                    const msg = data.message;
                    const curTarget = activeChatTargetRef.current;
                    if (curTarget && (curTarget === msg.receiver_uid || curTarget === msg.sender_uid)) {
                        setChatMessages(prev => {
                            const list = Array.isArray(prev) ? prev : [];
                            if (list.some(m => m.id && m.id === msg.id)) return list;
                            return [...list, msg];
                        });
                    }
                    loadConversations();
                }
                break;

            default:
                break;
        }
    };

    // --- TYPING SIGNAL HELPER ---
    const sendTypingSignal = (targetUid, isTyping) => {
        sendSignal({
            type: 'typing',
            targetUid,
            isTyping
        });
    };

    const loadConversations = async () => {
        if (user && user.sip_uid) {
            const list = await api.getConversations(user.sip_uid);
            setConversations(Array.isArray(list) ? list : []);
        }
    };

    const loadContacts = async () => {
        if (user?.id || user?.sip_uid) {
            const c = await api.getContacts();
            const u = await api.getAllUsers();
            if (Array.isArray(c)) setContacts(c);
            if (Array.isArray(u)) setAllUsers(u);
        }
    };

    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user?.sip_uid]);

    // Name Resolution Helper
    const resolveContact = (uid) => {
        if (!uid) return 'Unknown';
        const str = String(uid).trim();
        if (user && String(user.sip_uid).trim() === str) {
            return user.full_name;
        }
        const foundContact = contactsRef.current.find(c => String(c.contact_uid).trim() === str);
        if (foundContact && foundContact.contact_name) {
            return foundContact.contact_name;
        }
        const foundConv = conversationsRef.current.find(c => String(c.peer_uid).trim() === str);
        if (foundConv && foundConv.peer_name && foundConv.peer_name !== str) {
            return foundConv.peer_name;
        }
        const foundUser = allUsersRef.current.find(u => String(u.sip_uid).trim() === str);
        if (foundUser && foundUser.full_name) {
            return foundUser.full_name;
        }
        return str;
    };

    // Send Chat Message via WebSocket or fallback REST
    const sendChatMessage = async (targetUid, text) => {
        if (!text || !text.trim() || !targetUid || !user) return;
        const cleanText = text.trim();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            sendSignal({
                type: 'chat-message',
                targetUid,
                text: cleanText
            });
        } else {
            const res = await api.sendMessage(user.sip_uid, targetUid, cleanText);
            const msgObj = res?.message || res;
            if (msgObj && msgObj.text) {
                setChatMessages(prev => [...(Array.isArray(prev) ? prev : []), msgObj]);
                loadConversations();
            }
        }
    };

    return (
        <WebRTCContext.Provider value={{
            isConnected,
            callState,
            remoteUser,
            callDuration,
            isMuted,
            isVideoOff,
            localVideoRef,
            remoteVideoRef,
            remoteAudioRef,
            availableCameras,
            activeCameraId,
            onlineUsers,
            unreadMessages,
            activeTypingUsers,
            activeChatTarget,
            chatMessages,
            conversations,
            contacts,
            allUsers,
            resolveContact,
            sendChatMessage,
            loadContacts,
            setActiveCameraId,
            loadCameraDevices,
            switchCamera,
            setActiveChatTarget,
            setChatMessages,
            setUnreadMessages,
            loadConversations,
            startCall,
            answerCall,
            rejectCall,
            hangupCall,
            toggleMute,
            toggleVideo,
            sendTypingSignal
        }}>
            {children}
        </WebRTCContext.Provider>
    );
};

export const useWebRTC = () => useContext(WebRTCContext);
