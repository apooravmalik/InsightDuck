import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';
import ImputeNullsModal from '../ImputeNullsModal';

const ImputeNullsStep = ({ onComplete }) => {
    const { makeAuthenticatedRequest } = useAuth();
    const { activeProjectId, currentSession } = useProjects();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleConfirmImputations = async (selectedImputations) => {
        setIsModalOpen(false);
        if (selectedImputations.length === 0) {
            onComplete(null, [{ type: 'info', content: 'Skipped imputing null values.' }]);
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const response = await makeAuthenticatedRequest(`${API_URL}/impute-nulls/`, {
                method: 'POST',
                body: JSON.stringify({
                    project_id: activeProjectId,
                    imputations: selectedImputations,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Failed to impute values.");
            }
            
            const newMessages = [{ type: 'log', content: data.operations_log }];
            onComplete(data.new_profile_summary, newMessages);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const hasNulls = currentSession?.profile?.null_counts && Object.keys(currentSession.profile.null_counts).length > 0;

    return (
        <>
            <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
                <button
                    onClick={() => hasNulls ? setIsModalOpen(true) : onComplete(null, [{ type: 'info', content: 'No null values to impute.' }])}
                    disabled={isProcessing}
                    className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center transition-colors"
                >
                    {isProcessing && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                    {hasNulls ? 'Impute Null Values' : 'Continue to Next Step'}
                </button>
                {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
            </div>

            {hasNulls && (
                <ImputeNullsModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onConfirm={handleConfirmImputations}
                    profile={currentSession.profile}
                />
            )}
        </>
    );
};

export default ImputeNullsStep;