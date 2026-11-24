import React, { createContext, useContext, useState, useRef } from 'react';

const SoundContext = createContext();

export const SoundProvider = ({ children }) => {
    const audioCtxRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);
    const ringbackIntervalRef = useRef(null);

    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('callsphere_sound_enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [hapticsEnabled, setHapticsEnabled] = useState(() => {
        const saved = localStorage.getItem('callsphere_haptics_enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const updatePreferences = (sound, haptics) => {
        setSoundEnabled(sound);
        setHapticsEnabled(haptics);
        localStorage.setItem('callsphere_sound_enabled', JSON.stringify(sound));
        localStorage.setItem('callsphere_haptics_enabled', JSON.stringify(haptics));
    };

    const getAudioContext = () => {
        if (!soundEnabled) return null;
        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtxRef.current = new AudioContextClass();
            }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    };

    const triggerHaptic = (pattern = 30) => {
        if (!hapticsEnabled) return;
        if ('vibrate' in navigator) {
            try { navigator.vibrate(pattern); } catch (e) {}
        }
    };

    const playClickSound = () => {
        triggerHaptic(20);
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch (e) {}
    };

    const playKeyTone = (freq1 = 697, freq2 = 1209) => {
        triggerHaptic(30);
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;
        try {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
            osc2.frequency.setValueAtTime(freq2, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    };

    const startRingtone = () => {
        stopRingtone();
        stopRingback();
        triggerHaptic([300, 200, 300, 200, 500]);
        if (!soundEnabled) return;
        const playChime = () => {
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const now = ctx.currentTime;
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                osc1.type = 'sine';
                osc2.type = 'triangle';
                osc1.frequency.setValueAtTime(523.25, now); // C5
                osc1.frequency.setValueAtTime(659.25, now + 0.15); // E5
                osc1.frequency.setValueAtTime(783.99, now + 0.3); // G5
                osc1.frequency.setValueAtTime(1046.50, now + 0.45); // C6
                osc2.frequency.setValueAtTime(261.63, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.85);
                osc2.stop(now + 0.85);
            } catch (e) {}
        };
        playChime();
        ringtoneIntervalRef.current = setInterval(playChime, 1800);
    };

    const stopRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
    };

    const startRingback = () => {
        stopRingback();
        stopRingtone();
        if (!soundEnabled) return;
        const playTone = () => {
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const now = ctx.currentTime;
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(440, now);
                osc2.frequency.setValueAtTime(480, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.setValueAtTime(0.08, now + 1.2);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 1.3);
                osc2.stop(now + 1.3);
            } catch (e) {}
        };
        playTone();
        ringbackIntervalRef.current = setInterval(playTone, 3500);
    };

    const stopRingback = () => {
        if (ringbackIntervalRef.current) {
            clearInterval(ringbackIntervalRef.current);
            ringbackIntervalRef.current = null;
        }
    };

    const playMessageNotification = () => {
        triggerHaptic([40, 50, 40]);
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(1318.51, now); // E6
            osc2.frequency.setValueAtTime(1975.53, now + 0.08); // B6
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start(now);
            osc2.start(now + 0.08);
            osc1.stop(now + 0.12);
            osc2.stop(now + 0.28);
        } catch (e) {}
    };

    return (
        <SoundContext.Provider value={{
            soundEnabled,
            hapticsEnabled,
            updatePreferences,
            getAudioContext,
            playClickSound,
            playKeyTone,
            startRingtone,
            stopRingtone,
            startRingback,
            stopRingback,
            playMessageNotification,
            triggerHaptic
        }}>
            {children}
        </SoundContext.Provider>
    );
};

export const useSound = () => useContext(SoundContext);
