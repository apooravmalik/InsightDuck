import React, { useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import SessionExpiredModal from '../components/SessionExpiredModal';
import DataCleaningView from '../views/DataCleaningView';
import EdaView from '../views/EdaView';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/config';

const Dashboard = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Data Cleaning');
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const { setActiveProject } = useProjects();
  const { makeAuthenticatedRequest } = useAuth();

  const handleSelectProject = useCallback(async (projectId) => {
    setIsProjectLoading(true);
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/get-project-status/`, {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      });
      if (response.status === 401) {
        setIsSessionModalOpen(true);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load project details.');
      }
      const data = await response.json();
      // setActiveProject now initializes or updates the session
      setActiveProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setIsProjectLoading(false);
    }
  }, [makeAuthenticatedRequest, setActiveProject]);

  const handleSessionExpired = useCallback(() => {
    setIsSessionModalOpen(true);
  }, []);

  return (
    <>
      <div className="h-screen bg-[#1E1C1C] text-[#E8E8E8] flex flex-col">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex flex-grow overflow-hidden">
          <Sidebar 
            onUploadClick={() => setIsUploadModalOpen(true)} 
            onSelectProject={handleSelectProject}
            onSessionExpired={handleSessionExpired}
          />
          <main className="flex-grow p-8 overflow-y-auto">
            {activeTab === 'Data Cleaning' && <DataCleaningView isLoading={isProjectLoading} />}
            {activeTab === 'EDA' && <EdaView />}
          </main>
        </div>
      </div>
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
      <SessionExpiredModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
      />
    </>
  );
};

export default Dashboard;
