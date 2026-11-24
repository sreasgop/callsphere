import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, ArrowLeft, PhoneCall, MessageSquare, Edit3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../context/WebRTCContext';
import { api } from '../../utils/api';
import { formatISTTime } from '../../utils/time';

export const MessagesTab = () => {
    const { user } = useAuth();
    const {
        conversations,
        loadConversations,
        activeChatTarget,
        setActiveChatTarget,
        chatMessages,
        setChatMessages,
        unreadMessages,
        setUnreadMessages,
        activeTypingUsers,
        sendTypingSignal,
        sendChatMessage,
        resolveContact,
        startCall
    } = useWebRTC();

    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (activeChatTarget && user?.sip_uid) {
            api.getMessages(user.sip_uid, activeChatTarget).then(list => {
                setChatMessages(Array.isArray(list) ? list : []);
                scrollToBottom();
            });
            api.markMessagesRead(user.sip_uid, activeChatTarget);
            setUnreadMessages(prev => {
                const next = { ...prev };
                delete next[activeChatTarget];
                return next;
            });
        }
    }, [activeChatTarget]);

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, activeTypingUsers]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSelectConversation = (peerUid) => {
        setActiveChatTarget(String(peerUid));
    };

    const handleBackToList = () => {
        setActiveChatTarget(null);
    };

    const handleTypingKeystroke = (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
            return;
        }

        if (activeChatTarget) {
            sendTypingSignal(activeChatTarget, true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                sendTypingSignal(activeChatTarget, false);
            }, 2000);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !activeChatTarget || !user) return;
        const text = messageInput.trim();
        setMessageInput('');

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendTypingSignal(activeChatTarget, false);

        await sendChatMessage(activeChatTarget, text);
    };

    const safeConversations = Array.isArray(conversations) ? conversations : [];
    const safeMessages = Array.isArray(chatMessages) ? chatMessages : [];

    const filteredConversations = safeConversations.filter(c => {
        if (!c) return false;
        const peerUid = String(c.peer_uid || '');
        const peerName = resolveContact(peerUid).toLowerCase();
        const q = searchQuery.toLowerCase();
        return peerUid.includes(q) || peerName.includes(q);
    });

    const activeTargetStr = String(activeChatTarget || '');
    const activeChatName = activeTargetStr ? resolveContact(activeTargetStr) : '';

    return (
        <div className="messages-container">
            {/* Sidebar List Panel */}
            <div className={`conversations-sidebar ${activeChatTarget ? 'mobile-hidden' : ''}`}>
                <div className="conversations-header">
                    <h3>Messages</h3>
                </div>
                <div className="conversations-search">
                    <div className="position-relative">
                        <input
                            type="text"
                            className="form-control glass-input"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="conversations-list">
                    {filteredConversations.length === 0 ? (
                        <div className="text-center text-muted my-4 small">No conversations yet</div>
                    ) : (
                        filteredConversations.map((c) => {
                            const peerUidStr = String(c.peer_uid || '');
                            const displayName = resolveContact(peerUidStr);
                            const isTyping = activeTypingUsers ? activeTypingUsers.has(peerUidStr) : false;
                            const unread = unreadMessages ? (unreadMessages[peerUidStr] || 0) : 0;
                            const lastMsg = c.last_message || c.text || 'Start chatting';
                            const timeStr = formatISTTime(c.last_timestamp || c.created_at);
                            return (
                                <div
                                    key={peerUidStr}
                                    className={`conversation-item ${activeTargetStr === peerUidStr ? 'active' : ''}`}
                                    onClick={() => handleSelectConversation(peerUidStr)}
                                >
                                    <div className="conversation-avatar">
                                        {displayName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="conversation-name">{displayName}</div>
                                            <div className="conversation-time">{timeStr}</div>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="conversation-last-msg">
                                                {isTyping ? (
                                                    <span className="text-success fw-bold d-inline-flex align-items-center gap-1">
                                                        <Edit3 size={12} /> typing...
                                                    </span>
                                                ) : (
                                                    lastMsg
                                                )}
                                            </div>
                                            {unread > 0 && (
                                                <span className="badge rounded-pill bg-danger ms-2">{unread}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Chat Panel */}
            <div className={`chat-main-panel ${activeChatTarget ? 'mobile-active' : ''}`}>
                {!activeChatTarget ? (
                    <div className="chat-empty-state">
                        <MessageSquare size={48} className="text-muted mb-3" />
                        <h4 className="text-white fw-semibold">Select a conversation</h4>
                        <p className="text-muted small">Choose a chat from the sidebar or start a new conversation</p>
                    </div>
                ) : (
                    <div className="chat-active-window">
                        <div className="chat-header">
                            <div className="d-flex align-items-center gap-3">
                                <button className="btn-action p-2 d-md-none" onClick={handleBackToList}>
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="chat-avatar">
                                    {activeChatName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="m-0 fs-6 fw-bold text-white">{activeChatName}</h4>
                                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{activeTargetStr}</div>
                                    {activeTypingUsers && activeTypingUsers.has(activeTargetStr) && (
                                        <span className="text-success small fw-medium">typing...</span>
                                    )}
                                </div>
                            </div>
                            <button
                                className="btn-icon-action contact-call-btn"
                                onClick={() => startCall(activeTargetStr, true)}
                                title="Call Contact"
                            >
                                <PhoneCall size={16} />
                            </button>
                        </div>

                        <div className="chat-messages-body">
                            {safeMessages.map((msg, i) => {
                                const isOutgoing = String(msg?.sender_uid) === String(user?.sip_uid);
                                return (
                                    <div
                                        key={msg?.id || i}
                                        className={`chat-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}
                                    >
                                        <div>{msg?.text}</div>
                                        <div className="chat-bubble-time">{formatISTTime(msg?.created_at || msg?.timestamp)}</div>
                                    </div>
                                );
                            })}

                            {activeTypingUsers && activeTypingUsers.has(activeTargetStr) && (
                                <div className="chat-bubble incoming typing-bubble">
                                    <div className="typing-indicator-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-wrapper">
                            <input
                                type="text"
                                className="chat-input-field"
                                placeholder="Type a message..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleTypingKeystroke}
                            />
                            <button className="chat-send-btn" onClick={handleSendMessage}>
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
