import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Download,
  Lock,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import {
  api,
  type ContactItem,
  type ConversationItem,
  type EncryptedMessageItem,
} from '../../lib/api';
import { e2eeClient } from '../../lib/cryptoClient';
import { formatLocalTime, formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useToast } from '../ui/Toast';

interface DecryptedMessage {
  id: number;
  sender_uid: string;
  text: string;
  attachment_id?: string | null;
  attachmentName?: string;
  attachmentIv?: string;
  created_at: string;
}

interface ChatViewProps {
  myUid: string;
  contacts: ContactItem[];
  socket: Socket | null;
  initialPeerUid?: string | null;
  onStartCall: (targetUid: string, nameHint?: string) => void;
  onUnreadChange: (total: number) => void;
}

export function ChatView({
  myUid,
  contacts,
  socket,
  initialPeerUid,
  onStartCall,
  onUnreadChange,
}: ChatViewProps) {
  const { notify } = useToast();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState('');
  const [activePeerUid, setActivePeerUid] = useState<string | null>(initialPeerUid ?? null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatUid, setNewChatUid] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingEmitRef = useRef<number>(0);
  const sharedKeyRef = useRef<CryptoKey | null>(null);

  const resolvePeerName = useCallback(
    (uid: string) => {
      const c = contacts.find((x) => x.contact_uid === uid);
      if (c) return c.contact_name;
      const conv = conversations.find((x) => x.peer_uid === uid);
      return conv?.peer_name || formatUidDisplay(uid);
    },
    [contacts, conversations],
  );

  const refreshConversations = useCallback(async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
      const total = res.conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      onUnreadChange(total);
    } finally {
      setLoadingConvs(false);
    }
  }, [onUnreadChange]);

  const decryptItem = useCallback(
    async (key: CryptoKey, m: EncryptedMessageItem): Promise<DecryptedMessage> => {
      let text = '[Encrypted message]';
      try {
        text = await e2eeClient.decryptText(key, m.ciphertext, m.iv);
      } catch {
        text = '[Encrypted with a previous device key]';
      }

      let attachmentName: string | undefined;
      let attachmentIv: string | undefined;
      if (m.attachment_id && m.attachment_meta_ct && m.attachment_meta_iv) {
        try {
          const metaJson = await e2eeClient.decryptText(
            key,
            m.attachment_meta_ct,
            m.attachment_meta_iv,
          );
          const meta = JSON.parse(metaJson) as { name?: string; iv?: string };
          attachmentName = meta.name;
          attachmentIv = meta.iv;
        } catch {
          attachmentName = 'encrypted-file.bin';
        }
      }

      return {
        id: m.id,
        sender_uid: m.sender_uid,
        text,
        attachment_id: m.attachment_id,
        attachmentName,
        attachmentIv,
        created_at: m.created_at,
      };
    },
    [],
  );

  const openThread = useCallback(
    async (peerUid: string) => {
      setActivePeerUid(peerUid);
      setPeerTyping(false);
      setKeyError(null);
      sharedKeyRef.current = null;

      try {
        const myPub = await e2eeClient.ensureIdentity(myUid);
        await api.publishPublicKey(myPub);

        const keyRes = await api.getPublicKey(peerUid);
        const sharedKey = await e2eeClient.getSharedKey(myUid, peerUid, keyRes.public_key_jwk);
        sharedKeyRef.current = sharedKey;

        const hist = await api.getMessageHistory(peerUid);
        const decrypted = await Promise.all(hist.messages.map((m) => decryptItem(sharedKey, m)));
        setMessages(decrypted);
        await api.markMessagesRead(peerUid);
        await refreshConversations();
      } catch (err) {
        setMessages([]);
        const msg =
          err instanceof Error
            ? err.message
            : 'Recipient must sign in at least once to publish E2EE keys';
        setKeyError(msg);
      }
    },
    [decryptItem, myUid, refreshConversations],
  );

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (initialPeerUid) {
      void openThread(initialPeerUid);
    }
  }, [initialPeerUid, openThread]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = async (msg: EncryptedMessageItem) => {
      if (msg.sender_uid === activePeerUid && sharedKeyRef.current) {
        const dec = await decryptItem(sharedKeyRef.current, msg);
        setMessages((prev) => [...prev, dec]);
        setPeerTyping(false);
        void api.markMessagesRead(msg.sender_uid);
      }
      void refreshConversations();
    };

    const onAck = async (msg: EncryptedMessageItem) => {
      if (msg.recipient_uid === activePeerUid && sharedKeyRef.current) {
        const dec = await decryptItem(sharedKeyRef.current, msg);
        setMessages((prev) => [...prev, dec]);
      }
      void refreshConversations();
    };

    const onTyping = (data: { from_uid: string; is_typing: boolean }) => {
      if (data.from_uid === activePeerUid) {
        setPeerTyping(data.is_typing);
      }
    };

    const onChatError = (data: { message?: string }) => {
      notify(data.message || 'Could not send message', 'danger');
    };

    socket.on('chat:message', onIncoming);
    socket.on('chat:ack', onAck);
    socket.on('chat:typing', onTyping);
    socket.on('chat:error', onChatError);
    return () => {
      socket.off('chat:message', onIncoming);
      socket.off('chat:ack', onAck);
      socket.off('chat:typing', onTyping);
      socket.off('chat:error', onChatError);
    };
  }, [activePeerUid, decryptItem, notify, refreshConversations, socket]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!activePeerUid || !draft.trim() || !socket) return;
    if (!sharedKeyRef.current) {
      notify('E2EE key exchange not ready yet. Click Retry.', 'warn');
      return;
    }
    soundEngine.playClick();
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const { ciphertext, iv } = await e2eeClient.encryptText(sharedKeyRef.current, text);
      socket.emit('chat:send', { target_uid: activePeerUid, ciphertext, iv });
      socket.emit('chat:typing', { target_uid: activePeerUid, is_typing: false });
    } catch {
      notify('Failed to encrypt message', 'danger');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file || !activePeerUid || !socket || !sharedKeyRef.current) return;
    try {
      const buf = await file.arrayBuffer();
      const { blob, iv: fileIv } = await e2eeClient.encryptBytes(sharedKeyRef.current, buf);
      const uploaded = await api.uploadEncryptedAttachment(blob);

      const { ciphertext, iv } = await e2eeClient.encryptText(
        sharedKeyRef.current,
        `Shared encrypted file: ${file.name}`,
      );
      const metaEnc = await e2eeClient.encryptText(
        sharedKeyRef.current,
        JSON.stringify({ name: file.name, iv: fileIv }),
      );

      socket.emit('chat:send', {
        target_uid: activePeerUid,
        ciphertext,
        iv,
        attachment_id: uploaded.attachment_id,
        attachment_meta_ct: metaEnc.ciphertext,
        attachment_meta_iv: metaEnc.iv,
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'File upload failed', 'danger');
    }
  };

  const handleDownloadAttachment = async (attId: string, name: string, fileIv?: string) => {
    if (!sharedKeyRef.current || !fileIv) return;
    try {
      const encBuf = await api.downloadEncryptedAttachment(attId);
      const plainBuf = await e2eeClient.decryptBytes(sharedKeyRef.current, encBuf, fileIv);
      const url = URL.createObjectURL(new Blob([plainBuf]));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notify('Could not decrypt attachment', 'danger');
    }
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!socket || !activePeerUid) return;
    const now = Date.now();
    if (now - typingEmitRef.current > 2000) {
      typingEmitRef.current = now;
      socket.emit('chat:typing', { target_uid: activePeerUid, is_typing: true });
    }
  };

  const handleStartNewChat = (e: FormEvent) => {
    e.preventDefault();
    const clean = newChatUid.trim();
    if (!/^\d{10}$/.test(clean)) {
      notify('Enter a valid 10-digit UID', 'warn');
      return;
    }
    if (clean === myUid) {
      notify('Cannot start a chat with yourself', 'warn');
      return;
    }
    setNewChatOpen(false);
    setNewChatUid('');
    void openThread(clean);
  };

  const query = search.trim().toLowerCase();
  const filteredConversations = conversations.filter(
    (c) => !query || c.peer_name.toLowerCase().includes(query) || c.peer_uid.includes(query),
  );
  const existingPeerUids = new Set(conversations.map((c) => c.peer_uid));
  const quickContacts = contacts.filter(
    (c) =>
      !existingPeerUids.has(c.contact_uid) &&
      (!query || c.contact_name.toLowerCase().includes(query) || c.contact_uid.includes(query)),
  );

  return (
    <div className="max-w-[720px] md:max-w-[1020px] mx-auto md:h-[calc(100dvh-7.5rem)] md:bg-surface md:border md:border-border-subtle md:rounded-lg md:overflow-hidden md:grid md:grid-cols-[320px_1fr]">
      {/* Left Pane: Conversations & Contacts (Hidden on mobile when a thread is open) */}
      <aside
        className={`${
          activePeerUid ? 'hidden md:flex' : 'flex'
        } flex-col md:border-r md:border-border-subtle md:min-h-0 md:overflow-hidden`}
      >
        <div className="md:p-4 md:pb-0">
          <div className="flex items-center justify-between gap-4 mb-5 md:mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">
                Messages
              </h2>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-text-muted">
                <Lock className="size-3 text-online" strokeWidth={1.75} />
                <span>End-to-end encrypted</span>
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                soundEngine.playClick();
                setNewChatOpen(true);
              }}
            >
              <Plus className="size-4" strokeWidth={1.75} />
              New
            </Button>
          </div>

          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search messages by name or UID..."
          />
        </div>

        <div className="md:flex-1 md:overflow-y-auto md:px-4 md:pb-4">
          {loadingConvs ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-md bg-elevated animate-pulse" />
              ))}
            </div>
          ) : filteredConversations.length === 0 && quickContacts.length === 0 ? (
            <div className="bg-surface border border-border-subtle rounded-lg p-10 text-center">
              <MessageSquare className="size-8 text-text-muted mx-auto" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-text-secondary">
                {query ? 'No matching conversations found.' : 'No conversations yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConversations.length > 0 ? (
                <div className="divide-y divide-border-subtle bg-surface border border-border-subtle rounded-lg overflow-hidden">
                  {filteredConversations.map((c) => {
                    const contactMatch = contacts.find((x) => x.contact_uid === c.peer_uid);
                    const isOnline = Boolean(contactMatch?.is_online);
                    const selected = activePeerUid === c.peer_uid;
                    return (
                      <button
                        key={c.peer_uid}
                        type="button"
                        onClick={() => void openThread(c.peer_uid)}
                        className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 transition-colors text-left cursor-pointer ${
                          selected ? 'bg-accent-muted' : 'hover:bg-hover/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-9 rounded-full bg-elevated border border-border-subtle flex items-center justify-center text-xs font-semibold text-text-primary shrink-0">
                            {c.peer_name.charAt(0).toUpperCase()}
                            {isOnline ? (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-online border-2 border-surface" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {c.peer_name}
                              </span>
                              {isOnline ? <Badge tone="online">Online</Badge> : null}
                              {c.unread_count > 0 ? (
                                <Badge tone="accent">{c.unread_count}</Badge>
                              ) : null}
                            </div>
                            <div className="mt-0.5 font-mono tabular-nums text-xs text-text-muted">
                              {formatUidDisplay(c.peer_uid)}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-text-muted shrink-0">
                          {formatLocalTime(c.created_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {quickContacts.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2 px-1">
                    Saved Contacts
                  </div>
                  <div className="divide-y divide-border-subtle bg-surface border border-border-subtle rounded-lg overflow-hidden">
                    {quickContacts.map((c) => {
                      const selected = activePeerUid === c.contact_uid;
                      return (
                        <button
                          key={c.contact_uid}
                          type="button"
                          onClick={() => void openThread(c.contact_uid)}
                          className={`w-full px-4 py-3 flex items-center justify-between gap-3 transition-colors text-left cursor-pointer ${
                            selected ? 'bg-accent-muted' : 'hover:bg-hover/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-9 rounded-full bg-elevated border border-border-subtle flex items-center justify-center text-text-secondary shrink-0">
                              <UserRound className="size-4" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-text-primary truncate">
                                {c.contact_name}
                              </div>
                              <div className="mt-0.5 font-mono tabular-nums text-xs text-text-muted">
                                {formatUidDisplay(c.contact_uid)}
                              </div>
                            </div>
                          </div>
                          <Badge tone={c.is_online ? 'online' : 'neutral'}>
                            {c.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {/* Right Pane: Active Thread (Full-screen on mobile when open; always visible on desktop) */}
      <section
        className={
          activePeerUid
            ? 'fixed inset-0 z-40 md:static md:z-auto bg-canvas md:bg-transparent flex flex-col min-h-0 overflow-hidden'
            : 'hidden md:flex flex-col min-h-0 overflow-hidden'
        }
      >
        {!activePeerUid ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="size-8 text-text-muted" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-text-primary">
              Select a conversation or contact
            </p>
            <p className="mt-1 text-xs text-text-muted max-w-[36ch]">
              Messages and files are end-to-end encrypted with ECDH P-256 and AES-GCM 256.
            </p>
          </div>
        ) : (
          <>
            <div className="h-14 shrink-0 px-4 border-b border-border-subtle bg-surface flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setActivePeerUid(null)}
                  aria-label="Back to Messages"
                  className="md:hidden size-8 rounded-full hover:bg-hover text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft className="size-4" strokeWidth={1.75} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {resolvePeerName(activePeerUid)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-online">
                      <Lock className="size-3" strokeWidth={1.75} />
                      End-to-end encrypted
                    </span>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-text-muted">
                    {peerTyping ? 'Typing...' : formatUidDisplay(activePeerUid)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStartCall(activePeerUid, resolvePeerName(activePeerUid))}
                className="size-9 rounded-full bg-elevated hover:bg-online hover:text-white border border-border-default text-text-secondary flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Call Contact"
              >
                <Phone className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {keyError ? (
              <div className="m-4 p-4 rounded-md bg-warn-bg border border-warn/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-text-primary">
                  <span className="font-semibold text-warn">E2EE Key Pending:</span> {keyError}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void openThread(activePeerUid)}
                >
                  <RefreshCw className="size-3.5" strokeWidth={1.5} />
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse">
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine = m.sender_uid === myUid;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                          mine
                            ? 'bg-accent text-white'
                            : 'bg-elevated border border-border-subtle text-text-primary'
                        }`}
                      >
                        <p className="break-words">{m.text}</p>
                        {m.attachment_id && m.attachmentName ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleDownloadAttachment(
                                m.attachment_id!,
                                m.attachmentName!,
                                m.attachmentIv,
                              )
                            }
                            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-black/25 hover:bg-black/40 text-xs cursor-pointer"
                          >
                            <Download className="size-3.5" strokeWidth={1.5} />
                            <span>{m.attachmentName}</span>
                          </button>
                        ) : null}
                        <div
                          className={`mt-1 text-[10px] font-mono tabular-nums ${
                            mine ? 'text-white/70' : 'text-text-muted'
                          }`}
                        >
                          {formatLocalTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleSend}
              className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border-subtle bg-surface flex items-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={Boolean(keyError)}
                onClick={() => fileInputRef.current?.click()}
                title="Attach Encrypted File"
                className="size-10 rounded-md bg-elevated hover:bg-hover border border-border-default text-text-secondary disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
              >
                <Paperclip className="size-4" strokeWidth={1.5} />
              </button>
              <input
                type="text"
                disabled={Boolean(keyError)}
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={
                  keyError ? 'Waiting for recipient E2EE key...' : 'Write a message...'
                }
                className="h-10 flex-1 bg-canvas border border-border-default rounded-md px-3 text-sm text-text-primary placeholder:text-text-muted disabled:opacity-50 outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || Boolean(keyError)}
                className="size-10 rounded-md bg-cta hover:bg-cta-hover text-cta-text disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Send message"
              >
                <Send className="size-4" strokeWidth={1.75} />
              </button>
            </form>
          </>
        )}
      </section>

      <Modal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="New Message"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewChatOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-chat-uid-form">
              Open Thread
            </Button>
          </>
        }
      >
        <form id="new-chat-uid-form" onSubmit={handleStartNewChat} className="space-y-4">
          <Input
            id="new-chat-uid"
            label="Recipient 10-Digit UID"
            placeholder="e.g. 2310002451"
            maxLength={10}
            value={newChatUid}
            onChange={(e) => setNewChatUid(e.target.value.replace(/\D/g, ''))}
            required
          />
          {contacts.length > 0 ? (
            <div>
              <div className="text-xs font-medium text-text-secondary mb-2">
                Or select a saved contact
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-border-subtle border border-border-subtle rounded-md bg-canvas/50">
                {contacts.map((c) => (
                  <button
                    key={c.contact_uid}
                    type="button"
                    onClick={() => {
                      setNewChatOpen(false);
                      void openThread(c.contact_uid);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-hover transition-colors cursor-pointer text-sm"
                  >
                    <span className="text-text-primary">{c.contact_name}</span>
                    <span className="font-mono text-xs text-text-muted">
                      {formatUidDisplay(c.contact_uid)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
