/**
 * CallSphere Sound Engine & Haptics Manager
 * Uses Web Audio API for dual-tone DTMF keypad tones, UI clicks, telephone ringtones,
 * and navigator.vibrate for mobile haptic feedback.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.ringtoneInterval = null;
        this.soundEnabled = true;
        this.hapticsEnabled = true;
        this.loadPrefs();
    }

    loadPrefs() {
        const prefs = JSON.parse(localStorage.getItem('callsphere_prefs') || '{}');
        this.soundEnabled = prefs.soundEnabled !== undefined ? prefs.soundEnabled : true;
        this.hapticsEnabled = prefs.hapticsEnabled !== undefined ? prefs.hapticsEnabled : true;
    }

    savePrefs(sound, haptics) {
        this.soundEnabled = sound;
        this.hapticsEnabled = haptics;

        const current = JSON.parse(localStorage.getItem('callsphere_prefs') || '{}');
        current.soundEnabled = sound;
        current.hapticsEnabled = haptics;
        localStorage.setItem('callsphere_prefs', JSON.stringify(current));
    }

    initCtx() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playKeypadTone(key) {
        this.triggerHaptic(20);
        if (!this.soundEnabled) return;
        this.initCtx();
        if (!this.ctx) return;

        const dtmfFreqs = {
            '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
            '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
            '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
            '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
        };

        const freqs = dtmfFreqs[key] || [750, 1200];
        try {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.frequency.value = freqs[0];
            osc2.frequency.value = freqs[1];

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(this.ctx.currentTime + 0.12);
            osc2.stop(this.ctx.currentTime + 0.12);
        } catch (e) {
            console.warn('[SoundEngine] Keypad sound play error:', e);
        }
    }

    playClickSound() {
        this.triggerHaptic(12);
        if (!this.soundEnabled) return;
        this.initCtx();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(550, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.05);
        } catch (e) {}
    }

    triggerHaptic(ms = 18) {
        if (!this.hapticsEnabled) return;
        if (navigator.vibrate) {
            try {
                navigator.vibrate(ms);
            } catch (e) {}
        }
    }

    startIncomingRingtone() {
        if (!this.soundEnabled) return;
        this.stopRingtone();
        this.initCtx();
        if (!this.ctx) return;

        // Iconic iPhone Opening / Marimba Ringtone Note Frequencies & Durations
        const iphoneMelody = [
            { note: 659.25, dur: 0.13 }, // E5
            { note: 783.99, dur: 0.13 }, // G5
            { note: 880.00, dur: 0.13 }, // A5
            { note: 987.77, dur: 0.13 }, // B5
            { note: 1046.50, dur: 0.26 }, // C6
            { note: 987.77, dur: 0.13 }, // B5
            { note: 880.00, dur: 0.13 }, // A5
            { note: 783.99, dur: 0.26 }, // G5

            { note: 659.25, dur: 0.13 }, // E5
            { note: 783.99, dur: 0.13 }, // G5
            { note: 880.00, dur: 0.13 }, // A5
            { note: 1046.50, dur: 0.13 }, // C6
            { note: 1174.66, dur: 0.26 }, // D6
            { note: 1046.50, dur: 0.13 }, // C6
            { note: 987.77, dur: 0.13 }, // B5
            { note: 880.00, dur: 0.38 }  // A5
        ];

        const playIphoneRingLoop = () => {
            if (!this.ctx) return;
            let startTime = this.ctx.currentTime + 0.05;

            iphoneMelody.forEach(({ note, dur }) => {
                try {
                    // Primary Marimba fundamental tone
                    const osc1 = this.ctx.createOscillator();
                    // Harmonic overtone resonance for signature wood block timbre
                    const osc2 = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc1.type = 'triangle';
                    osc2.type = 'sine';

                    osc1.frequency.setValueAtTime(note, startTime);
                    osc2.frequency.setValueAtTime(note * 2, startTime);

                    gain.gain.setValueAtTime(0.30, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur + 0.08);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc1.start(startTime);
                    osc2.start(startTime);
                    osc1.stop(startTime + dur + 0.08);
                    osc2.stop(startTime + dur + 0.08);
                } catch (e) {}

                startTime += dur;
            });
        };

        playIphoneRingLoop();
        this.ringtoneInterval = setInterval(playIphoneRingLoop, 3200);
        this.triggerHaptic([200, 100, 200, 100, 400]);
    }

    startOutboundRingtone() {
        if (!this.soundEnabled) return;
        this.stopRingtone();
        this.initCtx();
        if (!this.ctx) return;

        const playRingbackBurst = () => {
            if (!this.ctx) return;
            try {
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc1.frequency.value = 440;
                osc2.frequency.value = 480;

                gain.gain.setValueAtTime(0, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.05);
                gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1.2);
                gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.4);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.ctx.destination);

                osc1.start();
                osc2.start();
                osc1.stop(this.ctx.currentTime + 1.4);
                osc2.stop(this.ctx.currentTime + 1.4);
            } catch (e) {}
        };

        playRingbackBurst();
        this.ringtoneInterval = setInterval(playRingbackBurst, 3000);
    }

    playMessageNotification() {
        this.triggerHaptic([40, 50, 40]);
        if (!this.soundEnabled) return;
        this.initCtx();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            // First chime note (E6 - 1318.5Hz)
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1318.5, now);
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

            // Second chime note (B6 - 1975.5Hz, offset by 80ms)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1975.5, now + 0.08);
            gain2.gain.setValueAtTime(0.15, now + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.28);
        } catch (e) {
            console.warn('[SoundEngine] Message notification sound error:', e);
        }
    }

    stopRingtone() {
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
    }
}

window.soundEngine = new SoundEngine();
