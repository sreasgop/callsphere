import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Crown, Trash2, UserPlus } from 'lucide-react';
import { api, type ContactItem, type GroupDetailsResponse } from '../../lib/api';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface GroupManageModalProps {
  groupUid: string | null;
  myUid: string;
  contacts: ContactItem[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function GroupManageModal({
  groupUid,
  myUid,
  contacts,
  onClose,
  onChanged,
}: GroupManageModalProps) {
  const { notify } = useToast();
  const [details, setDetails] = useState<GroupDetailsResponse | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [manualUid, setManualUid] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadDetails = useCallback(async (uid: string) => {
    try {
      const res = await api.getGroupDetails(uid);
      setDetails(res);
      setRenameValue(res.group.group_name);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not load group details', 'danger');
      onClose();
    }
  }, [notify, onClose]);

  useEffect(() => {
    if (groupUid) {
      setConfirmDelete(false);
      void loadDetails(groupUid);
    } else {
      setDetails(null);
    }
  }, [groupUid, loadDetails]);

  if (!groupUid || !details) return null;

  const myRecord = details.members.find((m) => m.user_uid === myUid);
  const isAdmin = myRecord?.role === 'admin';
  const nonMembers = contacts.filter(
    (c) => !details.members.some((m) => m.user_uid === c.contact_uid),
  );

  const handleCopyGroupUid = () => {
    void navigator.clipboard?.writeText(details.group.group_uid);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    try {
      await api.renameGroup(details.group.group_uid, renameValue.trim());
      notify('Group name updated', 'success');
      await onChanged();
      await loadDetails(details.group.group_uid);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to rename group', 'danger');
    }
  };

  const handleAddMember = async () => {
    const target = selectedContact || manualUid.trim();
    if (!/^\d{10}$/.test(target)) {
      notify('Select a contact or enter a 10-digit UID', 'warn');
      return;
    }
    try {
      await api.addGroupMember(details.group.group_uid, target);
      notify('Member added', 'success');
      setSelectedContact('');
      setManualUid('');
      await loadDetails(details.group.group_uid);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add member', 'danger');
    }
  };

  const handleRemoveMember = async (uid: string) => {
    try {
      await api.removeGroupMember(details.group.group_uid, uid);
      notify('Member removed', 'info');
      await loadDetails(details.group.group_uid);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove member', 'danger');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await api.deleteGroup(details.group.group_uid);
      notify('Group deleted', 'info');
      onClose();
      await onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete group', 'danger');
    }
  };

  return (
    <Modal
      open={Boolean(groupUid)}
      onClose={onClose}
      maxWidthClass="max-w-[540px]"
      title={details.group.group_name}
      subtitle={
        <button
          type="button"
          onClick={handleCopyGroupUid}
          className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <span>ID: {formatUidDisplay(details.group.group_uid)}</span>
          {copied ? (
            <Check className="size-3 text-online" strokeWidth={1.75} />
          ) : (
            <Copy className="size-3 text-text-muted" strokeWidth={1.5} />
          )}
        </button>
      }
    >
      <div className="space-y-5">
        {isAdmin ? (
          <div className="p-4 rounded-md bg-canvas border border-border-default space-y-4">
            <div className="text-[11px] uppercase font-semibold tracking-[0.08em] text-accent">
              Admin Controls
            </div>

            <form onSubmit={handleRename} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  id="rename-group-input"
                  label="Group Name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-text-secondary block">Add Member</label>
              <select
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="h-10 w-full bg-surface border border-border-default rounded-sm px-3 text-sm text-text-primary outline-none focus:border-accent"
              >
                <option value="">Select from contacts...</option>
                {nonMembers.map((c) => (
                  <option key={c.contact_uid} value={c.contact_uid}>
                    {c.contact_name} ({formatUidDisplay(c.contact_uid)})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={manualUid}
                  onChange={(e) => setManualUid(e.target.value.replace(/\D/g, ''))}
                  placeholder="Or enter 10-digit UID"
                  className="h-10 flex-1 bg-surface border border-border-default rounded-sm px-3 text-sm font-mono text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    soundEngine.playClick();
                    void handleAddMember();
                  }}
                >
                  <UserPlus className="size-4" strokeWidth={1.5} />
                  Add
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle">
              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  className="w-full"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" strokeWidth={1.5} />
                  Delete Group
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-sm bg-danger-bg border border-danger/30">
                  <span className="text-xs text-danger">Delete permanently?</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" variant="danger-solid" onClick={() => void handleDeleteGroup()}>
                      Confirm
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Members</span>
            <Badge>{details.members.length}</Badge>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-border-subtle border border-border-subtle rounded-md bg-canvas/50">
            {details.members.map((m) => {
              const isMe = m.user_uid === myUid;
              return (
                <div
                  key={m.user_uid}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                      {m.role === 'admin' ? (
                        <Crown className="size-3.5 text-warn shrink-0" strokeWidth={1.75} />
                      ) : null}
                      <span className="truncate">{m.full_name || 'Member'}</span>
                    </div>
                    <div className="font-mono tabular-nums text-xs text-text-muted">
                      {formatUidDisplay(m.user_uid)}
                    </div>
                  </div>
                  {isMe ? (
                    <Badge>You</Badge>
                  ) : isAdmin ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleRemoveMember(m.user_uid)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
