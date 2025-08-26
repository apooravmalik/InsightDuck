import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';
import ConfirmationModal from '../ConfirmationModal';

const HandleDuplicatesStep = ({ onComplete }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { activeProjectId } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConfirm = async () => {
    setIsModalOpen(false);
    if (!activeProjectId) return;

    setIsProcessing(true);
    setError('');
    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/handle-duplicates/`, {
        method: 'POST',
        body: JSON.stringify({ 
          project_id: activeProjectId,
          strategy: "remove_exact_duplicates" // Using the correct strategy name
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to handle duplicates');
      }
      
      const newMessages = [{ type: 'info', content: data.message }];
      onComplete(data.new_profile_summary, newMessages);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    // If user cancels, we still move to the next step without making changes.
    onComplete(null, [{ type: 'info', content: 'Skipped removing duplicates.' }]);
  };

  return (
    <>
      <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={isProcessing}
          className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
        >
          {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
          Handle Duplicates
        </button>
        {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Confirm Duplicate Removal"
      >
        <p>Right now, we are just removing exact duplicates. The ability to review potential entity duplicates will be added in a later update.</p>
        <p className="font-semibold mt-2">Do you want to proceed?</p>
      </ConfirmationModal>
    </>
  );
};

export default HandleDuplicatesStep;
