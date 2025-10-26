// frontend/components/UploadModal.jsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, Loader2, AlertTriangle, FileText, CheckCircle, Save, ExternalLink, KeyRound, User, Edit, Info } from 'lucide-react';
import Modal from '../components/Modal';
import Accordion from '../components/Accordion';
import { API_URL } from '../config/config.js';

const UploadModal = ({ isOpen, onClose }) => {
  const { setActiveProject, addProject } = useProjects();
  const { makeAuthenticatedRequest } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Kaggle States ---
  const [kaggleUsername, setKaggleUsername] = useState('');
  const [kaggleApiKey, setKaggleApiKey] = useState('');
  const [kaggleDatasetUrl, setKaggleDatasetUrl] = useState('');
  const [kaggleProjectName, setKaggleProjectName] = useState('');
  const [fetchedUsername, setFetchedUsername] = useState(''); // Stores username confirmed by backend
  const [credsLoading, setCredsLoading] = useState(true); // Start true for initial GET check
  const [credsSaving, setCredsSaving] = useState(false); // Separate state for POST action
  const [credsSaved, setCredsSaved] = useState(false); // Indicates if usable creds are ready
  const [credsError, setCredsError] = useState('');
  const [credsSuccessMsg, setCredsSuccessMsg] = useState('');
  const [showCredsInputs, setShowCredsInputs] = useState(false); // Control visibility
  const [kaggleLoading, setKaggleLoading] = useState(false);
  const [kaggleError, setKaggleError] = useState('');
  const [csvFilesList, setCsvFilesList] = useState([]);
  const [selectedCsvFile, setSelectedCsvFile] = useState('');

  const modalContentRef = useRef(null);
  const successMsgTimeoutRef = useRef(null);

  // --- Clear success message timeout on unmount ---
  useEffect(() => {
    return () => {
      if (successMsgTimeoutRef.current) {
        clearTimeout(successMsgTimeoutRef.current);
      }
    };
  }, []);

  // --- Fetch existing Kaggle username on modal open ---
  useEffect(() => {
    if (isOpen) {
      // Reset relevant states
      resetKaggleState(true);
      setFile(null);
      setError('');
      setCredsLoading(true); // Start loading indicator for GET
      setShowCredsInputs(false); // Hide inputs initially
      setCredsSuccessMsg('');
      if (successMsgTimeoutRef.current) clearTimeout(successMsgTimeoutRef.current);

      // Fetch existing username
      const fetchUsername = async () => {
        try {
          console.log("Fetching existing Kaggle username...");
          const response = await makeAuthenticatedRequest(`${API_URL}/kaggle-credentials`); // Call GET
          if (response.ok) {
            const data = await response.json();
            if (data.kaggle_username) {
              setFetchedUsername(data.kaggle_username);
              setKaggleUsername(data.kaggle_username);
              setCredsSaved(true); // Mark creds as ready
              setShowCredsInputs(false); // Keep inputs hidden
              console.log("Fetched Kaggle username:", data.kaggle_username);
            } else {
              setCredsSaved(false);
              setShowCredsInputs(true); // Show inputs if none saved
              console.log("No saved Kaggle username found.");
            }
          } else {
            console.error("Failed to fetch username, status:", response.status);
            setCredsSaved(false);
            setShowCredsInputs(true); // Show inputs on fetch error
          }
        } catch (err) {
          console.error("Error fetching Kaggle username:", err);
          setCredsSaved(false);
          setShowCredsInputs(true); // Show inputs on catch
        } finally {
          setCredsLoading(false); // Finish loading indicator for GET
        }
      };
      fetchUsername();
    }
  }, [isOpen, makeAuthenticatedRequest]);

  // --- Dropzone Logic ---
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.type === 'text/csv') {
        setFile(selectedFile);
        setError('');
        resetKaggleState(false); // Keep potential fetchedUsername
        setShowCredsInputs(!fetchedUsername); // Hide cred inputs only if username was previously fetched/confirmed
      } else {
        setError('Invalid file type. Please upload a .csv file.');
      }
    }
  }, [fetchedUsername]); // Depend on fetchedUsername

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: kaggleDatasetUrl !== '' || kaggleLoading || loading || credsLoading || credsSaving, // Disable if any loading active
  });

  // --- Reset Kaggle Specific State ---
  const resetKaggleState = (resetFetched = true) => {
    setKaggleDatasetUrl('');
    setKaggleProjectName('');
    setKaggleLoading(false);
    setKaggleError('');
    setCsvFilesList([]);
    setSelectedCsvFile('');
    setKaggleApiKey('');
    setCredsError('');
    setCredsSuccessMsg('');
    if (resetFetched) {
        setFetchedUsername('');
        setKaggleUsername('');
        setCredsSaved(false);
        setShowCredsInputs(true); // Default to showing inputs on full reset
    } else {
        setKaggleUsername(fetchedUsername || ''); // Reset input to match fetched
    }
     // Clear any pending success message timeout
    if (successMsgTimeoutRef.current) {
        clearTimeout(successMsgTimeoutRef.current);
        successMsgTimeoutRef.current = null;
    }
  };

  // --- Handle Saving Kaggle Credentials ---
  const handleSaveCredentials = async () => {
    if (!kaggleUsername || !kaggleApiKey) {
      setCredsError('Please enter both Kaggle Username and API Key.');
      setCredsSuccessMsg('');
      return;
    }
    setCredsSaving(true); // Use separate state for POST loading
    setCredsError('');
    setCredsSuccessMsg('');
    if (successMsgTimeoutRef.current) clearTimeout(successMsgTimeoutRef.current);

    try {
      const response = await makeAuthenticatedRequest(`${API_URL}/kaggle-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          kaggle_username: kaggleUsername,
          kaggle_api_key: kaggleApiKey,
        }),
      });
      const data = await response.json();

      if (response.ok) { // Checks for 200 or 201
        setCredsSaved(true); // Mark creds as usable
        setFetchedUsername(data.username); // Update display name
        setKaggleApiKey(''); // Clear API key field
        setShowCredsInputs(false); // Hide inputs after success
        setCredsSuccessMsg(data.message || (response.status === 201 ? "Credentials Saved!" : "Credentials Updated!"));
        console.log("Credentials action successful:", data.status);

        successMsgTimeoutRef.current = setTimeout(() => {
          setCredsSuccessMsg('');
          successMsgTimeoutRef.current = null;
        }, 3000);

      } else {
        throw new Error(data.detail || 'Failed to save credentials.');
      }
    } catch (err) {
      console.error("Credential save error:", err);
      setCredsError(err.message);
      setCredsSaved(!!fetchedUsername); // Revert saved status only if username existed before
    } finally {
      setCredsSaving(false); // Finish POST loading indicator
    }
  };

  // --- Handle Kaggle Import Process ---
  const handleKaggleImport = async () => {
    if (!kaggleDatasetUrl) {
      setKaggleError('Please enter the Kaggle Dataset URL.');
      return;
    }
    // Check if credentials are confirmed ready
    if (!credsSaved) {
        setKaggleError('Please save your Kaggle credentials first.');
        return;
    }
     setKaggleLoading(true); setKaggleError(''); setCsvFilesList([]); // Reset list
     try {
       const payload = { dataset_url: kaggleDatasetUrl, csv_filename: selectedCsvFile || null, project_name: kaggleProjectName || null };
       const response = await makeAuthenticatedRequest(`${API_URL}/upload-from-kaggle/`, { method: 'POST', body: JSON.stringify(payload) });
       const data = await response.json();
       if (response.ok) { // Success
         setActiveProject(data); addProject({ id: data.project_id, project_name: kaggleProjectName || data.profile?.project_name || `Kaggle Project ${data.project_id}`, created_at: new Date().toISOString() }); handleClose();
       } else if (response.status === 400 && data.action_required === 'select_csv') { // Multiple CSVs
         setCsvFilesList(data.csv_files || []); setSelectedCsvFile(''); setKaggleError('Multiple CSV files found. Select one.');
       } else { throw new Error(data.detail || 'Import failed.'); }
     } catch (err) {
       setKaggleError(err.message);
       if (!err.message?.includes("Multiple CSV files found")) { setCsvFilesList([]); setSelectedCsvFile(''); }
     } finally {
       setKaggleLoading(false);
     }
  };

  // --- Handle Standard File Upload ---
  const handleFileUpload = async () => {
     if (!file) { setError('Please select a file.'); return; }
     setLoading(true); setError(''); const formData = new FormData(); formData.append('file', file);
     try {
       const token = localStorage.getItem('access_token'); if (!token) throw new Error('Auth token missing.');
       const response = await fetch(`${API_URL}/upload-and-profile/`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
       const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Upload failed.');
       setActiveProject(data); addProject({ id: data.project_id, project_name: file.name, created_at: new Date().toISOString() }); handleClose();
     } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // --- Decide which upload/import to run ---
  const handleSubmit = () => {
    setError(''); setKaggleError(''); setCredsError(''); setCredsSuccessMsg('');
    if (successMsgTimeoutRef.current) clearTimeout(successMsgTimeoutRef.current);
    if (file) { handleFileUpload(); }
    else if (kaggleDatasetUrl) { handleKaggleImport(); }
    else { setError('Please select a CSV or provide Kaggle details.'); }
  };

  // --- Close Modal ---
  const handleClose = () => {
     setFile(null); setLoading(false); setError('');
     resetKaggleState(true); setFetchedUsername(''); setCredsSaved(false); setShowCredsInputs(true); // Full reset
     if (successMsgTimeoutRef.current) clearTimeout(successMsgTimeoutRef.current);
     onClose();
  };

  // Combined disabled state for main submit button
  const isSubmitDisabled = loading || kaggleLoading || credsLoading || credsSaving || (!file && !kaggleDatasetUrl);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload New Project">
      {/* Scrollable container */}
      <div ref={modalContentRef} className="max-h-[75vh] overflow-y-auto pr-4 pl-1">
        <div className="flex flex-col gap-4">

          {/* --- File Upload Section --- */}
          <div
            {...getRootProps()}
            className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-[#F5D742] bg-[#3F3F3F]' : 'border-[#3F3F3F] hover:border-[#A1A1A1]'
            } ${kaggleDatasetUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} disabled={kaggleDatasetUrl !== '' || kaggleLoading || loading || credsLoading || credsSaving} />
            <div className="flex flex-col items-center text-[#A1A1A1]">
               <UploadCloud className="h-12 w-12 mb-2" />
               <p>{isDragActive ? 'Drop .csv file...' : 'Drag & drop .csv file, or click'}</p>
               <p className="text-xs mt-1">(Max ~100MB)</p>
             </div>
          </div>

          {file && !loading && ( /* File preview */
             <div className="bg-[#1E1C1C] p-3 rounded-lg flex items-center justify-between border border-[#3F3F3F]">
               <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#A1A1A1]" /><span className="text-sm text-[#E8E8E8]">{file.name}</span></div>
               <button onClick={() => setFile(null)} className="text-sm text-red-400 hover:underline">Remove</button>
             </div>
          )}

          {/* --- OR Separator --- */}
           <div className="relative my-4"> {/* Separator */}
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#3F3F3F]"></div></div>
             <div className="relative flex justify-center"><span className="bg-[#2A2828] px-2 text-sm text-[#A1A1A1]">OR</span></div>
           </div>

          {/* --- Kaggle Import Accordion --- */}
          <Accordion title="Import from Kaggle" defaultOpen={false}>
            <div className="space-y-4 pt-2">
              {/* Credentials Section */}
              <div className="p-4 bg-[#1E1C1C] rounded-lg border border-[#3F3F3F]">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-semibold text-[#E8E8E8]">Kaggle Credentials</h4>
                  {/* Show Edit button only if initial check passed AND inputs are hidden */}
                  {credsSaved && !showCredsInputs && !credsLoading && (
                    <button
                      onClick={() => { setShowCredsInputs(true); setCredsSuccessMsg(''); }}
                      className="text-xs text-[#A1A1A1] hover:text-[#F5D742] flex items-center"
                      disabled={credsSaving || kaggleLoading || loading} // Disable if any action in progress
                    >
                      <Edit className="h-3 w-3 mr-1"/> Edit
                    </button>
                  )}
                </div>

                {/* Show loading indicator during initial GET check */}
                {credsLoading && (
                  <div className="flex items-center text-sm text-[#A1A1A1] mb-3">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking saved credentials...
                  </div>
                )}

                {/* Display POST action errors */}
                {credsError && !credsLoading && (
                     <div className="flex items-start gap-2 text-red-400 mb-3 text-sm p-2 bg-red-900/20 border border-red-500/30 rounded">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>{credsError}</p>
                    </div>
                )}

                {/* Display POST action success message (temporary) */}
                {credsSuccessMsg && !credsLoading && !credsError && (
                     <div className="flex items-center gap-2 text-green-400 mb-3 text-sm p-2 bg-green-900/20 border border-green-500/30 rounded">
                       <CheckCircle className="h-4 w-4 flex-shrink-0" /><p>{credsSuccessMsg}</p>
                   </div>
                )}

                {/* Display status when inputs are hidden (after initial check or successful POST) */}
                {credsSaved && !showCredsInputs && !credsLoading && !credsSuccessMsg && !credsError && (
                     <div className="flex items-center gap-2 text-blue-400 mb-3 text-sm p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                        <Info className="h-4 w-4 flex-shrink-0" />
                        <p>Using saved credentials for: <span className="font-medium">{fetchedUsername}</span>.</p>
                    </div>
                )}

                {/* Credential Input Fields */}
                {showCredsInputs && !credsLoading && (
                  <div className="space-y-3">
                     <div> {/* Username */}
                       <label htmlFor="kaggleUsername" className="block text-sm font-medium text-[#A1A1A1] mb-1">Username</label>
                       <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-[#A1A1A1]" /></div>
                         <input type="text" id="kaggleUsername" value={kaggleUsername} onChange={(e) => { setKaggleUsername(e.target.value); setCredsError(''); }}
                           className="w-full pl-10 pr-4 py-2 bg-[#2A2828] border border-[#3F3F3F] rounded-lg focus:ring-1 focus:ring-[#E0C53B] text-sm" placeholder="Kaggle username" disabled={file !== null || credsSaving}/>
                       </div>
                     </div>
                     <div> {/* API Key */}
                       <label htmlFor="kaggleApiKey" className="block text-sm font-medium text-[#A1A1A1] mb-1">API Key</label>
                       <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><KeyRound className="h-5 w-5 text-[#A1A1A1]" /></div>
                         <input type="password" id="kaggleApiKey" value={kaggleApiKey} onChange={(e) => { setKaggleApiKey(e.target.value); setCredsError(''); }}
                           className="w-full pl-10 pr-4 py-2 bg-[#2A2828] border border-[#3F3F3F] rounded-lg focus:ring-1 focus:ring-[#E0C53B] text-sm" placeholder="Paste Kaggle API Key" disabled={file !== null || credsSaving}/>
                       </div>
                       <p className="text-xs text-[#A1A1A1] mt-1">From `kaggle.json`. Stored securely.</p>
                     </div>
                     <div className="flex gap-2 items-center"> {/* Buttons */}
                       <button onClick={handleSaveCredentials} disabled={credsSaving || !kaggleUsername || !kaggleApiKey || file !== null}
                         className="px-4 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] text-sm font-semibold hover:bg-[#E0C53B] disabled:opacity-50 flex items-center justify-center">
                         {credsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                         {credsSaving ? 'Saving...' : (fetchedUsername ? 'Update' : 'Save')}
                       </button>
                       {/* Show Cancel only if editing previously saved creds */}
                       {fetchedUsername && (
                           <button onClick={() => { setShowCredsInputs(false); setCredsError(''); setKaggleUsername(fetchedUsername); setKaggleApiKey('');}}
                             className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] text-sm hover:bg-opacity-80" disabled={credsSaving}>Cancel</button>
                       )}
                     </div>
                  </div>
                )}
              </div>

              {/* Dataset URL and Options - Render only if creds are confirmed saved AND initial check is done */}
              {credsSaved && !credsLoading && (
                  <div className="p-4 bg-[#1E1C1C] rounded-lg border border-[#3F3F3F]">
                       <h4 className="text-md font-semibold text-[#E8E8E8] mb-3">Dataset Details</h4>
                       {kaggleError && (<div className="flex items-start gap-2 text-red-400 mb-3 text-sm p-3 bg-red-900/30 border border-red-500/50 rounded-md"><AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p className="flex-1">{kaggleError}</p></div>)}
                       <div className="space-y-3">
                         <div> {/* URL Input */}
                           <label htmlFor="kaggleDatasetUrl" className="block text-sm font-medium text-[#A1A1A1] mb-1">Kaggle Dataset URL</label>
                           <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><ExternalLink className="h-5 w-5 text-[#A1A1A1]" /></div>
                             <input type="url" id="kaggleDatasetUrl" value={kaggleDatasetUrl} onChange={(e) => { setKaggleDatasetUrl(e.target.value); setKaggleError(''); setCsvFilesList([]); setSelectedCsvFile(''); setFile(null); }}
                               className="w-full pl-10 pr-4 py-2 bg-[#2A2828] border border-[#3F3F3F] rounded-lg focus:ring-1 focus:ring-[#E0C53B] text-sm" placeholder="https://www.kaggle.com/datasets/..." disabled={kaggleLoading || file !== null || credsSaving} />
                           </div>
                         </div>
                         <div> {/* Project Name Input */}
                           <label htmlFor="kaggleProjectName" className="block text-sm font-medium text-[#A1A1A1] mb-1">Project Name (Optional)</label>
                           <input type="text" id="kaggleProjectName" value={kaggleProjectName} onChange={(e) => setKaggleProjectName(e.target.value)}
                             className="w-full px-4 py-2 bg-[#2A2828] border border-[#3F3F3F] rounded-lg focus:ring-1 focus:ring-[#E0C53B] text-sm" placeholder="Defaults to dataset name" disabled={kaggleLoading || file !== null || credsSaving} />
                         </div>
                         {csvFilesList.length > 0 && ( /* CSV Selection */
                           <div className="pt-2">
                             <p className="text-sm font-medium text-[#E8E8E8] mb-2">Select CSV file:</p>
                             <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border border-[#3F3F3F] rounded-md p-3 bg-[#2A2828]">
                               {csvFilesList.map((csvName) => (<label key={csvName} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[#3F3F3F] rounded">
                                 <input type="radio" name="csvSelection" value={csvName} checked={selectedCsvFile === csvName} onChange={(e) => setSelectedCsvFile(e.target.value)}
                                   className="h-4 w-4 rounded-full bg-[#3F3F3F] border-[#A1A1A1] text-[#F5D742] focus:ring-[#F5D742]" disabled={kaggleLoading}/>
                                 <span className="text-sm text-[#E8E8E8] font-mono break-all">{csvName}</span></label>))}
                             </div><p className="text-xs text-[#A1A1A1] mt-1">Only one CSV file import allowed.</p>
                           </div>
                         )}
                       </div>
                  </div>
              )}
            </div>
          </Accordion>

          {/* Global File Upload Error */}
          {error && (
             <div className="flex items-center gap-2 text-red-400 mt-2"><AlertTriangle className="h-5 w-5" /><p className="text-sm">{error}</p></div>
          )}

        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#3F3F3F]">
        <button onClick={handleClose} className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80">Cancel</button>
        <button onClick={handleSubmit}
          // Disable conditions: any loading, no file AND no URL, or multi-CSV shown but none selected
          disabled={isSubmitDisabled || credsSaving || (csvFilesList.length > 0 && !selectedCsvFile)}
          className="px-4 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] font-semibold hover:bg-[#E0C53B] disabled:opacity-50 flex items-center min-w-[150px] justify-center">
          {(loading || kaggleLoading) && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
          {loading ? 'Uploading...' : (kaggleLoading ? (csvFilesList.length > 0 ? 'Import Selected' : 'Importing...') : 'Upload & Profile')}
        </button>
      </div>
    </Modal>
  );
};

export default UploadModal;