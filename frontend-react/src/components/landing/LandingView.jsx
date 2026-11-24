import React from 'react';
import { Phone, Users, Shield, Laptop, Smartphone, CheckCircle, ArrowRight } from 'lucide-react';

export const LandingView = ({ setCurrentView }) => {
    return (
        <div className="landing-page-content">
            {/* Hero */}
            <header className="hero text-center">
                <div className="tagline-box mb-3">No SIM. No Carrier. Just You.</div>
                <h1 className="hero-title">
                    The Phone that Lives<br />in Your Browser.
                </h1>
                <p className="hero-subtitle">
                    Get a permanent 10-digit virtual UID instantly. Make crystal-clear peer-to-peer Audio & Video calls to anyone, anywhere, across any device.
                </p>
                <div className="d-flex justify-content-center gap-3 mt-4">
                    <button className="btn-cta btn-lg" onClick={() => setCurrentView('auth')}>
                        Get Your Number <ArrowRight size={18} className="ms-2" />
                    </button>
                    <button className="btn btn-outline-light rounded-pill px-4" onClick={() => setCurrentView('architecture')}>
                        View Architecture
                    </button>
                </div>
            </header>

            {/* Feature 1: Core Phone */}
            <section className="section-split">
                <div className="split-content">
                    <div className="feature-label text-primary">THE EXPERIENCE</div>
                    <h2>A Full Mobile Phone,<br />On the Web.</h2>
                    <p>
                        We didn't just build another chat client. We built an internet telephone. Use the familiar numeric keypad to dial 10-digit UIDs. Track your calls with rich history—missed, incoming, and outgoing with one-tap redial.
                    </p>
                    <ul className="feature-bullets">
                        <li><CheckCircle className="text-primary me-2" size={18} /> Missed Call Alerts & Recents History</li>
                        <li><CheckCircle className="text-primary me-2" size={18} /> Custom Contact Nicknames & Real-Time Presence</li>
                        <li><CheckCircle className="text-primary me-2" size={18} /> Encrypted WebRTC Peer-to-Peer Media</li>
                    </ul>
                </div>
                <div className="split-visual text-center">
                    <div className="visual-card">
                        <Phone size={64} className="text-primary mb-3" />
                        <div className="font-monospace fs-4 text-white">UID: 7629-021-900</div>
                        <span className="badge bg-success rounded-pill mt-2">VoIP Online</span>
                    </div>
                </div>
            </section>

            {/* Feature 2: Groups */}
            <section className="section-split">
                <div className="split-content">
                    <div className="feature-label text-info">GROUP CONFERENCING</div>
                    <h2>"Study Buddies"<br />One Tap Away.</h2>
                    <p>
                        Create named groups starting with 9-digit UIDs and dial everyone simultaneously. CallSphere handles multi-user connections effortlessly, with admin permissions, contact inviting, and group management.
                    </p>
                    <ul className="feature-bullets">
                        <li><CheckCircle className="text-info me-2" size={18} /> 9-Digit Conference Rooms with Instant Invite</li>
                        <li><CheckCircle className="text-info me-2" size={18} /> Admin Controls: Rename, Add, or Remove Members</li>
                    </ul>
                </div>
                <div className="split-visual text-center">
                    <div className="visual-card">
                        <Users size={64} className="text-info mb-3" />
                        <div className="font-monospace fs-4 text-white">Room: 9001-245-812</div>
                        <span className="badge bg-info text-dark rounded-pill mt-2">Active Conference</span>
                    </div>
                </div>
            </section>

            {/* Feature 3: Privacy */}
            <section className="section-split">
                <div className="split-content">
                    <div className="feature-label text-warning">TOTAL PRIVACY CONTROL</div>
                    <h2>Your Line, Your Rules.</h2>
                    <p>
                        Traditional mobile numbers attract spam. CallSphere puts you in control with zero-trust privacy rules right in your settings.
                    </p>
                    <ul className="feature-bullets">
                        <li><CheckCircle className="text-warning me-2" size={18} /> <strong>Contacts Only Mode:</strong> Block calls from strangers.</li>
                        <li><CheckCircle className="text-warning me-2" size={18} /> <strong>Do Not Disturb:</strong> Silence calls across all devices.</li>
                        <li><CheckCircle className="text-warning me-2" size={18} /> <strong>Hardware Selector:</strong> Select webcams & toggle haptics.</li>
                    </ul>
                </div>
                <div className="split-visual text-center">
                    <div className="visual-card">
                        <Shield size={64} className="text-warning mb-3" />
                        <div className="fs-5 text-white">Encrypted & Governed</div>
                        <span className="badge bg-warning text-dark rounded-pill mt-2">Zero Spam Guarantee</span>
                    </div>
                </div>
            </section>

            {/* CTA Bottom Banner */}
            <section className="cta-banner text-center my-5 p-5 rounded-4" style={{ background: 'rgba(108, 92, 231, 0.1)', border: '1px solid rgba(108, 92, 231, 0.3)' }}>
                <h2 className="text-white mb-2">Ready to claim your Virtual Phone Number?</h2>
                <p className="text-muted mb-4">No mobile phone SIM or phone plan required. Completely browser-based.</p>
                <button className="btn-cta btn-lg" onClick={() => setCurrentView('auth')}>
                    Get Your Free UID Now <ArrowRight size={18} className="ms-2" />
                </button>
            </section>
        </div>
    );
};
