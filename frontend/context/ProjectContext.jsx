/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';

const ProjectContext = createContext();

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  const addProject = (newProject) => {
    setProjects(prevProjects => [newProject, ...prevProjects]);
  };

  const value = {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    addProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
