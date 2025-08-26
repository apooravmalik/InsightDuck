/* eslint-disable no-unused-vars */
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

  // This effect only runs once on app load to check for a persisted session
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setSession({ access_token: token });
        setUser(parsedUser); // Set the full user object
        setIsAuthenticated(true);
      } catch (e) {
        // If parsing fails, clear out the bad data
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  // The login function now correctly handles the full user object
  const login = (sessionData) => {
    const { access_token, user } = sessionData;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(user)); // Store the full user object as a string
    
    setSession({ access_token });
    setUser(user); // Set the full user object in state
    setIsAuthenticated(true);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  }, []);

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
  }, [session, logout]);

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
