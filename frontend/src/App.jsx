import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProjectProvider } from '../context/ProjectContext'; // 1. Import ProjectProvider
import AuthPage from '../pages/AuthPage';
import Dashboard from '../pages/Dashboard';

// Protected Route Component (No changes needed)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

// Public Route Component (No changes needed)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// AppRoutes Component (No changes needed)
const AppRoutes = () => {
  return (
    <Routes>
      <Route 
        path="/auth" 
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route path="/" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      {/* 2. Wrap the Router with ProjectProvider */}
      <ProjectProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ProjectProvider>
    </AuthProvider>
  );
};

export default App;
