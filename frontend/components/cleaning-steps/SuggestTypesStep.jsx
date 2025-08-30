import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';

const SuggestTypesStep = ({ onComplete }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProjectId } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSuggestTypes = async () => {
    if (!activeProjectId) return;

    setIsProcessing(true);
    setError('');
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/suggest-conversions/`, {
        method: 'POST',
        body: JSON.stringify({ project_id: activeProjectId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to suggest data types');
      }
      
      let newMessages = [];
      if (data.suggestions && data.suggestions.length > 0) {
        // Create a message with type 'suggestions' as expected by DataCleaningView
        newMessages.push({
          type: 'suggestions',
          title: "I've analyzed the data types and have the following suggestions:",
          content: data.suggestions, // The content is the array of suggestion objects
        });
        console.log("Type suggestions:", data.suggestions);
      } else {
        newMessages.push({
          type: 'info',
          content: "I didn't find any columns that I could confidently suggest a type conversion for.",
        });
        console.log("No type suggestions available.");
      }

      // Call onComplete with the correct argument order: (suggestions, newMessages)
      onComplete(data.suggestions, newMessages);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
      <button
        onClick={handleSuggestTypes}
        disabled={isProcessing}
        className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
      >
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
        Suggest Data Types
      </button>
      {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default SuggestTypesStep;