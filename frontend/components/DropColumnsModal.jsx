import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';

const DropColumnsModal = ({ isOpen, onClose, onConfirm, schema }) => {
    const [columns, setColumns] = useState([]);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    useEffect(() => {
        if (schema) {
            setColumns(schema.map(col => ({ name: col.column_name, selected: false })));
        }
    }, [schema]);

    const handleToggleSelection = (columnName) => {
        setColumns(prev =>
            prev.map(c =>
                c.name === columnName ? { ...c, selected: !c.selected } : c
            )
        );
    };

    const handleSelectAll = (isSelected) => {
        setColumns(prev => prev.map(c => ({ ...c, selected: isSelected })));
    };

    const handleAttemptConfirm = () => {
        const columnsToDrop = columns.filter(c => c.selected).map(c => c.name);
        if (columnsToDrop.length > 0) {
            setIsConfirmModalOpen(true);
        } else {
            // If no columns are selected, just close and move to the next step
            onConfirm([]);
        }
    };
    
    const handleFinalConfirm = () => {
        const columnsToDrop = columns.filter(c => c.selected).map(c => c.name);
        setIsConfirmModalOpen(false);
        onConfirm(columnsToDrop);
    }

    const isAllSelected = columns.length > 0 && columns.every(c => c.selected);

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Select Columns to Drop">
                <p className="text-sm text-[#A1A1A1] mb-4">Select the columns you want to permanently delete from your dataset.</p>
                
                <div className="flex items-center p-2 rounded-md border-b border-[#3F3F3F] mb-2">
                    <input
                        type="checkbox"
                        id="select-all"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded bg-[#3F3F3F] border-[#A1A1A1] text-[#F5D742] focus:ring-[#F5D742] cursor-pointer"
                    />
                    <label htmlFor="select-all" className="ml-3 text-sm font-medium text-white cursor-pointer">
                        {isAllSelected ? 'Deselect All' : 'Select All'}
                    </label>
                </div>

                <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-2 py-2">
                    {columns.map(col => (
                        <div key={col.name} className="flex items-center p-2 rounded-md hover:bg-[#1E1C1C]">
                            <input
                                type="checkbox"
                                id={`col-${col.name}`}
                                checked={col.selected}
                                onChange={() => handleToggleSelection(col.name)}
                                className="h-4 w-4 rounded bg-[#3F3F3F] border-[#A1A1A1] text-[#F5D742] focus:ring-[#F5D742] cursor-pointer"
                            />
                            <label htmlFor={`col-${col.name}`} className="ml-3 text-sm font-mono text-white cursor-pointer">
                                {col.name}
                            </label>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-[#3F3F3F]">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80">
                        Cancel
                    </button>
                    <button 
                        onClick={handleAttemptConfirm} 
                        className="px-4 py-2 rounded-md bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                    >
                        {columns.some(c => c.selected) ? 'Drop Selected' : 'Skip & Continue'}
                    </button>
                </div>
            </Modal>
            
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleFinalConfirm}
                title="Confirm Destructive Action"
            >
                <p>This is a destructive action. The selected columns will be permanently deleted.</p>
                <p className="font-semibold mt-2">Are you sure you want to proceed?</p>
            </ConfirmationModal>
        </>
    );
};

export default DropColumnsModal;