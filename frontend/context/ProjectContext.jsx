/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext();

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

// Helper function to get the user-specific storage key
const getStorageKey = (userId) => `insightduck_sessions_${userId}`;

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth();
  const [projectSessions, setProjectSessions] = useState({});
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [allProjects, setAllProjects] = useState([]); // For the sidebar list

  // Load sessions from localStorage when the user is identified
  useEffect(() => {
    if (user?.id) {
      const storedSessions = localStorage.getItem(getStorageKey(user.id));
      if (storedSessions) {
        setProjectSessions(JSON.parse(storedSessions));
      }
    }
  }, [user]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(getStorageKey(user.id), JSON.stringify(projectSessions));
    }
  }, [projectSessions, user]);

  // Function to set the active project and initialize its session if it doesn't exist
  const setActiveProject = useCallback((projectData) => {
    if (!projectData) {
      setActiveProjectId(null);
      return;
    }
    
    const { project_id, profile } = projectData;
    setActiveProjectId(project_id);

    setProjectSessions(prev => {
      // If a session for this project doesn't exist, create one
      if (!prev[project_id]) {
        return {
          ...prev,
          [project_id]: {
            profile,
            agentMessages: [],
            actionStep: 'initial',
          }
        };
      }
      // If it exists, just update the profile data
      return {
        ...prev,
        [project_id]: {
          ...prev[project_id],
          profile,
        }
      };
    });
  }, []);

  // Function for step components to update the current session
  const updateCurrentSession = useCallback((updates) => {
    if (!activeProjectId) return;

    setProjectSessions(prev => ({
      ...prev,
      [activeProjectId]: {
        ...prev[activeProjectId],
        ...updates,
      }
    }));
  }, [activeProjectId]);

  const value = {
    allProjects,
    setAllProjects,
    activeProjectId,
    setActiveProject,
    // Provide the current session's data directly
    currentSession: activeProjectId ? projectSessions[activeProjectId] : null,
    updateCurrentSession,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
