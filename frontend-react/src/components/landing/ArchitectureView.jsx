import React from 'react';
import { Server, Database, Globe, Cpu, Layers, GitBranch, ShieldCheck } from 'lucide-react';

export const ArchitectureView = () => {
    return (
        <div className="landing-page-content">
            <div className="text-center my-5">
                <h1 className="hero-title mb-3">The Engine Beneath.</h1>
                <p className="text-muted" style={{ maxWidth: '700px', margin: '0 auto' }}>
                    A transparent look at the core architecture powering CallSphere's SIM-free communication grid.
                </p>
            </div>

            {/* Core Tech Stack */}
            <section className="mb-5">
                <h3 className="text-white text-center mb-4">Core Technology Stack</h3>
                <div className="stack-grid">
                    <div className="tech-card">
                        <Cpu className="text-primary mb-2 mx-auto" size={36} />
                        <h4>Python FastAPI</h4>
                        <p className="small text-muted mb-0">Async WebSockets & REST API</p>
                    </div>
                    <div className="tech-card">
                        <Globe className="text-success mb-2 mx-auto" size={36} />
                        <h4>WebRTC API</h4>
                        <p className="small text-muted mb-0">STUN NAT Traversal & SRTP Media</p>
                    </div>
                    <div className="tech-card">
                        <Database className="text-info mb-2 mx-auto" size={36} />
                        <h4>SQLite / MySQL</h4>
                        <p className="small text-muted mb-0">Dual-Persistence Schema</p>
                    </div>
                    <div className="tech-card">
                        <Layers className="text-warning mb-2 mx-auto" size={36} />
                        <h4>React 18 + Vite</h4>
                        <p className="small text-muted mb-0">Real-time Reactive SPA</p>
                    </div>
                    <div className="tech-card">
                        <ShieldCheck className="text-danger mb-2 mx-auto" size={36} />
                        <h4>Bcrypt + JWT</h4>
                        <p className="small text-muted mb-0">Auth & Credential Hashing</p>
                    </div>
                </div>
            </section>

            {/* 3-Tier Design Flowchart */}
            <section className="my-5 p-4 rounded-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="text-white text-center mb-4">Three-Tier Architecture & Signaling Flow</h3>
                <div className="d-flex flex-wrap justify-content-around align-items-center gap-4 text-center my-4">
                    <div className="node p-4 rounded-3 border border-primary" style={{ background: '#0e1117', minWidth: '220px' }}>
                        <span className="badge bg-primary mb-2">Tier 1</span>
                        <h5 className="text-white mb-1">Presentation Layer</h5>
                        <p className="text-muted small mb-0">React SPA + WebRTC Engine</p>
                    </div>

                    <div className="text-muted fs-4">⇄</div>

                    <div className="node p-4 rounded-3 border border-info" style={{ background: '#0e1117', minWidth: '220px' }}>
                        <span className="badge bg-info text-dark mb-2">Tier 2</span>
                        <h5 className="text-white mb-1">Signaling Engine</h5>
                        <p className="text-muted small mb-0">FastAPI Async WebSockets</p>
                    </div>

                    <div className="text-muted fs-4">⇄</div>

                    <div className="node p-4 rounded-3 border border-warning" style={{ background: '#0e1117', minWidth: '220px' }}>
                        <span className="badge bg-warning text-dark mb-2">Tier 3</span>
                        <h5 className="text-white mb-1">Data Layer</h5>
                        <p className="text-muted small mb-0">SQLite3 / MySQL Database</p>
                    </div>
                </div>
            </section>

            {/* Viva FAQ Section */}
            <section className="my-5">
                <h3 className="text-white text-center mb-4">College Viva / Project Defense Q&A</h3>
                <div className="accordion bg-transparent" id="vivaAccordion">
                    <div className="card bg-dark text-white border-secondary mb-3 rounded-3">
                        <div className="card-body">
                            <h5 className="text-primary mb-2">Q: How does 10-Digit UID routing work?</h5>
                            <p className="text-muted mb-0 small">
                                When a user registers, the server generates a unique 10-digit random number stored in the DB. When a WebSocket connects (<code>/ws/{'{uid}'}</code>), the server maps the socket connection to that UID in memory (<code>ConnectionManager</code>).
                            </p>
                        </div>
                    </div>
                    <div className="card bg-dark text-white border-secondary mb-3 rounded-3">
                        <div className="card-body">
                            <h5 className="text-primary mb-2">Q: How is media transmitted?</h5>
                            <p className="text-muted mb-0 small">
                                Media (audio & video) is transmitted <strong>directly Peer-to-Peer</strong> between browsers using WebRTC (<code>RTCPeerConnection</code>). The server only handles signaling (SDP Offer/Answer & ICE candidates).
                            </p>
                        </div>
                    </div>
                    <div className="card bg-dark text-white border-secondary mb-3 rounded-3">
                        <div className="card-body">
                            <h5 className="text-primary mb-2">Q: How are NATs and firewalls handled?</h5>
                            <p className="text-muted mb-0 small">
                                The application configures public <strong>STUN Servers</strong> (<code>stun:stun.l.google.com:19302</code>) to discover public IP/port pairs for peers behind routers and home NATs.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
