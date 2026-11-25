import { useState, type FormEvent } from 'react';
import { Code2, Mail, MapPin, Send } from 'lucide-react';
import { PublicLayout } from '../components/public/PublicLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

export function ContactPage() {
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    notify('Transmission sent. Engineering dispatch will respond shortly.', 'success');
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
  };

  return (
    <PublicLayout>
      <section className="max-w-[1120px] mx-auto px-6 py-24">
        <div className="text-center max-w-[56ch] mx-auto animate-fade-up">
          <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
            Establish Uplink
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.1] text-text-primary">
            Direct Engineering Dispatch.
          </h1>
          <p className="mt-4 text-base text-text-secondary">
            Send technical inquiries, bug reports, or deployment questions directly to the
            CallSphere unit.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface border border-border-subtle hover:border-accent-border hover:translate-x-1 rounded-lg p-5 transition-all duration-300">
              <MapPin className="size-4 text-accent" strokeWidth={1.5} />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">Headquarters</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                Sector 4, Techno India University
                <br />
                Salt Lake City, Kolkata
                <br />
                West Bengal, 700091
              </p>
            </div>

            <div className="bg-surface border border-border-subtle hover:border-accent-border hover:translate-x-1 rounded-lg p-5 transition-all duration-300">
              <Mail className="size-4 text-accent" strokeWidth={1.5} />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">Digital Channels</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                General: <span className="font-mono text-text-primary">core@callsphere.io</span>
                <br />
                Support: <span className="font-mono text-text-primary">help@callsphere.io</span>
              </p>
            </div>

            <div className="bg-surface border border-border-subtle hover:border-accent-border hover:translate-x-1 rounded-lg p-5 transition-all duration-300">
              <Code2 className="size-4 text-accent" strokeWidth={1.5} />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">Source Code</h3>
              <p className="mt-1.5 text-sm text-text-secondary">
                Contribute to the core infrastructure on{' '}
                <span className="font-mono text-text-primary">github.com/callsphere/core</span>
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-surface border border-border-default shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] rounded-lg p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-online-bg border border-online/30 text-online text-xs font-medium">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-online animate-ping opacity-75" />
                <span className="relative size-2 rounded-full bg-online" />
              </span>
              Support Systems Online
            </div>

            <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-text-primary">
              Transmit Signal
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Fill out the parameters below to route your message.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="contact-name"
                  label="Name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  id="contact-email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Input
                id="contact-subject"
                label="Subject"
                placeholder="Topic or issue summary"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-msg" className="text-xs font-medium text-text-secondary">
                  Message
                </label>
                <textarea
                  id="contact-msg"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter transmission details..."
                  className="w-full bg-canvas border border-border-default rounded-sm p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent-muted outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit">
                  <Send className="size-4" strokeWidth={1.5} />
                  Send Transmission
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
