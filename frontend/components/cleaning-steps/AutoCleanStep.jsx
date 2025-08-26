import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';

const AutoCleanStep = ({ onComplete, setAgentMessages }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProject, updateActiveProjectProfile } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);

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
      
      // Preserve the project_name from the original profile
      const updatedProfile = {
        ...data.new_profile_summary,
        project_name: activeProject.profile.project_name 
      };

      updateActiveProjectProfile(updatedProfile);
      
      setAgentMessages(prev => [...prev, { type: 'log', content: data.operations_log }]);
      
      onComplete();

    } catch (error) {
      console.error("Auto-clean error:", error);
      setAgentMessages(prev => [...prev, { type: 'error', content: error.message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
      <button 
        onClick={handleAutoClean}
        disabled={isProcessing}
        className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
      >
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
        Begin Automated Cleaning
      </button>
    </div>
  );
};

export default AutoCleanStep;
