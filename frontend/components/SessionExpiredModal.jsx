import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const SessionExpiredModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleLoginRedirect = () => {
    onClose(); // Close the modal first
    navigate('/auth');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleLoginRedirect} title="Session Expiled">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg text-[#E8E8E8] mb-2">Your session has expired.</p>
        <p className="text-sm text-[#A1A1A1] mb-6">Please log in again to continue.</p>
        <button
          onClick={handleLoginRedirect}
          className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-2 px-4 rounded-lg hover:bg-[#E0C53B] transition-colors"
        >
          Go to Login
        </button>
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
