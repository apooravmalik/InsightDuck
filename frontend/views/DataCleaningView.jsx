import React from 'react';
import { useProjects } from '../context/ProjectContext';
import { Loader2, ArrowRight } from 'lucide-react';
import DataTable from '../components/DataTable';
import Accordion from '../components/Accordion';
import AutoCleanStep from '../components/cleaning-steps/AutoCleanStep';
import FindDuplicatesStep from '../components/cleaning-steps/FindDuplicatesStep';
import HandleDuplicatesStep from '../components/cleaning-steps/HandleDuplicatesStep';
import SuggestTypesStep from '../components/cleaning-steps/SuggestTypesStep';

const DataCleaningView = ({ isLoading: isProjectLoading }) => {
  const { currentSession, updateCurrentSession } = useProjects();

  if (isProjectLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-[#F5D742]" /></div>;
  }

  if (!currentSession) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#F5D742]">Welcome to InsightDuck</h1>
        <p className="mt-2 text-[#A1A1A1]">Select a project from the sidebar to get started, or upload a new one.</p>
      </div>
    );
  }

  const { profile, agentMessages, actionStep } = currentSession;
  const schemaColumns = [{ Header: 'Column Name', accessor: 'column_name' }, { Header: 'Data Type', accessor: 'column_type' }];
  const sampleDataColumns = profile.schema.map(col => ({ Header: col.column_name, accessor: col.column_name }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <div className="bg-[#2A2828] rounded-lg p-6 border border-[#3F3F3F] flex flex-col">
        <h2 className="text-xl font-bold text-[#F5D742] mb-4">Agent Workspace</h2>
        <div className="flex-grow space-y-4 overflow-y-auto pr-2">
          <div className="p-4 bg-[#1E1C1C] rounded-lg">
            <p className="text-sm text-[#E8E8E8]">
              I've loaded your dataset, <span className="font-semibold text-[#F5D742]">{profile.project_name || `Project ID ${currentSession.profile.project_id}`}</span>. 
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
              {msg.type === 'info' && <p className="text-sm text-[#E8E8E8]">{msg.content}</p>}
              {msg.type === 'suggestions' && (
                <div>
                  <h4 className="font-semibold text-[#A1A1A1] mb-2">{msg.title}</h4>
                  <ul className="text-sm space-y-2 text-[#E8E8E8]">
                    {msg.content.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="font-mono bg-[#1E1C1C] px-2 py-1 rounded">{s.column_name}</span>
                        <span className="text-[#A1A1A1]">{s.current_type}</span>
                        <ArrowRight className="h-4 w-4 text-[#F5D742]" />
                        <span className="font-semibold text-[#F5D742]">{s.suggested_type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {msg.type === 'error' && <p className="text-sm text-red-400">{msg.content}</p>}
            </div>
          ))}
        </div>
        
        {actionStep === 'initial' && (
          <AutoCleanStep 
            onComplete={(newProfile, newMessages) => {
              updateCurrentSession({
                profile: newProfile,
                agentMessages: [...agentMessages, ...newMessages],
                actionStep: 'find_duplicates',
              });
            }}
          />
        )}

        {actionStep === 'find_duplicates' && (
          <FindDuplicatesStep
            onComplete={(newMessages) => {
               updateCurrentSession({
                agentMessages: [...agentMessages, ...newMessages],
                actionStep: 'handle_duplicates',
              });
            }}
          />
        )}

        {actionStep === 'handle_duplicates' && (
           <HandleDuplicatesStep
             onComplete={(newProfile, newMessages) => {
                updateCurrentSession({
                  profile: newProfile || profile, 
                  agentMessages: [...agentMessages, ...newMessages],
                  actionStep: 'suggest_types',
                });
             }}
           />
        )}

        {actionStep === 'suggest_types' && (
          <SuggestTypesStep
            onComplete={(suggestions, newMessages) => {
              updateCurrentSession({
                typeSuggestions: suggestions,
                agentMessages: [...agentMessages, ...newMessages],
                actionStep: 'convert_types',
              });
            }}
          />
        )}

        {actionStep === 'convert_types' && (
           <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
             <button className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B]">
               Next: Convert Data Types
             </button>
           </div>
        )}
      </div>

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
