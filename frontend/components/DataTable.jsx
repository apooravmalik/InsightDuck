import React from 'react';

const DataTable = ({ title, columns, data }) => {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-[#F5D742] mb-2">{title}</h3>
        <p className="text-[#A1A1A1]">No data available.</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-[#F5D742] mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-[#3F3F3F]">
        <table className="min-w-full divide-y divide-[#3F3F3F]">
          <thead className="bg-[#2A2828]">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.accessor} 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-[#A1A1A1] uppercase tracking-wider"
                >
                  {col.Header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[#1E1C1C] divide-y divide-[#3F3F3F]">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-[#2A2828]">
                {columns.map((col) => (
                  <td key={col.accessor} className="px-4 py-3 whitespace-nowrap text-sm text-[#E8E8E8]">
                    {row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
