import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';

const SuggestDataTypesStep = ({ onComplete }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProjectId } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSuggestDataTypes = async () => {
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

      // Format the message to include suggestions
      let message;
      if (data.suggestions && data.suggestions.length > 0) {
        const suggestionLines = data.suggestions.map(
          (s) => `- For column "${s.column_name}", I suggest changing the type from ${s.current_type} to ${s.suggested_type} (confidence: ${s.confidence * 100}%)`
        );
        message = `I've analyzed the data types and have the following suggestions:\n${suggestionLines.join('\n')}`;
      } else {
        message = "I didn't find any columns that I could confidently suggest a type conversion for.";
      }

      const newMessages = [{ type: 'info', content: message }];

      // Pass the suggestions themselves to the parent for the next step
      onComplete(newMessages, data.suggestions);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
      <button
        onClick={handleSuggestDataTypes}
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

export default SuggestDataTypesStep;