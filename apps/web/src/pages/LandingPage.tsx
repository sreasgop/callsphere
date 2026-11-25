import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Laptop,
  Mic,
  Phone,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { PublicLayout } from '../components/public/PublicLayout';
import { Button } from '../components/ui/Button';
import { useReveal } from '../lib/useReveal';

export function LandingPage() {
  const [copiedDemo, setCopiedDemo] = useState(false);
  const f1 = useReveal<HTMLElement>();
  const f2 = useReveal<HTMLElement>();
  const f3 = useReveal<HTMLElement>();
  const f4 = useReveal<HTMLElement>();

  const handleCopyDemo = () => {
    void navigator.clipboard?.writeText('2310002451');
    setCopiedDemo(true);
    window.setTimeout(() => setCopiedDemo(false), 1500);
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="relative border-b border-border-subtle min-h-[calc(100svh-4rem)] flex items-center"
        style={{
          background:
            'radial-gradient(ellipse 65% 45% at 50% 0%, rgba(99, 102, 241, 0.1), transparent)',
        }}
      >
        <div className="max-w-[1120px] mx-auto px-6 py-20 md:py-32 text-center flex flex-col items-center animate-fade-up">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-accent-border bg-accent-muted text-[11px] uppercase font-semibold tracking-[0.08em] text-text-primary">
            <span className="size-1.5 rounded-full bg-accent" />
            No SIM. No Carrier. Just You.
          </span>

          <h1 className="mt-7 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.06] text-text-primary max-w-[18ch]">
            The Phone that Lives in Your Browser.
          </h1>

          <p className="mt-7 text-base sm:text-lg text-text-secondary max-w-[54ch] leading-relaxed">
            Get a permanent 10-digit UID instantly. Make crystal-clear audio and video calls to anyone,
            anywhere, on any device over peer-to-peer WebRTC.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth?mode=register">
              <Button size="lg" pill className="shadow-[0_0_24px_rgba(250,250,250,0.12)]">
                Get Your Number
              </Button>
            </Link>
            <Link to="/architecture">
              <Button variant="secondary" size="lg" pill>
                Inspect Architecture
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature 1: Numeric Dialpad & UID */}
      <section
        ref={f1.ref}
        className={`max-w-[1120px] mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center border-b border-border-subtle ${f1.revealClass}`}
      >
        <div>
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            The Experience
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.12] text-text-primary">
            A Full Mobile Phone, On the Web.
          </h2>
          <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-[52ch]">
            We built a precision telecom instrument, not another cluttered social feed. Dial 10-digit
            UIDs from a tactile keypad, inspect missed and answered calls, and tap once to call back.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-text-secondary">
            <li className="flex items-center gap-2.5">
              <Check className="size-4 text-online shrink-0" strokeWidth={1.75} />
              Missed Call Badges and Tabular History
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="size-4 text-online shrink-0" strokeWidth={1.75} />
              Custom Contact Nicknames and Online Presence
            </li>
          </ul>
        </div>

        {/* Miniature UI Vignette 1: UID Dialer Card */}
        <div className="bg-surface border border-border-default hover:border-accent-border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.16)] transition-all duration-300 rounded-lg p-6 max-w-md w-full mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                Active Identity
              </div>
              <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-text-primary">
                231-000-2451
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyDemo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-elevated hover:bg-hover border border-border-default text-xs text-text-secondary cursor-pointer transition-colors"
            >
              {copiedDemo ? (
                <>
                  <Check className="size-3.5 text-online" strokeWidth={1.75} />
                  <span className="text-online">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" strokeWidth={1.5} />
                  <span>Copy UID</span>
                </>
              )}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
              <div
                key={k}
                className="h-11 rounded-md bg-elevated hover:bg-hover hover:border-accent-border active:scale-95 border border-border-subtle flex items-center justify-center font-mono text-sm text-text-primary transition-all cursor-default select-none"
              >
                {k}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <div className="size-11 rounded-full bg-online shadow-[0_0_20px_rgba(34,197,94,0.28)] flex items-center justify-center text-white">
              <Phone className="size-4" strokeWidth={1.75} />
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Group Conferencing */}
      <section
        ref={f2.ref}
        className={`max-w-[1120px] mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center border-b border-border-subtle ${f2.revealClass}`}
      >
        {/* Miniature UI Vignette 2: 3-User Group Tile Strip */}
        <div className="order-2 lg:order-1 bg-surface border border-border-default hover:border-accent-border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.16)] transition-all duration-300 rounded-lg p-5 max-w-md w-full mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" strokeWidth={1.5} />
              <span className="text-sm font-medium text-text-primary">Study Buddies</span>
            </div>
            <span className="font-mono tabular-nums text-xs text-text-muted">900-124-8810</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { name: 'Chandra', init: 'C', speaking: true },
              { name: 'Soutrika', init: 'S', speaking: false },
              { name: 'Sanjib', init: 'S', speaking: false },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-md bg-elevated p-3 border transition-transform duration-300 hover:-translate-y-0.5 ${
                  p.speaking ? 'border-online/60' : 'border-border-subtle'
                } flex flex-col items-center gap-2`}
              >
                <div className="size-10 rounded-full bg-surface border border-border-default flex items-center justify-center text-xs font-semibold text-text-primary">
                  {p.init}
                </div>
                <span className="text-xs text-text-secondary truncate max-w-full">{p.name}</span>
                <Mic
                  className={`size-3.5 ${p.speaking ? 'text-online' : 'text-text-muted'}`}
                  strokeWidth={1.5}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            Group Conferencing
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.12] text-text-primary">
            Study Buddies, One Tap Away.
          </h2>
          <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-[52ch]">
            Create named groups and ring everyone at once. Manage membership with role-based admin
            controls, share a single 10-digit group UID, and join active rooms on demand.
          </p>
        </div>
      </section>

      {/* Feature 3: Privacy Rules */}
      <section
        ref={f3.ref}
        className={`max-w-[1120px] mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center border-b border-border-subtle ${f3.revealClass}`}
      >
        <div>
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            Total Control
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.12] text-text-primary">
            Your Line, Your Rules.
          </h2>
          <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-[52ch]">
            Traditional phone numbers invite spam. CallSphere enforces privacy server-side on every
            signaling offer before a ring ever reaches your screen.
          </p>
        </div>

        {/* Miniature UI Vignette 3: Privacy Toggle List */}
        <div className="bg-surface border border-border-default hover:border-accent-border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.16)] transition-all duration-300 rounded-lg p-5 max-w-md w-full mx-auto space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
            <ShieldCheck className="size-4 text-online" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary">
              Server-Enforced Gatekeeper
            </span>
          </div>
          {[
            { label: 'Allow Everyone', desc: 'Any valid 10-digit UID can ring', active: false },
            { label: 'Contacts Only', desc: 'Only saved contacts reach your line', active: true },
            { label: 'Do Not Disturb', desc: 'Reject all incoming call offers', active: false },
          ].map((rule) => (
            <div
              key={rule.label}
              className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                rule.active
                  ? 'bg-accent-muted border-accent-border'
                  : 'bg-elevated border-border-subtle hover:border-border-default'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-text-primary">{rule.label}</div>
                <div className="text-xs text-text-muted">{rule.desc}</div>
              </div>
              <div
                className={`size-4 rounded-full border flex items-center justify-center ${
                  rule.active ? 'border-accent bg-accent' : 'border-border-strong'
                }`}
              >
                {rule.active ? <div className="size-1.5 rounded-full bg-white" /> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature 4: Cross Device */}
      <section
        ref={f4.ref}
        className={`max-w-[1120px] mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center ${f4.revealClass}`}
      >
        {/* Miniature UI Vignette 4: Synced Laptop + Phone Incoming Banner */}
        <div className="order-2 lg:order-1 bg-surface border border-border-default hover:border-accent-border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.16)] transition-all duration-300 rounded-lg p-5 max-w-md w-full mx-auto">
          <div className="flex items-center justify-between text-xs text-text-muted mb-4">
            <span className="inline-flex items-center gap-1.5">
              <Laptop className="size-3.5" strokeWidth={1.5} />
              Desktop Web
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-3.5" strokeWidth={1.5} />
              Mobile Browser
            </span>
          </div>
          <div className="bg-elevated border border-border-default rounded-md p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative size-9 rounded-full bg-online-bg border border-online/30 flex items-center justify-center text-online shrink-0">
                <span className="absolute inset-0 rounded-full border border-online/40 animate-ping" />
                <PhoneCall className="size-4 relative" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">Incoming Call</div>
                <div className="text-xs font-mono tabular-nums text-text-muted">780-189-3998</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-full bg-danger-bg text-danger text-xs font-medium">
                Decline
              </span>
              <span className="px-2.5 py-1 rounded-full bg-online text-white text-xs font-medium">
                Answer
              </span>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            Always Reachable
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.12] text-text-primary">
            Never Miss a Ring.
          </h2>
          <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-[52ch]">
            Socket.IO rooms route incoming offers to your active browser sessions with low-latency
            trickle ICE negotiation and instant presence updates.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
