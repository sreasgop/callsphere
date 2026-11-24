import React, { useState, useEffect } from 'react';
import { Users, Plus, LogIn, Settings, Trash2, UserPlus, Copy, Shield } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import Swal from 'sweetalert2';

export const GroupsTab = () => {
    const { user } = useAuth();
    const { playClickSound } = useSound();
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupMembers, setGroupMembers] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [editGroupName, setEditGroupName] = useState('');
    const [selectedContactUid, setSelectedContactUid] = useState('');
    const [manualMemberUid, setManualMemberUid] = useState('');

    useEffect(() => {
        loadGroups();
        api.getContacts().then(res => setContacts(Array.isArray(res) ? res : []));
    }, []);

    const loadGroups = async () => {
        const res = await api.getMyGroups();
        setGroups(Array.isArray(res) ? res : []);
    };

    const handleCreateGroupModal = () => {
        playClickSound();
        Swal.fire({
            title: 'Create Group',
            html: `
                <input id="swal-group-name" class="swal2-input" placeholder="Group Name">
                <input id="swal-group-desc" class="swal2-input" placeholder="Description (Optional)">
            `,
            showCancelButton: true,
            confirmButtonText: 'Create & Join',
            background: 'rgba(20, 22, 27, 0.95)',
            color: '#fff',
            preConfirm: () => {
                const name = document.getElementById('swal-group-name').value.trim();
                const desc = document.getElementById('swal-group-desc').value.trim();
                if (!name) Swal.showValidationMessage('Group name is required');
                return { name, desc };
            }
        }).then(async (res) => {
            if (res.isConfirmed) {
                const result = await api.createGroup(res.value.name, res.value.desc);
                if (result.error) {
                    Swal.fire('Error', result.error, 'error');
                } else {
                    Swal.fire('Group Created!', `Group UID: ${result.group_uid}`, 'success');
                    loadGroups();
                }
            }
        });
    };

    const handleJoinGroupModal = () => {
        playClickSound();
        Swal.fire({
            title: 'Join Group',
            html: `
                <input id="swal-join-gid" class="swal2-input" placeholder="9-Digit Group UID (e.g. 9001234567)">
            `,
            showCancelButton: true,
            confirmButtonText: 'Join',
            background: 'rgba(20, 22, 27, 0.95)',
            color: '#fff',
            preConfirm: () => {
                const gid = document.getElementById('swal-join-gid').value.trim();
                if (!gid) Swal.showValidationMessage('Please enter a Group UID');
                return gid;
            }
        }).then(async (res) => {
            if (res.isConfirmed) {
                const result = await api.joinGroup(res.value);
                if (result.error) {
                    Swal.fire('Error', result.error, 'error');
                } else {
                    Swal.fire('Joined!', `Successfully joined ${result.group_name || 'group'}`, 'success');
                    loadGroups();
                }
            }
        });
    };

    const openManageModal = async (group) => {
        playClickSound();
        setSelectedGroup(group);
        setEditGroupName(group.group_name);
        const details = await api.getGroupDetails(group.group_uid);
        if (details.error) {
            Swal.fire('Error', details.error, 'error');
            return;
        }
        setGroupMembers(details.members || []);
        setIsManageModalOpen(true);
    };

    const handleCopyUid = (uid) => {
        navigator.clipboard.writeText(uid);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Group UID copied!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1a1d21',
            color: '#fff'
        });
    };

    const handleRename = async () => {
        if (!editGroupName.trim()) return;
        const res = await api.updateGroup(selectedGroup.group_uid, editGroupName.trim());
        if (res.error) {
            Swal.fire('Error', res.error, 'error');
        } else {
            Swal.fire('Updated', 'Group name updated successfully', 'success');
            setSelectedGroup(prev => ({ ...prev, group_name: editGroupName.trim() }));
            loadGroups();
        }
    };

    const handleAddMember = async () => {
        const target = selectedContactUid || manualMemberUid.trim();
        if (!target) {
            Swal.fire('Warning', 'Select a contact or enter a UID', 'warning');
            return;
        }
        const res = await api.addGroupMember(selectedGroup.group_uid, target);
        if (res.error) {
            Swal.fire('Error', res.error, 'error');
        } else {
            Swal.fire('Added', 'Member added to group', 'success');
            setManualMemberUid('');
            setSelectedContactUid('');
            const details = await api.getGroupDetails(selectedGroup.group_uid);
            setGroupMembers(details.members || []);
        }
    };

    const handleRemoveMember = async (memberUid) => {
        const res = await api.removeGroupMember(selectedGroup.group_uid, memberUid);
        if (res.error) {
            Swal.fire('Error', res.error, 'error');
        } else {
            const details = await api.getGroupDetails(selectedGroup.group_uid);
            setGroupMembers(details.members || []);
        }
    };

    const handleDeleteGroup = async () => {
        const result = await Swal.fire({
            title: 'Delete Group?',
            text: 'This will permanently remove this group and all member memberships.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            confirmButtonText: 'Yes, Delete',
            background: '#1a1d21',
            color: '#fff'
        });

        if (result.isConfirmed) {
            const res = await api.deleteGroup(selectedGroup.group_uid);
            if (res.error) {
                Swal.fire('Error', res.error, 'error');
            } else {
                Swal.fire('Deleted', 'Group deleted', 'success');
                setIsManageModalOpen(false);
                loadGroups();
            }
        }
    };

    const isCurrentAdmin = selectedGroup && selectedGroup.role === 'admin';

    return (
        <div>
            <div className="section-header">
                <h3>My Groups</h3>
                <div className="d-flex align-items-center gap-2">
                    <button className="btn-action bg-secondary bg-opacity-25" onClick={handleJoinGroupModal}>
                        <LogIn size={16} /> Join
                    </button>
                    <button className="btn-action" onClick={handleCreateGroupModal}>
                        <Plus size={16} /> Create
                    </button>
                </div>
            </div>

            <div className="groups-list">
                {groups.length === 0 ? (
                    <div className="text-center text-muted my-5">You are not a member of any groups yet</div>
                ) : (
                    groups.map((g, i) => (
                        <div key={i} className="list-item" onClick={() => openManageModal(g)} style={{ cursor: 'pointer' }}>
                            <div className="item-info">
                                <div className="item-avatar">
                                    <Users size={20} />
                                </div>
                                <div className="item-text">
                                    <h4 className="d-flex align-items-center gap-2">
                                        {g.group_name}
                                        {g.role === 'admin' && (
                                            <span className="badge bg-warning text-dark rounded-pill" style={{ fontSize: '0.65rem' }}>
                                                Admin
                                            </span>
                                        )}
                                    </h4>
                                    <p>ID: {g.group_uid} {g.description ? `• ${g.description}` : ''}</p>
                                </div>
                            </div>
                            <button className="btn-icon-action" title="Manage Group">
                                <Settings size={18} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Group Management Modal */}
            {isManageModalOpen && selectedGroup && (
                <div className="modal-backdrop-custom d-flex align-items-center justify-content-center" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.75)',
                    zIndex: 1050,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div className="modal-card p-4 rounded-4" style={{
                        background: '#16191f',
                        width: '90%',
                        maxWidth: '560px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h4 className="text-white mb-0">{selectedGroup.group_name}</h4>
                                <div
                                    className="text-muted small font-monospace d-flex align-items-center gap-1 mt-1"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleCopyUid(selectedGroup.group_uid)}
                                    title="Click to copy UID"
                                >
                                    <span>ID: {selectedGroup.group_uid}</span>
                                    <Copy size={13} className="text-primary" />
                                </div>
                            </div>
                            <button className="btn btn-sm text-white" onClick={() => setIsManageModalOpen(false)}>✕</button>
                        </div>

                        {/* Admin Controls */}
                        {isCurrentAdmin && (
                            <div className="p-3 mb-4 rounded-3 border border-secondary border-opacity-50" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="d-flex align-items-center gap-2 mb-3 text-primary fw-semibold small">
                                    <Shield size={16} /> Admin Controls
                                </div>
                                <div className="d-flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm bg-dark text-white border-secondary"
                                        value={editGroupName}
                                        onChange={(e) => setEditGroupName(e.target.value)}
                                        placeholder="Rename group"
                                    />
                                    <button className="btn btn-sm btn-primary px-3" onClick={handleRename}>Save</button>
                                </div>

                                <div className="mb-2">
                                    <label className="form-label small text-muted mb-1">Add Member from Contacts</label>
                                    <select
                                        className="form-select form-select-sm bg-dark text-white border-secondary mb-2"
                                        value={selectedContactUid}
                                        onChange={(e) => {
                                            setSelectedContactUid(e.target.value);
                                            setManualMemberUid('');
                                        }}
                                    >
                                        <option value="">Select from Contacts...</option>
                                        {contacts.map((c, i) => (
                                            <option key={i} value={c.contact_uid || c.target_uid}>
                                                {c.contact_name || c.nickname} ({c.contact_uid || c.target_uid})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="d-flex gap-2">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm bg-dark text-white border-secondary"
                                            value={manualMemberUid}
                                            onChange={(e) => {
                                                setManualMemberUid(e.target.value);
                                                setSelectedContactUid('');
                                            }}
                                            placeholder="Or enter 10-digit UID manually"
                                        />
                                        <button className="btn btn-sm btn-success px-3" onClick={handleAddMember}>Add</button>
                                    </div>
                                </div>

                                <hr className="border-secondary my-3" />
                                <button className="btn btn-sm btn-outline-danger w-100" onClick={handleDeleteGroup}>
                                    <Trash2 size={14} className="me-1" /> Delete Group
                                </button>
                            </div>
                        )}

                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="text-muted mb-0">Members</h6>
                            <span className="badge bg-secondary">{groupMembers.length}</span>
                        </div>

                        <div className="member-list">
                            {groupMembers.map((m, i) => {
                                const isMe = m.user_uid === user?.sip_uid;
                                return (
                                    <div key={i} className="d-flex justify-content-between align-items-center p-2 border-bottom border-secondary border-opacity-25">
                                        <div>
                                            <div className="text-white fw-medium small">
                                                {m.full_name || 'Member'}
                                                {m.role === 'admin' && (
                                                    <span className="text-warning ms-1" title="Group Admin">★</span>
                                                )}
                                                {isMe && <span className="badge bg-primary ms-2" style={{ fontSize: '0.6rem' }}>You</span>}
                                            </div>
                                            <div className="text-muted font-monospace" style={{ fontSize: '0.75rem' }}>{m.user_uid}</div>
                                        </div>
                                        {isCurrentAdmin && !isMe && (
                                            <button className="btn btn-sm btn-outline-danger py-0 px-2" style={{ fontSize: '0.75rem' }} onClick={() => handleRemoveMember(m.user_uid)}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
