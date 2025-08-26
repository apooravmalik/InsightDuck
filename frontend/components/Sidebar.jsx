import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { PlusCircle, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { API_URL } from '../config/config';

const Sidebar = ({ onUploadClick, onSelectProject, onSessionExpired }) => {
  const { makeAuthenticatedRequest } = useAuth();
  // Use allProjects from the context for the list
  const { allProjects, setAllProjects } = useProjects();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await makeAuthenticatedRequest(`${API_URL}/projects/`);
      
      if (response.status === 401) {
        onSessionExpired();
        return; 
      }

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setAllProjects(data);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching projects.');
    } finally {
      setLoading(false);
    }
  }, [makeAuthenticatedRequest, setAllProjects, onSessionExpired]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <aside className="w-64 bg-[#2A2828] border-r border-[#3F3F3F] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#E8E8E8]">Projects</h2>
        <button 
          onClick={onUploadClick}
          className="p-1 text-[#A1A1A1] hover:text-[#F5D742] transition-colors"
        >
          <PlusCircle className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center text-[#A1A1A1]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center text-center text-red-400">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <ul className="space-y-2">
            {allProjects.length > 0 ? (
              allProjects.map((project) => (
                <li key={project.id}>
                  <button 
                    onClick={() => onSelectProject(project.id)}
                    className="w-full text-left p-2 rounded-md hover:bg-[#3F3F3F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F5D742]"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 mt-0.5 text-[#A1A1A1]" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-[#E8E8E8] truncate">{project.project_name}</p>
                        <p className="text-xs text-[#A1A1A1]">{formatDate(project.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            ) : (
              <div className="text-center text-sm text-[#A1A1A1] py-4">
                No projects found.
              </div>
            )}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
