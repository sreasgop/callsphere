export type PrivacyMode = 'everyone' | 'contacts_only' | 'dnd';

export interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  uid: string;
  avatar_color: string;
  status_message: string;
  privacy_mode: PrivacyMode;
  two_factor_enabled?: boolean;
}

export interface ContactItem {
  id?: number;
  contact_uid: string;
  contact_name: string;
  is_favorite?: boolean;
  is_online?: boolean;
}

export interface CallLogItem {
  id: number;
  caller_uid: string;
  callee_uid: string;
  started_at: string;
  duration: number;
  status: 'ringing' | 'active' | 'completed' | 'missed' | 'declined' | 'busy';
  direction: 'inbound' | 'outbound';
}

export interface GroupItem {
  group_uid: string;
  group_name: string;
  description: string;
  role: 'admin' | 'member';
}

export interface GroupMemberItem {
  user_uid: string;
  role: 'admin' | 'member';
  joined_at: string;
  full_name: string | null;
}

export interface GroupDetailsResponse {
  group: {
    id: number;
    group_uid: string;
    group_name: string;
    description: string;
    created_by: number;
    created_at: string;
  };
  members: GroupMemberItem[];
}

export interface BlockedItem {
  blocked_uid: string;
  created_at: string;
}

export interface EncryptedMessageItem {
  id: number;
  conversation_id: string;
  sender_uid: string;
  recipient_uid: string;
  ciphertext: string;
  iv: string;
  attachment_id?: string | null;
  attachment_meta_ct?: string | null;
  attachment_meta_iv?: string | null;
  is_read: number | boolean;
  created_at: string;
}

export interface ConversationItem extends EncryptedMessageItem {
  peer_uid: string;
  peer_name: string;
  unread_count: number;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
  prefix = '/api/v1',
): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const res = await fetch(`${prefix}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 && retryOn401 && !path.startsWith('/auth/')) {
    const refreshed = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      return requestJson<T>(path, init, false, prefix);
    }
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register(full_name: string, email: string, password: string) {
    return requestJson<{ success: boolean; uid: string; full_name: string; email: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ full_name, email, password }),
      },
      false,
    );
  },

  login(email: string, password: string) {
    return requestJson<{ success: boolean; user: UserProfile }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false,
    );
  },

  async loginV2(email: string, password: string) {
    const res = await fetch('/api/v2/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      requires_otp?: boolean;
      challenge_token?: string;
      delivery?: string;
      user?: UserProfile;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }
    return data;
  },

  async verifyOtp(challenge_token: string, otp: string) {
    const res = await fetch('/api/v2/auth/otp/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_token, otp }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success: boolean;
      user: UserProfile;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Verification failed (${res.status})`);
    }
    return data;
  },

  async toggleTwoFactor(enabled: boolean) {
    const res = await fetch('/api/v2/auth/2fa', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success: boolean;
      two_factor_enabled: boolean;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },

  logout() {
    return requestJson<{ success: boolean }>('/auth/logout', { method: 'POST' }, false);
  },

  me() {
    return requestJson<{ user: UserProfile }>('/auth/me');
  },

  updateSettings(privacy_mode: PrivacyMode, status_message = 'Available') {
    return requestJson<{ success: boolean; privacy_mode: PrivacyMode; status_message: string }>(
      '/auth/settings',
      {
        method: 'PATCH',
        body: JSON.stringify({ privacy_mode, status_message }),
      },
    );
  },

  getContacts() {
    return requestJson<{ contacts: ContactItem[] }>('/contacts');
  },

  addContact(contact_uid: string, contact_name?: string) {
    return requestJson<{ success: boolean; contact: ContactItem }>('/contacts', {
      method: 'POST',
      body: JSON.stringify({ contact_uid, contact_name: contact_name || undefined }),
    });
  },

  getBlocked() {
    return requestJson<{ blocked: BlockedItem[] }>('/contacts/blocked');
  },

  blockUid(blocked_uid: string) {
    return requestJson<{ success: boolean }>('/contacts/block', {
      method: 'POST',
      body: JSON.stringify({ blocked_uid }),
    });
  },

  unblockUid(blocked_uid: string) {
    return requestJson<{ success: boolean }>(`/contacts/block/${blocked_uid}`, {
      method: 'DELETE',
    });
  },

  getCallHistory() {
    return requestJson<{ calls: CallLogItem[] }>('/calls/history');
  },

  logCall(
    callee_uid: string,
    status: CallLogItem['status'],
    duration: number,
  ) {
    return requestJson<{ success: boolean }>('/calls/log', {
      method: 'POST',
      body: JSON.stringify({ callee_uid, status, duration }),
    });
  },

  getIceServers() {
    return requestJson<{ ice_servers: RTCIceServer[] }>('/calls/ice-servers');
  },

  getGroups() {
    return requestJson<{ groups: GroupItem[] }>('/groups');
  },

  createGroup(group_name: string, description = '') {
    return requestJson<{ success: boolean; group_uid: string; group_name: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ group_name, description }),
    });
  },

  joinGroup(group_uid: string) {
    return requestJson<{ success: boolean; group_name: string }>('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ group_uid }),
    });
  },

  getGroupDetails(group_uid: string) {
    return requestJson<GroupDetailsResponse>(`/groups/${group_uid}`);
  },

  renameGroup(group_uid: string, group_name: string) {
    return requestJson<{ success: boolean; group_name: string }>(`/groups/${group_uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ group_name }),
    });
  },

  deleteGroup(group_uid: string) {
    return requestJson<{ success: boolean }>(`/groups/${group_uid}`, {
      method: 'DELETE',
    });
  },

  addGroupMember(group_uid: string, user_uid: string) {
    return requestJson<{ success: boolean }>(`/groups/${group_uid}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_uid }),
    });
  },

  removeGroupMember(group_uid: string, user_uid: string) {
    return requestJson<{ success: boolean }>(`/groups/${group_uid}/members/${user_uid}`, {
      method: 'DELETE',
    });
  },

  publishPublicKey(public_key_jwk: JsonWebKey) {
    return requestJson<{ success: boolean }>(
      '/keys/public',
      {
        method: 'PUT',
        body: JSON.stringify({ public_key_jwk }),
      },
      true,
      '/api/v2',
    );
  },

  getPublicKey(targetUid: string) {
    return requestJson<{ uid: string; public_key_jwk: JsonWebKey }>(
      `/keys/${targetUid}`,
      {},
      true,
      '/api/v2',
    );
  },

  async getConversations() {
    try {
      return await requestJson<{ conversations: ConversationItem[] }>(
        '/messages/conversations',
        {},
        true,
        '/api/v2',
      );
    } catch {
      return { conversations: [] as ConversationItem[] };
    }
  },

  async getMessageHistory(peerUid: string, beforeId?: number) {
    const qs = beforeId ? `?before_id=${beforeId}` : '';
    try {
      return await requestJson<{ messages: EncryptedMessageItem[] }>(
        `/messages/history/${peerUid}${qs}`,
        {},
        true,
        '/api/v2',
      );
    } catch {
      return { messages: [] as EncryptedMessageItem[] };
    }
  },

  async markMessagesRead(sender_uid: string) {
    try {
      await requestJson<{ success: boolean }>(
        '/messages/read',
        {
          method: 'POST',
          body: JSON.stringify({ sender_uid }),
        },
        true,
        '/api/v2',
      );
    } catch {
      // Non-critical read-receipt failure
    }
  },

  uploadEncryptedAttachment(blob: Blob) {
    const form = new FormData();
    form.append('file', blob, 'encrypted.bin');
    return requestJson<{ attachment_id: string; byte_size: number }>(
      '/attachments',
      {
        method: 'POST',
        body: form,
      },
      true,
      '/api/v2',
    );
  },

  async downloadEncryptedAttachment(attachmentId: string): Promise<ArrayBuffer> {
    let res = await fetch(`/api/v2/attachments/${attachmentId}`, { credentials: 'include' });
    if (res.status === 401) {
      const refreshed = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshed.ok) {
        res = await fetch(`/api/v2/attachments/${attachmentId}`, { credentials: 'include' });
      }
    }
    if (!res.ok) throw new Error('Failed to download encrypted attachment');
    return res.arrayBuffer();
  },
};
