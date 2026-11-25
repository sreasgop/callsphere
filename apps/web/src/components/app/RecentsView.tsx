import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, Phone, UserPlus } from 'lucide-react';
import { api, type CallLogItem, type ContactItem } from '../../lib/api';
import { formatDuration, formatLocalTime, formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useToast } from '../ui/Toast';

interface RecentsViewProps {
  calls: CallLogItem[];
  contacts: ContactItem[];
  loading: boolean;
  onStartCall: (targetUid: string, nameHint?: string) => void;
  onContactAdded: () => Promise<void>;
}

export function RecentsView({
  calls,
  contacts,
  loading,
  onStartCall,
  onContactAdded,
}: RecentsViewProps) {
  const { notify } = useToast();
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [search, setSearch] = useState('');
  const [saveTargetUid, setSaveTargetUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const resolveName = (uid: string) => {
    const match = contacts.find((c) => c.contact_uid === uid);
    return match
      ? { name: match.contact_name, saved: true }
      : { name: formatUidDisplay(uid), saved: false };
  };

  const query = search.trim().toLowerCase();
  const filtered = calls.filter((c) => {
    if (filter === 'missed' && c.status !== 'missed') return false;
    if (!query) return true;
    const partnerUid = c.direction === 'outbound' ? c.callee_uid : c.caller_uid;
    const resolved = resolveName(partnerUid);
    return (
      resolved.name.toLowerCase().includes(query) ||
      partnerUid.includes(query) ||
      c.status.toLowerCase().includes(query)
    );
  });

  const handleSaveContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!saveTargetUid) return;
    soundEngine.playClick();
    setSaving(true);
    try {
      const res = await api.addContact(saveTargetUid, nickname.trim());
      notify(`Saved ${res.contact.contact_name}`, 'success');
      setSaveTargetUid(null);
      setNickname('');
      await onContactAdded();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save contact', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">Recent Calls</h2>
        <div className="inline-flex rounded-md bg-surface border border-border-subtle p-0.5">
          {(['all', 'missed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-sm text-xs font-medium capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-elevated text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, 10-digit UID, or status..."
      />

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-elevated animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
          <Clock className="size-8 text-text-muted mx-auto" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-text-secondary">
            {search.trim()
              ? 'No matching calls found.'
              : filter === 'missed'
                ? 'No missed calls recorded.'
                : 'No recent calls yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle bg-surface border border-border-subtle rounded-lg overflow-hidden">
          {filtered.map((c) => {
            const partnerUid = c.direction === 'outbound' ? c.callee_uid : c.caller_uid;
            const resolved = resolveName(partnerUid);
            const isMissed = c.status === 'missed' || c.status === 'declined';

            return (
              <div
                key={c.id}
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-9 rounded-full bg-elevated border border-border-subtle flex items-center justify-center shrink-0">
                    {c.direction === 'outbound' ? (
                      <ArrowUpRight className="size-4 text-online" strokeWidth={1.5} />
                    ) : (
                      <ArrowDownLeft
                        className={`size-4 ${isMissed ? 'text-danger' : 'text-text-secondary'}`}
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[15px] sm:text-sm font-medium truncate ${
                          isMissed ? 'text-danger' : 'text-text-primary'
                        }`}
                      >
                        {resolved.name}
                      </span>
                      {!resolved.saved ? <Badge>Unsaved</Badge> : null}
                    </div>
                    <div className="mt-1 font-mono tabular-nums text-xs text-text-secondary">
                      {formatUidDisplay(partnerUid)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                      <span className="capitalize">{c.status}</span>
                      {c.duration > 0 ? (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {formatDuration(c.duration)}
                          </span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span className="font-mono tabular-nums">{formatLocalTime(c.started_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!resolved.saved ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setNickname('');
                        setSaveTargetUid(partnerUid);
                      }}
                      title="Save to Contacts"
                      aria-label={`Save ${partnerUid} to Contacts`}
                      className="size-9 rounded-full bg-elevated hover:bg-accent-muted hover:text-accent border border-border-subtle text-text-secondary flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <UserPlus className="size-4" strokeWidth={1.5} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onStartCall(partnerUid, resolved.name)}
                    aria-label={`Call ${resolved.name}`}
                    className="size-9 rounded-full bg-elevated hover:bg-online hover:text-white border border-border-default text-text-secondary flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Phone className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={saveTargetUid !== null}
        onClose={() => setSaveTargetUid(null)}
        title="Save to Contacts"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveTargetUid(null)}>
              Cancel
            </Button>
            <Button type="submit" form="save-recent-contact-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save Contact'}
            </Button>
          </>
        }
      >
        <form id="save-recent-contact-form" onSubmit={handleSaveContact} className="space-y-4">
          <Input
            id="recent-contact-uid"
            label="10-Digit UID"
            value={saveTargetUid ? formatUidDisplay(saveTargetUid) : ''}
            readOnly
            className="font-mono tabular-nums text-text-secondary"
          />
          <Input
            id="recent-contact-nick"
            label="Nickname (Optional)"
            placeholder="e.g. Alex, Support"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoFocus
          />
        </form>
      </Modal>
    </div>
  );
}
