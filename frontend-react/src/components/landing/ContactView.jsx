import React, { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export const ContactView = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
        Swal.fire({
            title: 'Transmission Received',
            text: 'Thank you for contacting the CallSphere Engineering team.',
            icon: 'success',
            background: '#1a1d21',
            color: '#fff'
        });
        setName('');
        setEmail('');
        setMessage('');
    };

    return (
        <div className="landing-page-content">
            <div className="text-center my-5">
                <h1 className="hero-title mb-3">Establish Uplink.</h1>
                <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    Initiate a direct transmission to the CallSphere project engineering division.
                </p>
            </div>

            <div className="row g-4 my-4 justify-content-center">
                <div className="col-md-5">
                    <div className="p-4 rounded-4 h-100" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <h4 className="text-white mb-4">Project Inquiries</h4>
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <div className="p-2 rounded-circle bg-primary bg-opacity-25 text-primary">
                                <Mail size={20} />
                            </div>
                            <div>
                                <div className="text-white small fw-medium">Project Email</div>
                                <div className="text-muted small">callsphere.team@gmail.com</div>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-3 mb-4">
                            <div className="p-2 rounded-circle bg-success bg-opacity-25 text-success">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <div className="text-white small fw-medium">Location</div>
                                <div className="text-muted small">Techno India University, Kolkata</div>
                            </div>
                        </div>

                        <div className="p-3 rounded-3 bg-secondary bg-opacity-10 border border-secondary border-opacity-25">
                            <div className="text-success small fw-semibold mb-1">● System Status: Operational</div>
                            <p className="text-muted small mb-0">WebRTC Signaling Server online and ready for peer handshakes.</p>
                        </div>
                    </div>
                </div>

                <div className="col-md-7">
                    <div className="p-4 rounded-4" style={{ background: 'rgba(20,22,27,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h4 className="text-white mb-3">Send Transmission</h4>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label small text-muted">Full Name</label>
                                <input
                                    type="text"
                                    className="form-control bg-dark text-white border-secondary"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label small text-muted">Email Address</label>
                                <input
                                    type="email"
                                    className="form-control bg-dark text-white border-secondary"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label small text-muted">Message Payload</label>
                                <textarea
                                    className="form-control bg-dark text-white border-secondary"
                                    rows="4"
                                    placeholder="Your message, inquiry, or bug report..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary w-100 py-2 rounded-3 fw-semibold">
                                <Send size={16} className="me-2" /> Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
