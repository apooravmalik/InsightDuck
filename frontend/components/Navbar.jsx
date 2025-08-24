import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import { useProjects } from '../context/ProjectContext'; // Import the project context

// A new component for the Data Cleaning view
const DataCleaningView = () => {
  const { activeProject } = useProjects();

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

  // This is where the main chat UI and data tables will go.
  // For now, we'll just display the raw profile data.
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#F5D742]">
        Project: {activeProject.profile?.project_name || activeProject.project_id}
      </h1>
      <pre className="mt-4 p-4 bg-[#2A2828] rounded-lg text-sm overflow-x-auto">
        {JSON.stringify(activeProject.profile, null, 2)}
      </pre>
    </div>
  );
};

// A new component for the EDA view
const EdaView = () => {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-[#F5D742]">Exploratory Data Analysis</h1>
      <p className="mt-2 text-[#A1A1A1]">
        This feature is coming soon!
      </p>
    </div>
  );
};


const Dashboard = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Data Cleaning'); // State is now here

  return (
    <>
      <div className="h-screen bg-[#1E1C1C] text-[#E8E8E8] flex flex-col">
        {/* Pass state and setter to Navbar */}
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex flex-grow overflow-hidden">
          <Sidebar onUploadClick={() => setIsUploadModalOpen(true)} />
          <main className="flex-grow p-8 overflow-y-auto">
            {/* Conditionally render the view based on the active tab */}
            {activeTab === 'Data Cleaning' && <DataCleaningView />}
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
