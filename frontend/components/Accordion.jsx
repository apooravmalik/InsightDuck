import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#3F3F3F] rounded-lg mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-[#2A2828] hover:bg-[#3F3F3F] transition-colors"
      >
        <h3 className="font-semibold text-md text-[#E8E8E8]">{title}</h3>
        <ChevronDown 
          className={`h-5 w-5 text-[#A1A1A1] transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="p-4 bg-[#1E1C1C]">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
