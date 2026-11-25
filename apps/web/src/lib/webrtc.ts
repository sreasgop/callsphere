import type { Socket } from 'socket.io-client';
import { api } from './api';

export class WebRTCController {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private currentFacingMode: 'user' | 'environment' = 'user';
  public targetUid: string | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly onRemoteStream: (stream: MediaStream) => void,
    private readonly onConnectionClosed: () => void,
  ) {}

  async getLocalMedia(withVideo = true, deviceId?: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera and microphone require HTTPS or localhost');
    }

    const videoConstraint: boolean | MediaTrackConstraints = withVideo
      ? deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: this.currentFacingMode }
      : false;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoConstraint,
      });
      return this.localStream;
    } catch {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return this.localStream;
    }
  }

  private async createPeerConnection(targetUid: string): Promise<RTCPeerConnection> {
    let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    try {
      const res = await api.getIceServers();
      if (res.ice_servers.length > 0) {
        iceServers = res.ice_servers;
      }
    } catch {
      // Fallback to public STUN if ICE endpoint is temporarily unreachable
    }

    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 6 });
    this.pc = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      this.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('call:ice', {
          target_uid: targetUid,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanup();
        this.onConnectionClosed();
      }
    };

    return pc;
  }

  async startCall(targetUid: string, withVideo = true, deviceId?: string): Promise<MediaStream> {
    this.targetUid = targetUid;
    this.pendingIce = [];

    const stream = await this.getLocalMedia(withVideo, deviceId);
    const pc = await this.createPeerConnection(targetUid);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    this.socket.emit('call:offer', {
      target_uid: targetUid,
      offer,
    });

    return stream;
  }

  async answerCall(
    fromUid: string,
    offer: RTCSessionDescriptionInit,
    withVideo = true,
    deviceId?: string,
  ): Promise<MediaStream> {
    this.targetUid = fromUid;
    const stream = await this.getLocalMedia(withVideo, deviceId);
    const pc = await this.createPeerConnection(fromUid);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushIce();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit('call:answer', {
      target_uid: fromUid,
      answer,
    });

    return stream;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushIce();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.pc && this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      this.pendingIce.push(candidate);
    }
  }

  private async flushIce(): Promise<void> {
    if (!this.pc) return;
    while (this.pendingIce.length > 0) {
      const candidate = this.pendingIce.shift()!;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidate
      }
    }
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }

  toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  async enumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  async switchCamera(deviceId?: string): Promise<MediaStream | null> {
    if (!this.localStream || !this.pc) return null;
    const prevTrack = this.localStream.getVideoTracks()[0];
    if (prevTrack) {
      prevTrack.stop();
      this.localStream.removeTrack(prevTrack);
    }

    if (!deviceId) {
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    }

    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: this.currentFacingMode },
      audio: false,
    });
    const nextTrack = nextStream.getVideoTracks()[0];
    if (!nextTrack) return this.localStream;

    this.localStream.addTrack(nextTrack);
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(nextTrack);
    } else {
      this.pc.addTrack(nextTrack, this.localStream);
    }
    return this.localStream;
  }

  endCall(): void {
    if (this.targetUid) {
      this.socket.emit('call:end', { target_uid: this.targetUid });
    }
    this.cleanup();
  }

  rejectCall(fromUid: string): void {
    this.socket.emit('call:reject', { target_uid: fromUid });
    this.cleanup();
  }

  cleanup(): void {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.targetUid = null;
    this.pendingIce = [];
  }
}
