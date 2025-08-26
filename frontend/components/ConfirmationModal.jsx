import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  children 
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-[#F5D742] mx-auto mb-4" />
        <div className="text-sm text-[#A1A1A1] mb-6">
          {children}
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] font-semibold hover:bg-[#E0C53B] transition-colors"
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
