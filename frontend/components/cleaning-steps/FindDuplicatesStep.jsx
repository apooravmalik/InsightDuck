import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';

const FindDuplicatesStep = ({ onComplete }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProjectId } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFindDuplicates = async () => {
    if (!activeProjectId) return;

    setIsProcessing(true);
    setError('');
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/find-duplicates/`, {
        method: 'POST',
        body: JSON.stringify({ project_id: activeProjectId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to find duplicates');
      }

      console.log("Duplicates Found:", data);
      
      const message = `I found ${data.exact_duplicates.count} exact duplicate rows.`;
      const newMessages = [{ type: 'info', content: message }];
      
      onComplete(newMessages);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
      <button 
        onClick={handleFindDuplicates}
        disabled={isProcessing}
        className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
      >
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
        Find Duplicates
      </button>
      {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default FindDuplicatesStep;
