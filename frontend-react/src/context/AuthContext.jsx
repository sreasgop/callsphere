import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('voip_user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [token, setToken] = useState(() => localStorage.getItem('voip_token') || null);

    const login = async (email, password) => {
        const res = await api.login(email, password);
        if (res.user) {
            setUser(res.user);
            if (res.token) setToken(res.token);
        }
        return res;
    };

    const register = async (fullName, email, password) => {
        return await api.register(fullName, email, password);
    };

    const logout = () => {
        localStorage.removeItem('voip_user');
        localStorage.removeItem('voip_token');
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
