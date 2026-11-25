import { useEffect, useMemo, useState } from 'react';
import { Delete, Phone } from 'lucide-react';
import type { ContactItem } from '../../lib/api';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { useToast } from '../ui/Toast';

interface DialerViewProps {
  contacts: ContactItem[];
  onStartCall: (targetUid: string, nameHint?: string) => void;
}

const KEYS: Array<{ digit: string; sub: string }> = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

export function DialerView({ contacts, onStartCall }: DialerViewProps) {
  const { notify } = useToast();
  const [dialValue, setDialValue] = useState('');

  const suggestions = useMemo(() => {
    const clean = dialValue.replace(/\D/g, '');
    if (clean.length < 2) return [];
    return contacts.filter((c) => c.contact_uid.startsWith(clean)).slice(0, 4);
  }, [contacts, dialValue]);

  const appendKey = (k: string) => {
    soundEngine.playKeypadTone(k);
    setDialValue((prev) => (prev.length >= 10 ? prev : prev + k));
  };

  const backspace = () => {
    soundEngine.playClick();
    setDialValue((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    const clean = dialValue.trim();
    if (!/^\d{10}$/.test(clean)) {
      notify('Enter a valid 10-digit UID', 'warn');
      return;
    }
    const match = contacts.find((c) => c.contact_uid === clean);
    onStartCall(clean, match?.contact_name);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (/^[0-9*#]$/.test(e.key)) {
        soundEngine.playKeypadTone(e.key);
        setDialValue((prev) => (prev.length >= 10 ? prev : prev + e.key));
      } else if (e.key === 'Backspace') {
        soundEngine.playClick();
        setDialValue((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        const clean = dialValue.trim();
        if (/^\d{10}$/.test(clean)) {
          const match = contacts.find((c) => c.contact_uid === clean);
          onStartCall(clean, match?.contact_name);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contacts, dialValue, onStartCall]);

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center py-2">
      <div className="w-full max-w-[340px] mx-auto flex flex-col items-center">
        <div className="w-full relative">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={dialValue}
            onChange={(e) => setDialValue(e.target.value.replace(/[^0-9*#]/g, ''))}
            placeholder="Enter 10-digit UID"
            aria-label="Dialpad UID input"
            className="w-full bg-transparent border-b border-border-default focus:border-accent pb-3 text-center font-mono tabular-nums text-[30px] tracking-tight text-text-primary placeholder:text-text-muted placeholder:text-lg outline-none transition-colors"
          />

          {suggestions.length > 0 ? (
            <div className="absolute inset-x-0 top-full mt-2 z-20 bg-elevated border border-border-default rounded-md overflow-hidden shadow-xl">
              {suggestions.map((c) => (
                <button
                  key={c.contact_uid}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setDialValue(c.contact_uid);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-hover transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-text-primary truncate">
                    {c.contact_name}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-text-muted">
                    {formatUidDisplay(c.contact_uid)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-7 grid grid-cols-3 gap-4">
          {KEYS.map((k) => (
            <button
              key={k.digit}
              type="button"
              onClick={() => appendKey(k.digit)}
              className="size-[74px] sm:size-[70px] rounded-full bg-elevated hover:bg-hover active:scale-95 border border-border-subtle hover:border-border-default flex flex-col items-center justify-center transition-all cursor-pointer select-none"
            >
              <span className="text-2xl sm:text-xl font-semibold text-text-primary leading-none">
                {k.digit}
              </span>
              {k.sub ? (
                <span className="mt-1 text-[10px] sm:text-[9px] font-mono tracking-[0.12em] text-text-muted leading-none">
                  {k.sub}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 items-center">
          <div className="size-[74px] sm:size-[70px]" />
          <button
            type="button"
            onClick={handleCall}
            aria-label="Start call"
            className="size-[74px] sm:size-[70px] rounded-full bg-online hover:bg-online/90 active:scale-95 text-white shadow-[0_0_24px_rgba(34,197,94,0.25)] flex items-center justify-center transition-all cursor-pointer"
          >
            <Phone className="size-7 sm:size-6" strokeWidth={1.75} />
          </button>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={backspace}
              aria-label="Backspace"
              disabled={dialValue.length === 0}
              className="size-12 rounded-full bg-transparent hover:bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Delete className="size-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
