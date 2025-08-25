import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import DataTable from '../components/DataTable';
import Accordion from '../components/Accordion';
import { API_URL } from '../config/config.js';

const DataCleaningView = ({ isLoading: isProjectLoading }) => {
  const { activeProject, updateActiveProjectProfile } = useProjects();
  const { makeAuthenticatedRequest } = useAuth();
  
  // State for the chat-like interface
  const [agentMessages, setAgentMessages] = useState([]);
  const [actionStep, setActionStep] = useState('initial');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset the view when the active project changes
  useEffect(() => {
    setAgentMessages([]);
    setActionStep('initial');
  }, [activeProject]);

  const handleAutoClean = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/auto-clean/`, {
        method: 'POST',
        body: JSON.stringify({ project_id: activeProject.project_id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Auto-cleaning failed');
      }
      
      setAgentMessages(prev => [...prev, { type: 'log', content: data.operations_log }]);
      updateActiveProjectProfile(data.new_profile_summary);
      setActionStep('find_duplicates');

    } catch (error) {
      console.error("Auto-clean error:", error);
      setAgentMessages(prev => [...prev, { type: 'error', content: error.message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isProjectLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-[#F5D742]" /></div>;
  }

  if (!activeProject) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#F5D742]">Welcome to InsightDuck</h1>
        <p className="mt-2 text-[#A1A1A1]">Select a project from the sidebar to get started, or upload a new one.</p>
      </div>
    );
  }

  const profile = activeProject.profile;
  const schemaColumns = [{ Header: 'Column Name', accessor: 'column_name' }, { Header: 'Data Type', accessor: 'column_type' }];
  const sampleDataColumns = profile.schema.map(col => ({ Header: col.column_name, accessor: col.column_name }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Left Panel: Agent Chat & Actions */}
      <div className="bg-[#2A2828] rounded-lg p-6 border border-[#3F3F3F] flex flex-col">
        <h2 className="text-xl font-bold text-[#F5D742] mb-4">Agent Workspace</h2>
        <div className="flex-grow space-y-4 overflow-y-auto pr-2">
          {/* Initial Message */}
          <div className="p-4 bg-[#1E1C1C] rounded-lg">
            <p className="text-sm text-[#E8E8E8]">
              I've loaded your dataset, <span className="font-semibold text-[#F5D742]">{profile.project_name || `Project ID ${activeProject.project_id}`}</span>. 
              It has <span className="font-semibold">{profile.total_rows}</span> rows and <span className="font-semibold">{profile.total_columns}</span> columns. 
              I found <span className="font-semibold">{profile.duplicates_count}</span> duplicate rows.
            </p>
          </div>

          {/* Dynamic Messages from Agent */}
          {agentMessages.map((msg, index) => (
            <div key={index} className="p-4 bg-[#1E1C1C] rounded-lg">
              {msg.type === 'log' && (
                <div>
                  <h4 className="font-semibold text-[#A1A1A1] mb-2">Cleaning Log:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-[#E8E8E8]">
                    {msg.content.map((log, i) => <li key={i}>{log}</li>)}
                  </ul>
                </div>
              )}
               {msg.type === 'error' && <p className="text-sm text-red-400">{msg.content}</p>}
            </div>
          ))}
        </div>
        
        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
          {actionStep === 'initial' && (
            <button 
              onClick={handleAutoClean}
              disabled={isProcessing}
              className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
            >
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
              Begin Automated Cleaning
            </button>
          )}
          {actionStep === 'find_duplicates' && (
             <button className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B]">
              Next: Find Duplicates
            </button>
          )}
        </div>
      </div>

      {/* Right Panel: Data Display */}
      <div className="overflow-y-auto">
        <Accordion title="Schema" defaultOpen={true}>
          <DataTable columns={schemaColumns} data={profile.schema} />
        </Accordion>
        <Accordion title="Sample Data Preview" defaultOpen={true}>
          <DataTable columns={sampleDataColumns} data={profile.sample_preview} />
        </Accordion>
      </div>
    </div>
  );
};

export default DataCleaningView;
