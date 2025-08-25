/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const email = localStorage.getItem('user_email');
    
    if (token && email) {
      setSession({ access_token: token });
      setUser({ email });
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = (email, accessToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user_email', email);
    
    setSession({ access_token: accessToken });
    setUser({ email });
    setIsAuthenticated(true);
  };

  // Wrap logout in useCallback to stabilize its reference
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  }, []);

  // Wrap makeAuthenticatedRequest in useCallback
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    const token = session?.access_token || localStorage.getItem('access_token');
    
    if (!token) {
      logout();
      throw new Error('No access token available');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      logout();
    }

    return response;
  }, [session, logout]); // Add session and logout as dependencies

  const value = {
    user,
    session,
    isAuthenticated,
    loading,
    login,
    logout,
    makeAuthenticatedRequest
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1E1C1C]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F5D742] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
