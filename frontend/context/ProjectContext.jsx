/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext();

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

const getStorageKey = (userId) => `insightduck_sessions_${userId}`;

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth();
  const [projectSessions, setProjectSessions] = useState({});
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [allProjects, setAllProjects] = useState([]);

  useEffect(() => {
    if (user && user.id) {
      try {
        const storedSessions = localStorage.getItem(getStorageKey(user.id));
        if (storedSessions) {
          setProjectSessions(JSON.parse(storedSessions));
        }
      } catch (error) {
        console.error("Failed to parse project sessions from localStorage", error);
        setProjectSessions({});
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id && Object.keys(projectSessions).length > 0) {
      localStorage.setItem(getStorageKey(user.id), JSON.stringify(projectSessions));
    }
  }, [projectSessions, user]);

  const setActiveProject = useCallback((projectData) => {
    if (!projectData) {
      setActiveProjectId(null);
      return;
    }
    
    const { project_id, profile } = projectData;
    setActiveProjectId(project_id);

    setProjectSessions(prev => {
      const existingSession = prev[project_id] || {};
      // This is the fix: We merge the new profile with the existing session,
      // but we ONLY initialize the step/messages if the session truly doesn't exist yet.
      // When re-selecting a project, this will preserve the saved state.
      return {
        ...prev,
        [project_id]: {
          profile,
          agentMessages: existingSession.agentMessages || [],
          actionStep: existingSession.actionStep || 'initial',
        }
      };
    });
  }, []);

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

  const value = useMemo(() => ({
    allProjects,
    setAllProjects,
    activeProjectId,
    setActiveProject,
    currentSession: activeProjectId ? projectSessions[activeProjectId] : null,
    updateCurrentSession,
  }), [allProjects, activeProjectId, projectSessions, setActiveProject, updateCurrentSession]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
