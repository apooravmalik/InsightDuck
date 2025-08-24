/* eslint-disable react-refresh/only-export-components */
// AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Check for existing authentication on app load
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

  // Login function
  const login = (email, accessToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user_email', email);
    
    setSession({ access_token: accessToken });
    setUser({ email });
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  };

  // Utility function for authenticated API calls
  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = session?.access_token || localStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('No access token available');
    }

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  const value = {
    user,
    session,
    isAuthenticated,
    loading,
    login,
    logout,
    makeAuthenticatedRequest
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};