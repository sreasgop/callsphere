import { Database, Globe, Layers, Lock, Radio, Server } from 'lucide-react';
import { PublicLayout } from '../components/public/PublicLayout';
import { useReveal } from '../lib/useReveal';

const STACK = [
  { name: 'Python Flask', role: 'REST API Blueprints', icon: Server },
  { name: 'Flask-SocketIO', role: 'Real-Time Signaling', icon: Radio },
  { name: 'MariaDB', role: 'Pooled Persistence', icon: Database },
  { name: 'WebRTC', role: 'Peer-to-Peer Media', icon: Globe },
  { name: 'React + TypeScript', role: 'Typed Client SPA', icon: Layers },
  { name: 'Argon2id + JWT', role: 'HttpOnly Cookie Auth', icon: Lock },
];

const SCHEMA_TABLES = [
  {
    name: 'users',
    cols: [
      ['id', 'INT PK'],
      ['uid', 'VARCHAR(10) UNIQUE'],
      ['email', 'VARCHAR(100) UNIQUE'],
      ['password_hash', 'VARCHAR(255)'],
      ['privacy_mode', 'ENUM'],
    ],
  },
  {
    name: 'contacts',
    cols: [
      ['id', 'INT PK'],
      ['user_id', 'INT FK'],
      ['contact_uid', 'VARCHAR(10)'],
      ['contact_name', 'VARCHAR(100)'],
    ],
  },
  {
    name: 'call_logs',
    cols: [
      ['id', 'INT PK'],
      ['caller_uid', 'VARCHAR(10)'],
      ['callee_uid', 'VARCHAR(10)'],
      ['duration', 'INT'],
      ['status', 'ENUM'],
    ],
  },
  {
    name: 'groups',
    cols: [
      ['id', 'INT PK'],
      ['group_uid', 'VARCHAR(10) UNIQUE'],
      ['group_name', 'VARCHAR(100)'],
      ['created_by', 'INT FK'],
    ],
  },
];

const TIMELINE = [
  {
    step: '1. Initiation',
    desc: 'User A dials a 10-digit UID. The React WebRTC controller captures local media via getUserMedia and emits call:offer over Socket.IO.',
  },
  {
    step: '2. Server-Side Gatekeeper',
    desc: 'Flask-SocketIO verifies the authenticated JWT session, checks blocked_users and privacy_mode in MariaDB, and routes call:incoming to User B.',
  },
  {
    step: '3. SDP & Trickle ICE',
    desc: 'Peers exchange SDP offers/answers and incremental ICE candidates via Socket.IO rooms (uid:<10-digit-uid>) with STUN/TURN fallback.',
  },
  {
    step: '4. Peer-to-Peer Stream',
    desc: 'Encrypted DTLS-SRTP audio and video flow directly between browsers. On hangup, tracks are stopped and call duration is logged via REST.',
  },
];

export function ArchitecturePage() {
  const tiers = useReveal<HTMLDivElement>();
  const schema = useReveal<HTMLDivElement>();
  const timeline = useReveal<HTMLDivElement>();

  return (
    <PublicLayout>
      <section className="max-w-[1120px] mx-auto px-6 py-24">
        <div className="text-center max-w-[62ch] mx-auto animate-fade-up">
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            System Specification
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.1] text-text-primary">
            The Engine Beneath.
          </h1>
          <p className="mt-4 text-base text-text-secondary">
            A transparent look at CallSphere's modular Flask-SocketIO signaling layer, pooled MariaDB
            persistence, and peer-to-peer WebRTC media plane.
          </p>
        </div>

        {/* Tech Stack */}
        <div className="mt-20">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary text-center">
            Core Technology Stack
          </h2>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {STACK.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="group bg-surface border border-border-subtle hover:border-accent-border hover:-translate-y-1 rounded-lg p-5 text-center transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                >
                  <Icon
                    className="size-5 text-accent mx-auto transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={1.5}
                  />
                  <div className="mt-3 text-sm font-medium text-text-primary">{item.name}</div>
                  <div className="mt-1 text-xs text-text-muted">{item.role}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Three-Tier Architecture */}
        <div ref={tiers.ref} className={`mt-24 ${tiers.revealClass}`}>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary text-center">
            Three-Tier Design
          </h2>
          <div className="relative mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            <div
              aria-hidden="true"
              className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-px bg-border-default -translate-y-1/2 pointer-events-none"
            >
              <span className="absolute -top-[3px] size-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-signal-travel" />
            </div>
            <div className="relative z-10 bg-surface border border-border-default hover:border-accent-border hover:-translate-y-1 rounded-lg p-6 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                  Tier 01
                </span>
                <span className="text-[10px] font-mono text-text-muted">WSS / HTTPS</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-text-primary">Presentation Layer</h3>
              <p className="mt-2 text-sm text-text-secondary">
                React 19, TypeScript, Tailwind CSS v4, and native browser WebRTC media pipelines.
              </p>
            </div>
            <div className="relative z-10 bg-surface border border-border-default hover:border-accent-border hover:-translate-y-1 rounded-lg p-6 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                  Tier 02
                </span>
                <span className="text-[10px] font-mono text-text-muted">REST / Socket.IO</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-text-primary">
                Signaling & API Layer
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                Flask REST blueprints and Flask-SocketIO rooms with JWT cookie auth and Pydantic
                schemas.
              </p>
            </div>
            <div className="relative z-10 bg-surface border border-border-default hover:border-accent-border hover:-translate-y-1 rounded-lg p-6 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                  Tier 03
                </span>
                <span className="text-[10px] font-mono text-text-muted">Pooled SQL</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-text-primary">Data Persistence</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Pooled MariaDB with composite indexes, parameterized queries, and foreign-key
                cascades.
              </p>
            </div>
          </div>
        </div>

        {/* Relational Schema */}
        <div ref={schema.ref} className={`mt-24 ${schema.revealClass}`}>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary text-center">
            Relational Schema
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCHEMA_TABLES.map((t) => (
              <div
                key={t.name}
                className="bg-surface border border-border-default hover:border-accent-border rounded-lg overflow-hidden transition-colors duration-300"
              >
                <div className="px-4 py-2.5 bg-elevated border-b border-border-subtle font-mono text-xs font-semibold text-text-primary">
                  {t.name}
                </div>
                <div className="divide-y divide-border-subtle">
                  {t.cols.map(([col, typ]) => (
                    <div
                      key={col}
                      className="px-4 py-2 flex items-center justify-between gap-2 font-mono tabular-nums text-xs hover:bg-hover/40 transition-colors"
                    >
                      <span className="text-text-primary">{col}</span>
                      <span className="text-text-muted">{typ}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Propagation Timeline */}
        <div ref={timeline.ref} className={`mt-24 max-w-2xl mx-auto ${timeline.revealClass}`}>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary text-center">
            Signal Propagation Flow
          </h2>
          <div className="mt-10 border-l border-border-default pl-6 space-y-8">
            {TIMELINE.map((item, idx) => {
              const isFinal = idx === TIMELINE.length - 1;
              return (
                <div
                  key={item.step}
                  className="group relative transition-transform duration-300 hover:translate-x-1"
                >
                  <span
                    className={`absolute -left-[29px] top-1 size-2.5 rounded-full border transition-transform duration-300 group-hover:scale-125 ${
                      isFinal ? 'bg-online border-online' : 'bg-accent border-accent'
                    }`}
                  >
                    {isFinal ? (
                      <span className="absolute inset-0 rounded-full bg-online animate-ping opacity-75" />
                    ) : null}
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{item.step}</h3>
                  <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
