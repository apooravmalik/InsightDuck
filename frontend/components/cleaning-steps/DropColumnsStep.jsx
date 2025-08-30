import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/config';
import DropColumnsModal from '../DropColumnsModal';

const DropColumnsStep = ({ onComplete }) => {
    const { makeAuthenticatedRequest } = useAuth();
    const { activeProjectId, currentSession } = useProjects();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleConfirmDrop = async (columnsToDrop) => {
        setIsModalOpen(false);
        if (!columnsToDrop || columnsToDrop.length === 0) {
            onComplete(null, [{ type: 'info', content: 'Skipped dropping columns.' }]);
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const response = await makeAuthenticatedRequest(`${API_URL}/drop-columns/`, {
                method: 'POST',
                body: JSON.stringify({
                    project_id: activeProjectId,
                    columns_to_drop: columnsToDrop,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Failed to drop columns.');
            }

            const newMessages = [{ type: 'info', content: data.message }];
            onComplete(data.new_profile_summary, newMessages);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
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
                    Drop Columns
                </button>
                {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
            </div>

            <DropColumnsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmDrop}
                schema={currentSession.profile.schema}
            />
        </>
    );
};

export default DropColumnsStep;