import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Check, X, ChevronsUpDown } from 'lucide-react';

// A reusable dropdown component for selecting data types
const TypeSelector = ({ selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const types = ["DOUBLE", "INTEGER", "DATE", "VARCHAR"];

  return (
    <div className="relative w-32">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#1E1C1C] border border-[#3F3F3F] rounded-md px-3 py-1 text-left flex items-center justify-between text-sm"
      >
        <span>{selected}</span>
        <ChevronsUpDown className="h-4 w-4 text-gray-400" />
      </button>
      {isOpen && (
        <div 
          className="absolute z-10 top-full mt-1 w-full bg-[#2A2828] border border-[#3F3F3F] rounded-md shadow-lg"
          onMouseLeave={() => setIsOpen(false)}
        >
          {types.map(type => (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#3F3F3F]"
            >
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ConvertTypesModal = ({ isOpen, onClose, onConfirm, initialSuggestions }) => {
  const [conversions, setConversions] = useState([]);
  
  useEffect(() => {
    // Initialize the modal's state from the suggestions passed in as props
    if (initialSuggestions) {
      setConversions(
        initialSuggestions.map(s => ({
          ...s,
          selected: true, // All suggestions are selected by default
          new_type: s.suggested_type,
        }))
      );
    }
  }, [initialSuggestions]);

  const handleToggleSelection = (columnName) => {
    setConversions(prev =>
      prev.map(c =>
        c.column_name === columnName ? { ...c, selected: !c.selected } : c
      )
    );
  };
  
  const handleTypeChange = (columnName, newType) => {
      setConversions(prev =>
        prev.map(c =>
            c.column_name === columnName ? { ...c, new_type: newType } : c
        )
    );
  };
  
  const handleConfirmClick = () => {
    // Filter for only the selected conversions and format them for the backend
    const selectedConversions = conversions
      .filter(c => c.selected)
      .map(c => ({ column_name: c.column_name, new_type: c.new_type }));
    onConfirm(selectedConversions);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review & Convert Data Types">
        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
            {conversions.map(conv => (
                <div key={conv.column_name} className="flex items-center justify-between p-2 bg-[#1E1C1C] rounded-md">
                    <div className="flex items-center gap-3">
                         <input 
                            type="checkbox"
                            checked={conv.selected}
                            onChange={() => handleToggleSelection(conv.column_name)}
                            className="h-4 w-4 rounded bg-[#3F3F3F] border-[#A1A1A1] text-[#F5D742] focus:ring-[#F5D742]"
                        />
                        <div>
                            <p className={`text-sm font-mono ${conv.selected ? 'text-white' : 'text-gray-500'}`}>{conv.column_name}</p>
                            <p className={`text-xs ${conv.selected ? 'text-gray-400' : 'text-gray-600'}`}>From {conv.current_type}</p>
                        </div>
                    </div>
                    {conv.selected && (
                        <TypeSelector selected={conv.new_type} onSelect={(newType) => handleTypeChange(conv.column_name, newType)} />
                    )}
                </div>
            ))}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-[#3F3F3F]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmClick}
            className="px-4 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] font-semibold hover:bg-[#E0C53B] transition-colors"
          >
            Apply Conversions
          </button>
        </div>
    </Modal>
  );
};

export default ConvertTypesModal;