/**
 * CallSphere WebRTC & WebSockets Client Engine (Production Ready)
 * Handles peer connections, STUN server configuration, media streams, ICE candidate buffering,
 * and robust cross-platform mobile/desktop audio-video call signaling.
 */

class WebRTCManager {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCallUid = null;
        this.myUid = null;
        this.myName = null;
        this.callTimerInterval = null;
        this.callSeconds = 0;
        this.remoteIceCandidatesBuffer = [];

        // Public STUN & TURN relay configuration for Cross-Network & Carrier 4G/5G Traversal Outside LAN
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:openrelay.metered.ca:80' },
                {
                    urls: [
                        'turn:openrelay.metered.ca:80',
                        'turn:openrelay.metered.ca:443',
                        'turn:openrelay.metered.ca:443?transport=tcp',
                        'turns:openrelay.metered.ca:443',
                        'turns:openrelay.metered.ca:443?transport=tcp'
                    ],
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10
        };

        // Event callbacks
        this.onIncomingCall = null;
        this.onCallAnswered = null;
        this.onCallEnded = null;
        this.onCallError = null;
        this.onRemoteStreamAdded = null;
        this.onPresenceUpdate = null;
        this.onChatMessage = null;
    }

    /**
     * Initializes the WebSockets signaling connection for a registered 10-digit UID
     */
    connectSocket(uid, name = 'User') {
        this.myUid = uid;
        this.myName = name;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;

        const wsUrl = `${wsProtocol}//${host}/ws/${uid}`;
        console.log(`[CallSphere WebSockets] Connecting to ${wsUrl}...`);

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log(`[CallSphere WebSockets] Connected successfully as UID ${uid}`);
        };

        this.socket.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[CallSphere WebSockets] Received Event:', data.type, data);
                await this.handleSocketEvent(data);
            } catch (err) {
                console.error('[CallSphere WebSockets] Message Parsing Error:', err);
            }
        };

        this.socket.onclose = () => {
            console.warn('[CallSphere WebSockets] Disconnected. Reconnecting in 3s...');
            setTimeout(() => this.connectSocket(uid, name), 3000);
        };

        this.socket.onerror = (err) => {
            console.error('[CallSphere WebSockets] Socket Error:', err);
        };
    }

    async handleSocketEvent(data) {
        switch (data.type) {
            case 'incoming-call':
                this.currentCallUid = data.from;
                this.remoteIceCandidatesBuffer = [];
                if (this.onIncomingCall) {
                    this.onIncomingCall({
                        fromUid: data.from,
                        callerName: data.callerName || 'Unknown Caller',
                        offer: data.offer
                    });
                }
                break;

            case 'call-answered':
                if (this.peerConnection && data.answer) {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    await this.flushIceCandidates();
                    this.startCallTimer();
                    if (this.onCallAnswered) this.onCallAnswered(data);
                }
                break;

            case 'remote-ice-candidate':
                if (data.candidate) {
                    if (this.peerConnection && this.peerConnection.remoteDescription) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) {
                            console.warn('[WebRTC] Error adding received ICE candidate:', e);
                        }
                    } else {
                        // Buffer candidate until remote description is set
                        this.remoteIceCandidatesBuffer.push(data.candidate);
                    }
                }
                break;

            case 'call-ended':
            case 'call-rejected':
                this.cleanupCall();
                if (this.onCallEnded) this.onCallEnded(data);
                break;

            case 'call-error':
                if (this.onCallError) this.onCallError(data.message);
                this.cleanupCall();
                break;

            case 'presence-update':
                if (this.onPresenceUpdate) this.onPresenceUpdate(data);
                break;

            case 'chat-message':
            case 'chat-message-ack':
            case 'typing':
                if (this.onChatMessage) this.onChatMessage(data);
                break;
        }
    }

    async flushIceCandidates() {
        if (!this.peerConnection) return;
        while (this.remoteIceCandidatesBuffer.length > 0) {
            const candidate = this.remoteIceCandidatesBuffer.shift();
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
            }
        }
    }

    /**
     * Cross-platform getUserMedia with fallback for mobile devices and non-camera environments
     */
    async getLocalMedia(videoEnabled = true) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (!legacyGetUserMedia) {
                const isUnsecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
                if (isUnsecure) {
                    throw new Error("Mobile security restriction: Camera & Microphone require HTTPS when accessed over LAN IP. Please launch server with HTTPS.");
                }
                throw new Error("Your browser does not support audio/video calling media API.");
            }
        }

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: videoEnabled ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                } : false
            });
            return this.localStream;
        } catch (err) {
            console.warn('[WebRTC] Video media capture failed or denied, trying Audio-only:', err);
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                return this.localStream;
            } catch (audioErr) {
                console.error('[WebRTC] Microphone access denied or unavailable:', audioErr);
                throw new Error("Microphone permission denied. Please allow microphone access in your browser.");
            }
        }
    }

    createPeerConnection(targetUid) {
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Add local tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Add transceivers for robust bi-directional audio and video
        try {
            this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
            if (this.localStream && this.localStream.getVideoTracks().length > 0) {
                this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
            }
        } catch (e) {
            console.warn('[WebRTC] Transceiver setup note:', e);
        }

        // Handle remote stream tracks
        this.peerConnection.ontrack = (event) => {
            console.log('[WebRTC] Received Remote Track:', event.track.kind, event.streams);
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
            } else {
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                }
                this.remoteStream.addTrack(event.track);
            }

            if (this.onRemoteStreamAdded) {
                this.onRemoteStreamAdded(this.remoteStream);
            }
        };

        // Send local ICE candidates to remote peer via WebSockets
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'send-ice',
                    targetUid: targetUid,
                    candidate: event.candidate
                }));
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection State:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'failed') {
                this.cleanupCall();
            }
        };
    }

    async startCall(targetUid, withVideo = true) {
        this.currentCallUid = targetUid;
        this.remoteIceCandidatesBuffer = [];

        await this.getLocalMedia(withVideo);
        this.createPeerConnection(targetUid);

        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        await this.peerConnection.setLocalDescription(offer);

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'make-offer',
                targetUid: targetUid,
                callerUid: this.myUid,
                callerName: this.myName,
                offer: offer
            }));
        } else {
            throw new Error("Signaling socket is disconnected");
        }
    }

    async answerCall(incomingOffer, withVideo = true) {
        await this.getLocalMedia(withVideo);
        this.createPeerConnection(this.currentCallUid);

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        await this.flushIceCandidates();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'make-answer',
                targetUid: this.currentCallUid,
                answer: answer
            }));
        }

        this.startCallTimer();
    }

    rejectCall(targetUid) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'reject-call',
                targetUid: targetUid || this.currentCallUid
            }));
        }
        this.cleanupCall();
    }

    endCall() {
        if (this.currentCallUid && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'end-call',
                targetUid: this.currentCallUid
            }));
        }
        this.cleanupCall();
    }

    sendTypingSignal(targetUid, isTyping) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'typing',
                targetUid: targetUid,
                isTyping: isTyping
            }));
        }
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return !audioTrack.enabled;
            }
        }
        return false;
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }

    startCallTimer() {
        this.stopCallTimer();
        this.callSeconds = 0;
        this.callTimerInterval = setInterval(() => {
            this.callSeconds++;
            const timerEl = document.getElementById('call-timer');
            if (timerEl) {
                const mins = Math.floor(this.callSeconds / 60).toString().padStart(2, '0');
                const secs = (this.callSeconds % 60).toString().padStart(2, '0');
                timerEl.textContent = `${mins}:${secs}`;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
    }

    async enumerateVideoDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'videoinput');
        } catch (e) {
            console.warn('[WebRTC] Could not enumerate video devices:', e);
            return [];
        }
    }

    async switchCamera(deviceId = null) {
        if (!this.localStream || !this.peerConnection) return false;

        const currentVideoTrack = this.localStream.getVideoTracks()[0];
        if (currentVideoTrack) {
            currentVideoTrack.stop();
            this.localStream.removeTrack(currentVideoTrack);
        }

        // Toggle facingMode if deviceId not provided
        if (!deviceId) {
            this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        } else {
            this.currentCameraDeviceId = deviceId;
        }

        const videoConstraints = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: this.currentFacingMode };

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (newVideoTrack) {
                this.localStream.addTrack(newVideoTrack);

                // Update sender on peer connection
                const videoSender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                } else {
                    this.peerConnection.addTrack(newVideoTrack, this.localStream);
                }

                // Update local video element
                const localVideo = document.getElementById('local-video');
                if (localVideo) localVideo.srcObject = this.localStream;

                return true;
            }
        } catch (err) {
            console.error('[WebRTC] Switch camera error:', err);
            // Fallback to original user camera
            await this.getLocalMedia(true);
        }
        return false;
    }

    cleanupCall() {
        this.stopCallTimer();

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;
        this.currentCallUid = null;
        this.remoteIceCandidatesBuffer = [];
    }
}

window.WebRTCManager = WebRTCManager;