import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const DataCleaningView = ({ isLoading }) => {
  const { activeProject } = useProjects();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5D742]" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#F5D742]">Welcome to InsightDuck</h1>
        <p className="mt-2 text-[#A1A1A1]">
          Select a project from the sidebar to get started, or upload a new one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#F5D742] truncate">
        Project: {activeProject.profile?.project_name || `Project ID ${activeProject.project_id}`}
      </h1>
      <pre className="mt-4 p-4 bg-[#2A2828] rounded-lg text-sm overflow-x-auto border border-[#3F3F3F]">
        {JSON.stringify(activeProject.profile, null, 2)}
      </pre>
    </div>
  );
};

const EdaView = () => {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-[#F5D742]">Exploratory Data Analysis</h1>
      <p className="mt-2 text-[#A1A1A1]">This feature is coming soon!</p>
    </div>
  );
};

const Dashboard = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Data Cleaning');
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const { setActiveProject } = useProjects();
  const { makeAuthenticatedRequest } = useAuth();

  const handleSelectProject = async (projectId) => {
    setIsProjectLoading(true);
    setActiveProject(null);
    try {
      const response = await makeAuthenticatedRequest('http://127.0.0.1:8000/get-project-status/', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!response.ok) {
        throw new Error('Failed to load project details.');
      }
      const data = await response.json();
      setActiveProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setIsProjectLoading(false);
    }
  };

  return (
    <>
      <div className="h-screen bg-[#1E1C1C] text-[#E8E8E8] flex flex-col">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex flex-grow overflow-hidden">
          <Sidebar 
            onUploadClick={() => setIsUploadModalOpen(true)} 
            onSelectProject={handleSelectProject}
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
    </>
  );
};

export default Dashboard;
