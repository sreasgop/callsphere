import React from 'react';

export const TeamView = () => {
    const team = [
        {
            name: 'Chandra Sreas Gop',
            designation: 'Lead Architect',
            badge: 'FULL STACK',
            accent: '#6c5ce7',
            uid: 'TIU-231001102451',
            focus: 'System Design, WebRTC Signaling & DB Architecture',
            img: '/images/Chandra.png'
        },
        {
            name: 'Soutrika Das',
            designation: 'Frontend Engineer',
            badge: 'UI / UX',
            accent: '#e84393',
            uid: 'TIU-231001102454',
            focus: 'Interaction Design & Glassmorphism Aesthetics',
            img: '/images/Soutrika.png'
        },
        {
            name: 'Sanjib Kumar Sah',
            designation: 'Technical Associate',
            badge: 'DEV SUPPORT',
            accent: '#00b894',
            uid: 'TIU-231001102492',
            focus: 'Implementation Research & API Integration',
            img: '/images/Sanjib.png'
        },
        {
            name: 'Swati Kumari',
            designation: 'Research Analyst',
            badge: 'RESEARCH',
            accent: '#e17055',
            uid: 'TIU-231001102488',
            focus: 'VoIP Protocols, NAT Traversal & Market Analytics',
            img: '/images/Swati.png'
        }
    ];

    return (
        <div className="landing-page-content">
            <div className="text-center my-5">
                <h1 className="hero-title mb-3">Architects of the Application.</h1>
                <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    The college engineering team responsible for the CallSphere Internet Telephony infrastructure.
                </p>
            </div>

            <div className="team-grid">
                {team.map((m, idx) => (
                    <div key={idx} className="member-card" style={{ '--accent-color': m.accent }}>
                        <div className="card-inner">
                            <div className="card-front text-center p-4">
                                <div className="avatar-box mx-auto mb-3" style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${m.accent}` }}>
                                    <img
                                        src={m.img}
                                        alt={m.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </div>
                                <h4 className="text-white mb-1">{m.name}</h4>
                                <span className="text-muted small designation">{m.designation}</span>
                            </div>
                            <div className="card-overlay p-4">
                                <div className="overlay-content">
                                    <div className="tech-badge mb-3 badge" style={{ background: m.accent }}>{m.badge}</div>
                                    <div className="info-row d-flex justify-content-between mb-2">
                                        <span className="text-muted small">College UID:</span>
                                        <code className="text-white small">{m.uid}</code>
                                    </div>
                                    <div className="info-row d-flex justify-content-between mb-2">
                                        <span className="text-muted small">Focus:</span>
                                        <span className="text-white small text-end">{m.focus}</span>
                                    </div>
                                    <div className="info-row d-flex justify-content-between">
                                        <span className="text-muted small">Status:</span>
                                        <span className="text-success small fw-semibold">● Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
