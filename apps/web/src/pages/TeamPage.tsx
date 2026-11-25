import { Code2, Cpu, Layout, LineChart } from 'lucide-react';
import { PublicLayout } from '../components/public/PublicLayout';
import { useReveal } from '../lib/useReveal';

const MEMBERS = [
  {
    name: 'Chandra Sreas Gop',
    role: 'Lead Architect',
    badge: 'FULL STACK',
    uid: 'TIU-231001102451',
    focus: 'System Design, API & DB',
    image: '/images/Chandra.png',
  },
  {
    name: 'Soutrika Das',
    role: 'Frontend Engineer',
    badge: 'UI/UX',
    uid: 'TIU-231001102454',
    focus: 'Interaction Design',
    image: '/images/Soutrika.png',
  },
  {
    name: 'Sanjib Kumar Sah',
    role: 'Technical Associate',
    badge: 'DEV SUPPORT',
    uid: 'TIU-231001102492',
    focus: 'Implementation & Research',
    image: '/images/Sanjib.png',
  },
  {
    name: 'Swati Dubey',
    role: 'Research Analyst',
    badge: 'ANALYTICS',
    uid: 'TIU-231001102523',
    focus: 'Market Viability',
    image: '/images/Swati.png',
  },
];

const ROLES = [
  {
    title: 'System Architecture',
    lead: 'Chandra Sreas Gop',
    desc: 'Designed the 3-tier architecture, Python Flask + Socket.IO backend API, and relational MariaDB schema.',
    icon: Cpu,
  },
  {
    title: 'Visual Experience',
    lead: 'Soutrika Das',
    desc: 'Crafted the Single Page Application interface and interaction flows for fast, tactile dialing.',
    icon: Layout,
  },
  {
    title: 'Technical Implementation',
    lead: 'Sanjib Kumar Sah',
    desc: 'Assisted in module integration, troubleshooting, and WebRTC signaling feasibility studies.',
    icon: Code2,
  },
  {
    title: 'Market Analysis',
    lead: 'Swati Dubey',
    desc: 'Conducted research on VoIP viability, privacy expectations, and user acceptance criteria.',
    icon: LineChart,
  },
];

export function TeamPage() {
  const genesis = useReveal<HTMLDivElement>();

  return (
    <PublicLayout>
      <section className="max-w-[1120px] mx-auto px-6 py-24">
        <div className="text-center max-w-[60ch] mx-auto animate-fade-up">
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            Engineering Unit
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.1] text-text-primary">
            Architects of the Application.
          </h1>
          <p className="mt-4 text-base text-text-secondary">
            The four-person team responsible for the CallSphere infrastructure and client experience.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MEMBERS.map((m) => (
            <div
              key={m.uid}
              tabIndex={0}
              className="group relative md:h-[380px] bg-surface border border-border-subtle hover:border-accent-border focus-visible:border-accent-border rounded-lg overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] md:hover:-translate-y-2 md:hover:shadow-[0_20px_50px_-12px_rgba(99,102,241,0.18)] outline-none"
            >
              {/* Front: Circular Avatar + Name + Designation */}
              <div className="md:h-full pt-8 pb-4 md:py-0 px-5 flex flex-col items-center justify-center text-center transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform md:group-hover:-translate-y-12 md:group-focus-visible:-translate-y-12">
                <div className="size-40 rounded-full overflow-hidden bg-elevated border border-border-default group-hover:border-accent-border transition-[transform,scale,border-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-[transform,scale] md:group-hover:scale-[0.65] md:group-focus-visible:scale-[0.65] origin-center shrink-0">
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>

                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  {m.name}
                </h3>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {m.role}
                </p>
              </div>

              {/* Slide-Up Details Overlay (Hover/Focus on Desktop, Always Visible on Mobile) */}
              <div className="md:absolute md:inset-x-0 md:bottom-0 md:pt-12 p-5 bg-gradient-to-t from-canvas via-surface/95 to-transparent transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] md:translate-y-full md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-sm bg-accent-muted border border-accent-border text-accent">
                    {m.badge}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-online">
                    <span className="size-1.5 rounded-full bg-online" />
                    Active
                  </span>
                </div>

                <div className="divide-y divide-border-subtle text-xs">
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-text-muted uppercase tracking-[0.06em] text-[10px]">
                      UID
                    </span>
                    <code className="font-mono tabular-nums text-[11px] text-text-primary">
                      {m.uid}
                    </code>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-text-muted uppercase tracking-[0.06em] text-[10px]">
                      Focus
                    </span>
                    <span className="text-text-secondary text-right font-medium">{m.focus}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          ref={genesis.ref}
          className={`mt-24 pt-16 border-t border-border-subtle ${genesis.revealClass}`}
        >
          <div className="max-w-[56ch]">
            <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
              The Genesis Protocol
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              From Whiteboard to Live Grid
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className="bg-surface border border-border-subtle hover:border-accent-border hover:-translate-y-1 rounded-lg p-6 transition-all duration-300"
                >
                  <div className="flex items-center gap-2.5 text-text-primary font-semibold">
                    <Icon className="size-4 text-accent" strokeWidth={1.5} />
                    <span>{r.title}</span>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed">{r.desc}</p>
                  <div className="mt-4 text-xs font-mono text-text-muted">Lead: {r.lead}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 bg-surface border border-border-default rounded-lg p-8 text-center max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">
            The Core Vision
          </h3>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed">
            CallSphere began with a simple question: why do we need a SIM card to have a
            communication identity? Your email authenticates your account, your 10-digit UID is your
            universal address, and peer-to-peer WebRTC carries the media directly.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
