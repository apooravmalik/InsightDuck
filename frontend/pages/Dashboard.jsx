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
import { AlertTriangle } from 'lucide-react'; // Import the icon

const Dashboard = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Data Cleaning');
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState(''); // State to hold project loading errors
  const { setActiveProject, clearActiveProject } = useProjects(); // Get clearActiveProject
  const { makeAuthenticatedRequest } = useAuth();

  const handleSelectProject = useCallback(async (projectId) => {
    setIsProjectLoading(true);
    setProjectError(''); // Clear previous errors
    clearActiveProject(); // Clear the current session view
    
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/get-project-status/`, {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      });
      if (response.status === 401) {
        setIsSessionModalOpen(true);
        return;
      }
      if (response.status === 404) {
        // This is the new logic to handle cleared projects
        setProjectError("Sorry, you were too late! This project's data has been cleared from the server to save space. Please upload a new one.");
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load project details.');
      }
      const data = await response.json();
      setActiveProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
      setProjectError('An unexpected error occurred while loading the project.');
    } finally {
      setIsProjectLoading(false);
    }
  }, [makeAuthenticatedRequest, setActiveProject, clearActiveProject]);

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
            {projectError ? (
                <div className="text-center text-yellow-400 flex flex-col items-center justify-center h-full">
                    <AlertTriangle className="h-12 w-12 mb-4" />
                    <p className="text-lg">{projectError}</p>
                </div>
            ) : (
                <>
                    {activeTab === 'Data Cleaning' && <DataCleaningView isLoading={isProjectLoading} />}
                    {activeTab === 'EDA' && <EdaView />}
                </>
            )}
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