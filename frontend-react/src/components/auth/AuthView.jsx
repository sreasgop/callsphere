import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import Swal from 'sweetalert2';

export const AuthView = ({ onBack }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const { login, register } = useAuth();
    const { playClickSound } = useSound();

    const handleSubmit = async (e) => {
        e.preventDefault();
        playClickSound();

        if (isRegister) {
            if (!fullName || !email || !password) {
                Swal.fire('Warning', 'Please fill in all fields', 'warning');
                return;
            }
            const res = await register(fullName, email, password);
            if (res.error || res.detail) {
                Swal.fire('Registration Failed', res.error || res.detail, 'error');
            } else {
                Swal.fire('Success', 'Account created! Please log in.', 'success');
                setIsRegister(false);
            }
        } else {
            if (!email || !password) {
                Swal.fire('Warning', 'Please enter email and password', 'warning');
                return;
            }
            const res = await login(email, password);
            if (res.error || res.detail || !res.user) {
                Swal.fire('Login Failed', res.error || res.detail || 'Invalid email or password', 'error');
            }
        }
    };

    return (
        <div className="view-section">
            <div className="auth-container">
                {onBack && (
                    <button
                        type="button"
                        className="btn btn-link text-muted small p-0 mb-3 text-decoration-none d-flex align-items-center gap-1"
                        onClick={onBack}
                    >
                        ← Back to Overview
                    </button>
                )}
                <h1 className="brand-title text-white">CallSphere</h1>
                <p className="brand-subtitle">{isRegister ? 'Create your WebRTC account' : 'Next-Gen Instant WebRTC Portal'}</p>

                <form onSubmit={handleSubmit}>
                    {isRegister && (
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Full Name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    )}
                    <input
                        type="email"
                        className="form-input"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        className="form-input"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <button type="submit" className="btn-primary mt-2">
                        {isRegister ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <span
                    className="auth-link"
                    onClick={() => {
                        playClickSound();
                        setIsRegister(!isRegister);
                    }}
                >
                    {isRegister ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </span>
            </div>
        </div>
    );
};
