/* eslint-disable no-unused-vars */
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { UploadCloud, Loader2, AlertTriangle, FileText } from 'lucide-react';

const UploadModal = ({ isOpen, onClose }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { setActiveProject, addProject } = useProjects();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.type === 'text/csv') {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Invalid file type. Please upload a .csv file.');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/upload-and-profile/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }
      
      // On success, update the global state
      setActiveProject(data);
      // Add the new project to the list in the sidebar
      addProject({
        id: data.project_id,
        project_name: file.name,
        created_at: new Date().toISOString(),
      });
      
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload New Project">
      <div className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-[#F5D742] bg-[#3F3F3F]' : 'border-[#3F3F3F] hover:border-[#A1A1A1]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-[#A1A1A1]">
            <UploadCloud className="h-12 w-12 mb-2" />
            {isDragActive ? (
              <p>Drop the file here ...</p>
            ) : (
              <p>Drag & drop a .csv file here, or click to select</p>
            )}
          </div>
        </div>

        {file && !loading && (
          <div className="bg-[#1E1C1C] p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#A1A1A1]" />
              <span className="text-sm text-[#E8E8E8]">{file.name}</span>
            </div>
            <button onClick={() => setFile(null)} className="text-sm text-red-400 hover:underline">
              Remove
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-4 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] font-semibold hover:bg-[#E0C53B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            {loading ? 'Uploading...' : 'Upload & Profile'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UploadModal;
