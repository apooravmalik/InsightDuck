import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';
import ConvertTypesModal from '../ConvertTypesModal';

const ConvertTypesStep = ({ onComplete }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProjectId, currentSession } = useProjects();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmConversions = async (selectedConversions) => {
    setIsModalOpen(false);
    if (selectedConversions.length === 0) {
      onComplete(null, [{ type: 'info', content: 'Skipped data type conversion.' }]);
      return;
    }
    
    setIsProcessing(true);
    setError('');

    try {
        const response = await makeAuthenticatedRequest(`${API_URL}/convert-types/`, {
            method: 'POST',
            body: JSON.stringify({
                project_id: activeProjectId,
                conversions: selectedConversions,
            }),
        });
        const data = await response.json();
        if(!response.ok) {
            throw new Error(data.detail || "Failed to apply conversions.");
        }
        
        const newMessages = [{ type: 'info', content: data.message || "Data types converted successfully." }];
        onComplete(data.new_profile_summary, newMessages);

    } catch (err) {
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const hasSuggestions = currentSession?.typeSuggestions && currentSession.typeSuggestions.length > 0;

  return (
    <>
      <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
        <button
          onClick={() => hasSuggestions ? setIsModalOpen(true) : onComplete(null, [{ type: 'info', content: 'No type conversions to review.' }])}
          disabled={isProcessing}
          className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
        >
          {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
          {hasSuggestions ? 'Review & Convert Data Types' : 'Continue to Next Step'}
        </button>
        {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
      </div>
      
      {hasSuggestions && (
        <ConvertTypesModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmConversions}
          initialSuggestions={currentSession.typeSuggestions}
        />
      )}
    </>
  );
};

export default ConvertTypesStep;