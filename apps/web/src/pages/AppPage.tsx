import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import {
  api,
  type BlockedItem,
  type CallLogItem,
  type ContactItem,
  type GroupItem,
  type UserProfile,
} from '../lib/api';
import { createSignalingSocket, type ConnectionState } from '../lib/socket';
import { soundEngine } from '../lib/soundEngine';
import { e2eeClient } from '../lib/cryptoClient';
import { WebRTCController } from '../lib/webrtc';
import { ActiveCallStage } from '../components/app/ActiveCallStage';
import { AppShell, type AppTab } from '../components/app/AppShell';
import { ChatView } from '../components/app/ChatView';
import { ContactsView } from '../components/app/ContactsView';
import { DialerView } from '../components/app/DialerView';
import { GroupsView } from '../components/app/GroupsView';
import { IncomingCallOverlay } from '../components/app/IncomingCallOverlay';
import { RecentsView } from '../components/app/RecentsView';
import { SettingsView } from '../components/app/SettingsView';
import { useToast } from '../components/ui/Toast';

interface AppPageProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLoggedOut: () => void;
}

interface PendingIncoming {
  fromUid: string;
  callerName: string;
  offer: RTCSessionDescriptionInit;
}

export function AppPage({ user, onUserUpdated, onLoggedOut }: AppPageProps) {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<AppTab>('dialer');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);
  const [calls, setCalls] = useState<CallLogItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatTargetUid, setChatTargetUid] = useState<string | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // Active & Incoming Call State (isolated from tab lists)
  const [incomingCall, setIncomingCall] = useState<PendingIncoming | null>(null);
  const [inCallPartner, setInCallPartner] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const rtcRef = useRef<WebRTCController | null>(null);
  const timerRef = useRef<number | null>(null);
  const callTargetRef = useRef<string | null>(null);
  const callStartedAtRef = useRef<number | null>(null);

  const resolveName = useCallback(
    (uid: string, hint?: string) => {
      const contact = contacts.find((c) => c.contact_uid === uid);
      if (contact) return { name: contact.contact_name, saved: true };
      return { name: hint || uid, saved: false };
    },
    [contacts],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallSeconds(0);
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    callStartedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const resetCallUI = useCallback(() => {
    soundEngine.stopRingtone();
    stopTimer();
    setIncomingCall(null);
    setInCallPartner(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOn(true);
    callTargetRef.current = null;
    callStartedAtRef.current = null;
  }, [stopTimer]);

  const refreshAll = useCallback(async () => {
    try {
      const [cRes, bRes, hRes, gRes] = await Promise.all([
        api.getContacts(),
        api.getBlocked(),
        api.getCallHistory(),
        api.getGroups(),
      ]);
      setContacts(cRes.contacts);
      setBlocked(bRes.blocked);
      setCalls(hRes.calls);
      setGroups(gRes.groups);
    } catch {
      // Errors handled individually on mutations
    } finally {
      setLoadingData(false);
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    const [cRes, bRes] = await Promise.all([api.getContacts(), api.getBlocked()]);
    setContacts(cRes.contacts);
    setBlocked(bRes.blocked);
  }, []);

  const refreshGroups = useCallback(async () => {
    const gRes = await api.getGroups();
    setGroups(gRes.groups);
  }, []);

  const refreshRecents = useCallback(async () => {
    const hRes = await api.getCallHistory();
    setCalls(hRes.calls);
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void e2eeClient
      .ensureIdentity(user.uid)
      .then((pubJwk) => api.publishPublicKey(pubJwk))
      .catch(() => {});
  }, [user.uid]);

  useEffect(() => {
    const socket = createSignalingSocket();
    socketRef.current = socket;
    setSocketInstance(socket);

    const rtc = new WebRTCController(
      socket,
      (stream) => {
        soundEngine.stopRingtone();
        setRemoteStream(stream);
      },
      () => {
        resetCallUI();
      },
    );
    rtcRef.current = rtc;

    void rtc.enumerateVideoDevices().then(setVideoDevices);

    socket.on('connect', () => setConnectionState('online'));
    socket.on('disconnect', () => setConnectionState('offline'));
    socket.on('connect_error', () => setConnectionState('offline'));

    socket.on('presence:update', () => {
      void refreshContacts();
    });

    socket.on(
      'call:incoming',
      (data: { from_uid: string; caller_name?: string; offer: RTCSessionDescriptionInit }) => {
        soundEngine.startRingtone('incoming');
        setIncomingCall({
          fromUid: data.from_uid,
          callerName: data.caller_name || data.from_uid,
          offer: data.offer,
        });
      },
    );

    socket.on('call:answered', async (data: { answer: RTCSessionDescriptionInit }) => {
      soundEngine.stopRingtone();
      await rtc.handleAnswer(data.answer);
      startTimer();
    });

    socket.on('call:ice', async (data: { candidate: RTCIceCandidateInit }) => {
      await rtc.handleIceCandidate(data.candidate);
    });

    socket.on('call:ended', () => {
      rtc.cleanup();
      resetCallUI();
      notify('Call ended', 'info');
      void refreshRecents();
    });

    socket.on('call:rejected', () => {
      rtc.cleanup();
      resetCallUI();
      notify('Call declined', 'warn');
      void refreshRecents();
    });

    socket.on('call:error', (data: { message?: string }) => {
      rtc.cleanup();
      resetCallUI();
      notify(data.message || 'Call could not be connected', 'danger');
    });

    socket.on('chat:message', () => {
      soundEngine.playMessageNotification();
      setUnreadChatCount((prev) => prev + 1);
    });

    socket.on('call:cancelled', () => {
      soundEngine.stopRingtone();
      setIncomingCall(null);
    });

    const heartbeat = window.setInterval(() => {
      if (socket.connected) {
        socket.emit('presence:heartbeat');
      }
    }, 45000);

    return () => {
      window.clearInterval(heartbeat);
      rtc.cleanup();
      socket.disconnect();
      stopTimer();
    };
  }, [notify, refreshContacts, refreshRecents, resetCallUI, startTimer, stopTimer]);

  const handleStartCall = useCallback(
    async (targetUid: string, nameHint?: string) => {
      const rtc = rtcRef.current;
      if (!rtc) return;

      const resolved = resolveName(targetUid, nameHint);
      setInCallPartner(resolved.name);
      callTargetRef.current = targetUid;
      soundEngine.startRingtone('outbound');

      try {
        const stream = await rtc.startCall(targetUid, true, selectedCameraId || undefined);
        setLocalStream(stream);
        setIsVideoOn(stream.getVideoTracks().length > 0);
      } catch (err) {
        rtc.cleanup();
        resetCallUI();
        notify(err instanceof Error ? err.message : 'Could not start call', 'danger');
      }
    },
    [notify, resetCallUI, resolveName, selectedCameraId],
  );

  const handleAcceptIncoming = async () => {
    if (!incomingCall || !rtcRef.current) return;
    soundEngine.stopRingtone();
    const { fromUid, callerName, offer } = incomingCall;
    const resolved = resolveName(fromUid, callerName);
    setIncomingCall(null);
    setInCallPartner(resolved.name);
    callTargetRef.current = fromUid;

    try {
      const stream = await rtcRef.current.answerCall(
        fromUid,
        offer,
        true,
        selectedCameraId || undefined,
      );
      setLocalStream(stream);
      setIsVideoOn(stream.getVideoTracks().length > 0);
      startTimer();
    } catch (err) {
      rtcRef.current.cleanup();
      resetCallUI();
      notify(err instanceof Error ? err.message : 'Could not answer call', 'danger');
    }
  };

  const handleRejectIncoming = () => {
    if (!incomingCall || !rtcRef.current) return;
    rtcRef.current.rejectCall(incomingCall.fromUid);
    void api.logCall(incomingCall.fromUid, 'declined', 0).catch(() => {});
    resetCallUI();
    void refreshRecents();
  };

  const handleHangup = () => {
    const target = callTargetRef.current;
    const duration = callStartedAtRef.current
      ? Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000))
      : 0;
    rtcRef.current?.endCall();
    resetCallUI();
    if (target) {
      void api
        .logCall(target, duration > 0 ? 'completed' : 'missed', duration)
        .then(refreshRecents)
        .catch(() => {});
    }
  };

  const handleLogout = async () => {
    await api.logout();
    onLoggedOut();
    navigate('/auth');
  };

  const incomingResolved = incomingCall
    ? resolveName(incomingCall.fromUid, incomingCall.callerName)
    : null;

  return (
    <>
      <AppShell
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionState={connectionState}
        unreadChatCount={unreadChatCount}
      >
        {activeTab === 'dialer' ? (
          <DialerView contacts={contacts} onStartCall={handleStartCall} />
        ) : null}

        {activeTab === 'recents' ? (
          <RecentsView
            calls={calls}
            contacts={contacts}
            loading={loadingData}
            onStartCall={handleStartCall}
            onContactAdded={refreshContacts}
          />
        ) : null}

        {activeTab === 'chat' ? (
          <ChatView
            myUid={user.uid}
            contacts={contacts}
            socket={socketInstance}
            initialPeerUid={chatTargetUid}
            onStartCall={handleStartCall}
            onUnreadChange={setUnreadChatCount}
          />
        ) : null}

        {activeTab === 'contacts' ? (
          <ContactsView
            contacts={contacts}
            blocked={blocked}
            loading={loadingData}
            onRefresh={refreshContacts}
            onStartCall={handleStartCall}
            onOpenChat={(uid) => {
              setChatTargetUid(uid);
              setActiveTab('chat');
            }}
          />
        ) : null}

        {activeTab === 'groups' ? (
          <GroupsView
            groups={groups}
            contacts={contacts}
            myUid={user.uid}
            loading={loadingData}
            onRefresh={refreshGroups}
            onStartCall={handleStartCall}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <SettingsView
            user={user}
            videoDevices={videoDevices}
            selectedCameraId={selectedCameraId}
            onSelectCamera={setSelectedCameraId}
            onUserUpdated={onUserUpdated}
            onLogout={handleLogout}
          />
        ) : null}
      </AppShell>

      {incomingCall && incomingResolved ? (
        <IncomingCallOverlay
          callerName={incomingResolved.name}
          fromUid={incomingCall.fromUid}
          isSavedContact={incomingResolved.saved}
          onAccept={() => void handleAcceptIncoming()}
          onReject={handleRejectIncoming}
        />
      ) : null}

      {inCallPartner ? (
        <ActiveCallStage
          partnerName={inCallPartner}
          localStream={localStream}
          remoteStream={remoteStream}
          callSeconds={callSeconds}
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          videoDevices={videoDevices}
          onToggleMic={() => {
            soundEngine.playClick();
            if (rtcRef.current) setIsMuted(rtcRef.current.toggleMute());
          }}
          onToggleCam={() => {
            soundEngine.playClick();
            if (rtcRef.current) setIsVideoOn(rtcRef.current.toggleVideo());
          }}
          onSwitchCamera={(deviceId) => {
            soundEngine.playClick();
            void rtcRef.current?.switchCamera(deviceId).then((s) => {
              if (s) setLocalStream(s);
            });
          }}
          onHangup={handleHangup}
        />
      ) : null}
    </>
  );
}
