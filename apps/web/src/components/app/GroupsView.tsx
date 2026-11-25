import { useState, type FormEvent } from 'react';
import { Phone, Plus, Users } from 'lucide-react';
import { api, type ContactItem, type GroupItem } from '../../lib/api';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useToast } from '../ui/Toast';
import { GroupManageModal } from './GroupManageModal';

interface GroupsViewProps {
  groups: GroupItem[];
  contacts: ContactItem[];
  myUid: string;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onStartCall: (targetUid: string, nameHint?: string) => void;
}

export function GroupsView({
  groups,
  contacts,
  myUid,
  loading,
  onRefresh,
  onStartCall,
}: GroupsViewProps) {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [manageUid, setManageUid] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [joinUid, setJoinUid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const query = search.trim().toLowerCase();
  const filteredGroups = groups.filter(
    (g) =>
      !query ||
      g.group_name.toLowerCase().includes(query) ||
      g.group_uid.includes(query) ||
      g.role.toLowerCase().includes(query),
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createGroup(groupName.trim());
      notify(`Created group (${formatUidDisplay(res.group_uid)})`, 'success');
      setGroupName('');
      setCreateOpen(false);
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create group', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(joinUid.trim())) {
      notify('Enter a valid 10-digit group ID', 'warn');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.joinGroup(joinUid.trim());
      notify(`Joined ${res.group_name}`, 'success');
      setJoinUid('');
      setJoinOpen(false);
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to join group', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">Groups</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              soundEngine.playClick();
              setJoinOpen(true);
            }}
          >
            Join
          </Button>
          <Button
            size="sm"
            onClick={() => {
              soundEngine.playClick();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Create
          </Button>
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search groups by name or 10-digit ID..."
      />

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-md bg-elevated animate-pulse" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center">
          <Users className="size-8 text-text-muted mx-auto" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-text-secondary">
            {search.trim() ? 'No matching groups found.' : 'No groups created or joined yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle bg-surface border border-border-subtle rounded-lg overflow-hidden">
          {filteredGroups.map((g) => (
            <div
              key={g.group_uid}
              onClick={() => {
                soundEngine.playClick();
                setManageUid(g.group_uid);
              }}
              className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-hover/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-9 rounded-md bg-elevated border border-border-subtle flex items-center justify-center text-text-secondary shrink-0">
                  <Users className="size-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {g.group_name}
                    </span>
                    <Badge tone={g.role === 'admin' ? 'accent' : 'neutral'}>{g.role}</Badge>
                  </div>
                  <div className="mt-0.5 font-mono tabular-nums text-xs text-text-muted">
                    ID: {formatUidDisplay(g.group_uid)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCall(g.group_uid, g.group_name);
                }}
                aria-label={`Call ${g.group_name}`}
                className="size-9 rounded-full bg-elevated hover:bg-online hover:text-white border border-border-default text-text-secondary flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Phone className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Group"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-group-form" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create & Join'}
            </Button>
          </>
        }
      >
        <form id="create-group-form" onSubmit={handleCreate}>
          <Input
            id="create-group-name"
            label="Group Name"
            placeholder="e.g. Study Buddies"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
        </form>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join Existing Group"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="join-group-form" disabled={submitting}>
              {submitting ? 'Joining...' : 'Join Group'}
            </Button>
          </>
        }
      >
        <form id="join-group-form" onSubmit={handleJoin}>
          <Input
            id="join-group-uid"
            label="10-Digit Group ID"
            placeholder="e.g. 9000123456"
            maxLength={10}
            value={joinUid}
            onChange={(e) => setJoinUid(e.target.value.replace(/\D/g, ''))}
            required
          />
        </form>
      </Modal>

      <GroupManageModal
        groupUid={manageUid}
        myUid={myUid}
        contacts={contacts}
        onClose={() => setManageUid(null)}
        onChanged={onRefresh}
      />
    </div>
  );
}
