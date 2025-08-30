import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ChevronsUpDown } from 'lucide-react';

const StrategySelector = ({ selected, onSelect, columnType }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = React.useRef(null);
    const [buttonRect, setButtonRect] = useState(null);
    
    const numericStrategies = ["mean", "median", "mode", "custom"];
    const otherStrategies = ["mode", "custom"];
    const strategies = ['DOUBLE', 'INTEGER'].includes(columnType) ? numericStrategies : otherStrategies;

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            setButtonRect(buttonRef.current.getBoundingClientRect());
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative w-32">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="w-full bg-[#1E1C1C] border border-[#3F3F3F] rounded-md px-3 py-1 text-left flex items-center justify-between text-sm"
            >
                <span>{selected}</span>
                <ChevronsUpDown className="h-4 w-4 text-gray-400" />
            </button>
            {isOpen && buttonRect && (
                <>
                    <div 
                        className="fixed inset-0 z-[9998]" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div 
                        className="fixed z-[9999] w-32 bg-[#2A2828] border border-[#3F3F3F] rounded-md shadow-lg"
                        style={{
                            top: buttonRect.bottom + window.scrollY + 4,
                            left: buttonRect.left + window.scrollX,
                        }}
                    >
                        {strategies.map(strategy => (
                            <button
                                key={strategy}
                                onClick={() => {
                                    onSelect(strategy);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#3F3F3F] first:rounded-t-md last:rounded-b-md"
                            >
                                {strategy}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const ImputeNullsModal = ({ isOpen, onClose, onConfirm, profile }) => {
    const [imputations, setImputations] = useState([]);

    useEffect(() => {
        if (profile?.null_counts && profile?.schema) {
            const columnsWithNulls = Object.keys(profile.null_counts);
            const schemaMap = new Map(profile.schema.map(col => [col.column_name, col.column_type]));
            
            setImputations(
                columnsWithNulls.map(colName => ({
                    column_name: colName,
                    strategy: ['DOUBLE', 'INTEGER'].includes(schemaMap.get(colName)) ? 'mean' : 'mode',
                    value: '',
                    selected: true,
                    column_type: schemaMap.get(colName) || 'VARCHAR'
                }))
            );
        }
    }, [profile]);

    const handleStrategyChange = (columnName, newStrategy) => {
        setImputations(prev =>
            prev.map(imp =>
                imp.column_name === columnName ? { ...imp, strategy: newStrategy, value: '' } : imp
            )
        );
    };

    const handleValueChange = (columnName, newValue) => {
         setImputations(prev =>
            prev.map(imp =>
                imp.column_name === columnName ? { ...imp, value: newValue } : imp
            )
        );
    };
    
    const handleToggleSelection = (columnName) => {
        setImputations(prev =>
          prev.map(imp =>
            imp.column_name === columnName ? { ...imp, selected: !imp.selected } : imp
          )
        );
    };

    const handleConfirmClick = () => {
        const selectedImputations = imputations
            .filter(imp => imp.selected)
            .map(({ column_name, strategy, value }) => ({
                column_name,
                strategy,
                ...(strategy === 'custom' && { value }),
            }));
        onConfirm(selectedImputations);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Impute Missing Values">
            {/* SOLUTION 3: Remove overflow-y-auto and add it to an inner container */}
            <div className="space-y-3 mb-6">
                <div className="max-h-96 overflow-y-auto pr-2">
                    {imputations.map(imp => (
                        <div key={imp.column_name} className="flex items-center justify-between p-2 bg-[#1E1C1C] rounded-md mb-3">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    checked={imp.selected}
                                    onChange={() => handleToggleSelection(imp.column_name)}
                                    className="h-4 w-4 rounded bg-[#3F3F3F] border-[#A1A1A1] text-[#F5D742] focus:ring-[#F5D742]"
                                />
                                <div>
                                   <p className={`text-sm font-mono ${imp.selected ? 'text-white' : 'text-gray-500'}`}>{imp.column_name}</p>
                                   <p className={`text-xs ${imp.selected ? 'text-gray-400' : 'text-gray-600'}`}>Nulls: {profile.null_counts[imp.column_name]}</p>
                                </div>
                            </div>
                            {imp.selected && (
                                <div className="flex items-center gap-2">
                                    {/* Add data attribute for positioning */}
                                    <div data-dropdown={`${imp.column_type}-${imp.strategy}`}>
                                        <StrategySelector 
                                            selected={imp.strategy} 
                                            onSelect={(newStrategy) => handleStrategyChange(imp.column_name, newStrategy)} 
                                            columnType={imp.column_type} 
                                        />
                                    </div>
                                    {imp.strategy === 'custom' && (
                                        <input 
                                            type="text"
                                            value={imp.value}
                                            onChange={(e) => handleValueChange(imp.column_name, e.target.value)}
                                            className="w-24 bg-[#1E1C1C] border border-[#3F3F3F] rounded-md px-2 py-1 text-sm"
                                            placeholder="Value"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[#3F3F3F]">
                <button onClick={onClose} className="px-4 py-2 rounded-md bg-[#3F3F3F] text-[#E8E8E8] hover:bg-opacity-80">
                    Cancel
                </button>
                <button onClick={handleConfirmClick} className="px-4 py-2 rounded-md bg-[#F5D742] text-[#1E1C1C] font-semibold hover:bg-[#E0C53B]">
                    Apply Imputation
                </button>
            </div>
        </Modal>
    );
};

export default ImputeNullsModal;