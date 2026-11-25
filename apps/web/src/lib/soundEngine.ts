const PREFS_KEY = 'callsphere_prefs';

const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ringInterval: number | null = null;
  public soundEnabled = true;
  public hapticsEnabled = true;

  constructor() {
    this.loadPrefs();
  }

  loadPrefs(): void {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { soundEnabled?: boolean; hapticsEnabled?: boolean };
      this.soundEnabled = parsed.soundEnabled ?? true;
      this.hapticsEnabled = parsed.hapticsEnabled ?? true;
    } catch {
      this.soundEnabled = true;
      this.hapticsEnabled = true;
    }
  }

  savePrefs(sound: boolean, haptics: boolean): void {
    this.soundEnabled = sound;
    this.hapticsEnabled = haptics;
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ soundEnabled: sound, hapticsEnabled: haptics }),
      );
    } catch {
      // Ignore storage quota issues for non-sensitive UI preferences
    }
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  triggerHaptic(ms = 15): void {
    if (!this.hapticsEnabled) return;
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  }

  playKeypadTone(key: string): void {
    this.triggerHaptic(18);
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const [f1, f2] = DTMF_FREQS[key] ?? [750, 1200];
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.frequency.value = f1;
    osc2.frequency.value = f2;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.11);
    osc2.stop(ctx.currentTime + 0.11);
  }

  playClick(): void {
    this.triggerHaptic(10);
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  }

  playMessageNotification(): void {
    this.triggerHaptic(50);
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes: Array<[number, number, number]> = [
      [880, now, 0.11],
      [1174.66, now + 0.1, 0.16],
    ];
    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    }
  }

  startRingtone(mode: 'incoming' | 'outbound'): void {
    this.stopRingtone();
    if (!this.soundEnabled) return;

    const playIncomingPattern = () => {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Double-ring telephone cadence (two 0.4s bursts)
      const bursts = [now, now + 0.55];
      for (const start of bursts) {
        for (const freq of [440, 480, 880]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = freq === 880 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, start);
          const peak = freq === 880 ? 0.14 : 0.35;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(peak, start + 0.02);
          gain.gain.setValueAtTime(peak, start + 0.34);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.43);
        }
      }
      this.triggerHaptic(250);
    };

    const playOutboundPattern = () => {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const freq of [440, 480]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
        gain.gain.setValueAtTime(0.16, now + 0.72);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.84);
      }
    };

    if (mode === 'incoming') {
      playIncomingPattern();
      this.ringInterval = window.setInterval(playIncomingPattern, 2200);
    } else {
      playOutboundPattern();
      this.ringInterval = window.setInterval(playOutboundPattern, 3000);
    }
  }

  stopRingtone(): void {
    if (this.ringInterval !== null) {
      window.clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
