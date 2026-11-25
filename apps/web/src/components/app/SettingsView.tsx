import { useState } from 'react';
import { Camera, Check, Copy, LogOut, ShieldCheck, UserCheck, Volume2 } from 'lucide-react';
import { api, type PrivacyMode, type UserProfile } from '../../lib/api';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

interface SettingsViewProps {
  user: UserProfile;
  videoDevices: MediaDeviceInfo[];
  selectedCameraId: string;
  onSelectCamera: (deviceId: string) => void;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => Promise<void>;
}

const PRIVACY_OPTIONS: Array<{ value: PrivacyMode; label: string; desc: string }> = [
  { value: 'everyone', label: 'Allow Everyone', desc: 'Any valid 10-digit UID can ring your line' },
  {
    value: 'contacts_only',
    label: 'Contacts Only',
    desc: 'Only saved contacts can initiate calls to you',
  },
  { value: 'dnd', label: 'Do Not Disturb', desc: 'Reject all incoming call offers automatically' },
];

export function SettingsView({
  user,
  videoDevices,
  selectedCameraId,
  onSelectCamera,
  onUserUpdated,
  onLogout,
}: SettingsViewProps) {
  const { notify } = useToast();
  const [privacy, setPrivacy] = useState<PrivacyMode>(user.privacy_mode);
  const [soundEnabled, setSoundEnabled] = useState(soundEngine.soundEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState(soundEngine.hapticsEnabled);
  const [saving, setSaving] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const supportsHaptics = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const handleCopyUid = () => {
    soundEngine.playClick();
    void navigator.clipboard?.writeText(user.uid);
    setCopiedUid(true);
    notify('UID copied to clipboard', 'success');
    window.setTimeout(() => setCopiedUid(false), 1500);
  };

  const handleSave = async () => {
    soundEngine.playClick();
    setSaving(true);
    try {
      await api.updateSettings(privacy, user.status_message);
      soundEngine.savePrefs(soundEnabled, hapticsEnabled);
      onUserUpdated({ ...user, privacy_mode: privacy });
      notify('Control center preferences saved', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[720px] mx-auto space-y-5">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">Control Center</h2>

      {/* Account Identity */}
      <section className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <UserCheck className="size-4 text-accent" strokeWidth={1.5} />
          <span>Account Identity</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border-subtle text-sm">
          <span className="text-text-secondary">Display Name</span>
          <span className="text-text-primary font-medium">{user.full_name}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border-subtle text-sm">
          <span className="text-text-secondary">UID (Universal ID)</span>
          <button
            type="button"
            onClick={handleCopyUid}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-elevated hover:bg-hover border border-border-default font-mono tabular-nums text-text-primary cursor-pointer transition-colors"
          >
            <span>{formatUidDisplay(user.uid)}</span>
            {copiedUid ? (
              <Check className="size-3.5 text-online" strokeWidth={1.75} />
            ) : (
              <Copy className="size-3.5 text-text-muted" strokeWidth={1.5} />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="text-text-secondary">Registered Email</span>
          <span className="text-text-primary truncate ml-4">{user.email}</span>
        </div>
      </section>

      {/* Camera & Media Hardware */}
      <section className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Camera className="size-4 text-accent" strokeWidth={1.5} />
          <span>Camera & Media Hardware</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">Active Camera Device</span>
          <select
            value={selectedCameraId}
            onChange={(e) => onSelectCamera(e.target.value)}
            className="h-9 bg-canvas border border-border-default rounded-sm px-3 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">Default Camera</option>
            {videoDevices.map((d, idx) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Audio & Sound Effects */}
      <section className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Volume2 className="size-4 text-accent" strokeWidth={1.5} />
          <span>Audio & Sound Effects</span>
        </div>

        <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
          <span className="text-sm text-text-secondary">Sound Effects & Ringtone</span>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="size-4 accent-accent cursor-pointer"
          />
        </label>

        {supportsHaptics ? (
          <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
            <span className="text-sm text-text-secondary">Haptic Feedback (Vibration)</span>
            <input
              type="checkbox"
              checked={hapticsEnabled}
              onChange={(e) => setHapticsEnabled(e.target.checked)}
              className="size-4 accent-accent cursor-pointer"
            />
          </label>
        ) : null}
      </section>

      {/* Privacy Rules */}
      <section className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ShieldCheck className="size-4 text-online" strokeWidth={1.5} />
          <span>Privacy Rules</span>
        </div>
        <div className="space-y-2">
          {PRIVACY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                privacy === opt.value
                  ? 'bg-accent-muted border-accent-border'
                  : 'bg-canvas border-border-subtle hover:border-border-default'
              }`}
            >
              <input
                type="radio"
                name="privacy_mode"
                value={opt.value}
                checked={privacy === opt.value}
                onChange={() => setPrivacy(opt.value)}
                className="mt-1 accent-accent cursor-pointer"
              />
              <div>
                <div className="text-sm font-medium text-text-primary">{opt.label}</div>
                <div className="text-xs text-text-muted">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Check className="size-4" strokeWidth={1.75} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      {/* Security Zone */}
      <section className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-text-primary">Email 2FA (OTP)</div>
            <div className="text-xs text-text-secondary">
              Require a 6-digit email verification code when signing in.
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(user.two_factor_enabled)}
            onChange={(e) => {
              const next = e.target.checked;
              void api
                .toggleTwoFactor(next)
                .then((res) => {
                  onUserUpdated({ ...user, two_factor_enabled: res.two_factor_enabled });
                  notify(
                    res.two_factor_enabled ? 'Email 2FA enabled' : 'Email 2FA disabled',
                    'success',
                  );
                })
                .catch((err) => {
                  notify(err instanceof Error ? err.message : 'Failed to update 2FA', 'danger');
                });
            }}
            className="size-4 accent-accent cursor-pointer"
          />
        </div>

        <div className="pt-4 border-t border-border-subtle space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-danger">
            <LogOut className="size-4" strokeWidth={1.5} />
            <span>Account Session</span>
          </div>
          <p className="text-xs text-text-secondary">
            Sign out of your CallSphere session on this device and clear authentication cookies.
          </p>
          <Button variant="danger" onClick={() => void onLogout()} className="w-full sm:w-auto">
            <LogOut className="size-4" strokeWidth={1.5} />
            Log Out of CallSphere
          </Button>
        </div>
      </section>
    </div>
  );
}
