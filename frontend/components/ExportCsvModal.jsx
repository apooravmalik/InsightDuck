import React from 'react';
import Modal from './Modal';
import { Download, Loader2 } from 'lucide-react';
import logo from '../assets/id-export-logo.png';

const ExportCsvModal = ({ isOpen, onClose, onDownload, isDownloading }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Your Cleaned Data is Ready!">
            <div className="text-center flex flex-col items-center">
                <img src={logo} alt="InsightDuck Logo" className="w-24 h-auto mb-4" />
                <p className="text-md text-[#E8E8E8] mb-2">
                    Good luck on your Data Science journey...
                </p>
                <p className="text-sm text-[#A1A1A1] mb-6">
                    ...or whatever else you want to do with this data!
                </p>
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center transition-colors"
                >
                    {isDownloading ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                        <Download className="h-5 w-5 mr-2" />
                    )}
                    {isDownloading ? 'Preparing Download...' : 'Download CSV'}
                </button>
            </div>
        </Modal>
    );
};

export default ExportCsvModal;