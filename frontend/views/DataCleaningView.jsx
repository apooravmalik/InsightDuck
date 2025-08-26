import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import DataTable from '../components/DataTable';
import Accordion from '../components/Accordion';
import AutoCleanStep from '../components/cleaning-steps/AutoCleanStep';

const DataCleaningView = ({ isLoading: isProjectLoading }) => {
  const { activeProject } = useProjects();
  
  const [agentMessages, setAgentMessages] = useState([]);
  const [actionStep, setActionStep] = useState('initial');

  // Reset the view when the active project changes
  useEffect(() => {
    setAgentMessages([]);
    setActionStep('initial');
  }, [activeProject]);

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
          <div className="p-4 bg-[#1E1C1C] rounded-lg">
            <p className="text-sm text-[#E8E8E8]">
              I've loaded your dataset, <span className="font-semibold text-[#F5D742]">{profile.project_name || `Project ID ${activeProject.project_id}`}</span>. 
              It has <span className="font-semibold">{profile.total_rows}</span> rows and <span className="font-semibold">{profile.total_columns}</span> columns. 
              I found <span className="font-semibold">{profile.duplicates_count}</span> duplicate rows.
            </p>
          </div>

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
        
        {/* Render the current step's component */}
        {actionStep === 'initial' && (
          <AutoCleanStep 
            setAgentMessages={setAgentMessages}
            onComplete={() => {
              const nextStep = 'find_duplicates';
              console.log(`auto clean done, changed the step to ${nextStep}`);
              setActionStep(nextStep);
            }}
          />
        )}

        {actionStep === 'find_duplicates' && (
          <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
            <button className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B]">
              Next: Find Duplicates
            </button>
          </div>
        )}
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
