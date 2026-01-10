import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

import { API_URL } from '../config';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing token or guest user on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const isGuest = localStorage.getItem('isGuest');
    
    if (isGuest === 'true') {
      // Restore guest user
      const guestUser = {
        name: 'Guest User',
        email: 'guest@krishimitra.com',
        isGuest: true,
        isProfileComplete: true
      };
      setUser(guestUser);
      setLoading(false);
    } else if (token) {
      fetchCurrentUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (err) {
      console.error('Auto-login failed:', err);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/signup`, {
        name, email, password
      });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      return { success: true, user };
    } catch (err) {
      const message = err.response?.data?.message || 'Signup failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/login`, {
        email, password
      });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      return { success: true, user };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const loginAsGuest = () => {
    const guestUser = {
      name: 'Guest User',
      email: 'guest@krishimitra.com',
      isGuest: true,
      isProfileComplete: true
    };
    localStorage.setItem('isGuest', 'true');
    localStorage.removeItem('token'); // Clear any existing token
    setUser(guestUser);
    return { success: true, user: guestUser };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isGuest');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const getToken = () => localStorage.getItem('token');

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      isAuthenticated: !!user,
      isProfileComplete: user?.isProfileComplete || false,
      signup,
      login,
      loginAsGuest,
      logout,
      updateUser,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
