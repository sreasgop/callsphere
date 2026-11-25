import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, RefreshCw, Video, VideoOff } from 'lucide-react';
import { formatDuration } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ActiveCallStageProps {
  partnerName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callSeconds: number;
  isMuted: boolean;
  isVideoOn: boolean;
  videoDevices: MediaDeviceInfo[];
  onToggleMic: () => void;
  onToggleCam: () => void;
  onSwitchCamera: (deviceId?: string) => void;
  onHangup: () => void;
}

export function ActiveCallStage({
  partnerName,
  localStream,
  remoteStream,
  callSeconds,
  isMuted,
  isVideoOn,
  videoDevices,
  onToggleMic,
  onToggleCam,
  onSwitchCamera,
  onHangup,
}: ActiveCallStageProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [camModalOpen, setCamModalOpen] = useState(false);
  const [selectedCamId, setSelectedCamId] = useState('');

  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0);
  const hasLocalVideo = Boolean(
    localStream && localStream.getVideoTracks().length > 0 && isVideoOn,
  );

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleCameraSwitchClick = () => {
    if (videoDevices.length > 2) {
      setSelectedCamId(videoDevices[0]?.deviceId ?? '');
      setCamModalOpen(true);
    } else {
      onSwitchCamera();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050507] flex flex-col items-center justify-center overflow-hidden">
      {/* Remote Video or Audio-Only Monogram Stage */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${
          hasRemoteVideo ? 'block' : 'hidden'
        }`}
      />
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {!hasRemoteVideo ? (
        <div className="relative z-10 flex flex-col items-center">
          <div className="size-28 rounded-full bg-surface border border-border-strong flex items-center justify-center text-4xl font-semibold text-text-primary shadow-xl">
            {partnerName.charAt(0).toUpperCase()}
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            {remoteStream ? 'Audio Connected' : 'Connecting...'}
          </p>
        </div>
      ) : null}

      {/* Top Call Header */}
      <div className="absolute top-6 inset-x-0 z-20 text-center pointer-events-none px-4">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">
          {partnerName}
        </h2>
        <div className="mt-1 font-mono tabular-nums text-base text-text-secondary">
          {formatDuration(callSeconds)}
        </div>
      </div>

      {/* Local PiP Preview */}
      <div
        className={`absolute top-6 right-6 z-20 w-[140px] sm:w-[180px] h-[92px] sm:h-[112px] rounded-md overflow-hidden bg-surface border border-border-default shadow-2xl ${
          hasLocalVideo ? 'block' : 'hidden'
        }`}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      </div>

      {/* Floating Bottom Control Pill */}
      <div className="absolute bottom-8 z-20 flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface/90 backdrop-blur-md border border-border-default shadow-2xl">
        <button
          type="button"
          onClick={onToggleMic}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`size-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isMuted
              ? 'bg-danger text-white'
              : 'bg-elevated hover:bg-hover text-text-primary border border-border-subtle'
          }`}
        >
          {isMuted ? (
            <MicOff className="size-5" strokeWidth={1.5} />
          ) : (
            <Mic className="size-5" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCam}
          title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-label={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          className={`size-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            !isVideoOn
              ? 'bg-danger text-white'
              : 'bg-elevated hover:bg-hover text-text-primary border border-border-subtle'
          }`}
        >
          {isVideoOn ? (
            <Video className="size-5" strokeWidth={1.5} />
          ) : (
            <VideoOff className="size-5" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={handleCameraSwitchClick}
          title="Switch Camera"
          aria-label="Switch Camera"
          className="size-11 rounded-full bg-elevated hover:bg-hover text-text-primary border border-border-subtle flex items-center justify-center transition-colors cursor-pointer"
        >
          <RefreshCw className="size-5" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onHangup}
          title="End Call"
          aria-label="End Call"
          className="size-11 rounded-full bg-danger hover:bg-danger/90 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <PhoneOff className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <Modal
        open={camModalOpen}
        onClose={() => setCamModalOpen(false)}
        title="Select Camera Hardware"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCamModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCamId) onSwitchCamera(selectedCamId);
                setCamModalOpen(false);
              }}
            >
              Switch Camera
            </Button>
          </>
        }
      >
        <label className="text-xs font-medium text-text-secondary block mb-2">
          Available Cameras
        </label>
        <select
          value={selectedCamId}
          onChange={(e) => setSelectedCamId(e.target.value)}
          className="h-10 w-full bg-canvas border border-border-default rounded-sm px-3 text-sm text-text-primary outline-none focus:border-accent"
        >
          {videoDevices.map((d, idx) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
      </Modal>
    </div>
  );
}
