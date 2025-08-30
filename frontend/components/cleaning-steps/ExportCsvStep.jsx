import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Loader2, Download } from 'lucide-react';
import { API_URL } from '../../config/config';
import ExportCsvModal from '../ExportCsvModal';

const ExportCsvStep = () => {
    const { makeAuthenticatedRequest } = useAuth();
    const { activeProjectId, currentSession } = useProjects();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');

    const handleDownload = async () => {
        if (!activeProjectId) return;

        setIsDownloading(true);
        setError('');
        try {
            const response = await makeAuthenticatedRequest(`${API_URL}/export-csv/`, {
                method: 'POST',
                body: JSON.stringify({ project_id: activeProjectId }),
            });

            if (!response.ok) {
                throw new Error('Failed to export CSV. Please try again.');
            }
            
            // Get the filename from the Content-Disposition header
            const disposition = response.headers.get('content-disposition');
            let filename = `cleaned_project_${activeProjectId}.csv`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                  filename = matches[1].replace(/['"]/g, '');
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            // Close the modal after a successful download
            setIsModalOpen(false);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 flex items-center justify-center transition-colors"
                >
                    <Download className="h-5 w-5 mr-2" />
                    Export Cleaned CSV
                </button>
                 {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
            </div>

            <ExportCsvModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onDownload={handleDownload}
                isDownloading={isDownloading}
            />
        </>
    );
};

export default ExportCsvStep;