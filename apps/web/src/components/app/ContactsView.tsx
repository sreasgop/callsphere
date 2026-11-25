import { useState, type FormEvent } from 'react';
import { Ban, MessageSquare, Phone, Plus, ShieldOff, UserRound } from 'lucide-react';
import { api, type BlockedItem, type ContactItem } from '../../lib/api';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useToast } from '../ui/Toast';

interface ContactsViewProps {
  contacts: ContactItem[];
  blocked: BlockedItem[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onStartCall: (targetUid: string, nameHint?: string) => void;
  onOpenChat: (targetUid: string) => void;
}

export function ContactsView({
  contacts,
  blocked,
  loading,
  onRefresh,
  onStartCall,
  onOpenChat,
}: ContactsViewProps) {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [uidInput, setUidInput] = useState('');
  const [nickInput, setNickInput] = useState('');
  const [saving, setSaving] = useState(false);

  const blockedSet = new Set(blocked.map((b) => b.blocked_uid));
  const query = search.trim().toLowerCase();
  const filteredContacts = contacts.filter(
    (c) =>
      !query ||
      c.contact_name.toLowerCase().includes(query) ||
      c.contact_uid.includes(query),
  );

  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    setSaving(true);
    try {
      const res = await api.addContact(uidInput.trim(), nickInput.trim());
      notify(`Saved ${res.contact.contact_name}`, 'success');
      setUidInput('');
      setNickInput('');
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save contact', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async (uid: string) => {
    soundEngine.playClick();
    try {
      if (blockedSet.has(uid)) {
        await api.unblockUid(uid);
        notify('User unblocked', 'info');
      } else {
        await api.blockUid(uid);
        notify('User blocked', 'warn');
      }
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Action failed', 'danger');
    }
  };

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">Contacts</h2>
        <Button
          size="sm"
          onClick={() => {
            soundEngine.playClick();
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Add Contact
        </Button>
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search contacts by name or 10-digit UID..."
      />

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-elevated animate-pulse" />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
          <UserRound className="size-8 text-text-muted mx-auto" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-text-secondary">
            {search.trim() ? 'No matching contacts found.' : 'No saved contacts yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle bg-surface border border-border-subtle rounded-lg overflow-hidden">
          {filteredContacts.map((c) => {
            const isBlocked = blockedSet.has(c.contact_uid);
            return (
              <div
                key={c.contact_uid}
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-9 rounded-full bg-elevated border border-border-subtle flex items-center justify-center text-xs font-semibold text-text-primary shrink-0">
                    {c.contact_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {c.contact_name}
                      </span>
                      <Badge tone={c.is_online ? 'online' : 'neutral'}>
                        {c.is_online ? 'Online' : 'Offline'}
                      </Badge>
                      {isBlocked ? <Badge tone="danger">Blocked</Badge> : null}
                    </div>
                    <div className="mt-0.5 font-mono tabular-nums text-xs text-text-muted">
                      {formatUidDisplay(c.contact_uid)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenChat(c.contact_uid)}
                    title={`Message ${c.contact_name}`}
                    aria-label={`Message ${c.contact_name}`}
                    className="size-9 rounded-full bg-elevated hover:bg-accent-muted hover:text-accent border border-border-subtle text-text-secondary flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <MessageSquare className="size-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleBlock(c.contact_uid)}
                    title={isBlocked ? 'Unblock UID' : 'Block UID'}
                    aria-label={isBlocked ? 'Unblock UID' : 'Block UID'}
                    className="size-9 rounded-full bg-elevated hover:bg-danger-bg hover:text-danger border border-border-subtle text-text-muted flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isBlocked ? (
                      <ShieldOff className="size-4" strokeWidth={1.5} />
                    ) : (
                      <Ban className="size-4" strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall(c.contact_uid, c.contact_name)}
                    title={`Call ${c.contact_name}`}
                    aria-label={`Call ${c.contact_name}`}
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Contact"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-contact-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save Contact'}
            </Button>
          </>
        }
      >
        <form id="add-contact-form" onSubmit={handleAddContact} className="space-y-4">
          <Input
            id="contact-uid-input"
            label="Target 10-Digit UID"
            placeholder="e.g. 2310002451"
            maxLength={10}
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Input
            id="contact-nick-input"
            label="Nickname (Optional)"
            placeholder="e.g. Mom, Team Lead"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
