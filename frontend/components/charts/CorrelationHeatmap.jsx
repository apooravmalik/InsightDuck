// frontend/components/charts/CorrelationHeatmap.jsx (Replaces the placeholder in EdaView)
import React from "react";

const CorrelationHeatmap = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No correlation data available.
      </div>
    );
  }

  // Group columns for matrix display
  const allColumns = Array.from(new Set(data.flatMap((d) => [d.col1, d.col2])));

  const getColor = (correlation) => {
    const absCorr = Math.abs(correlation);
    if (absCorr > 0.8) return "bg-red-700/80";
    if (absCorr > 0.5) return "bg-orange-600/80";
    if (absCorr > 0.2) return "bg-yellow-500/80";
    return "bg-gray-700/80";
  };

  const matrixData = {};
  data.forEach((d) => {
    matrixData[`${d.col1}-${d.col2}`] = d.correlation;
    matrixData[`${d.col2}-${d.col1}`] = d.correlation; // Mirror
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#3F3F3F] border border-[#3F3F3F]">
        <thead className="bg-[#2A2828]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-[#A1A1A1]">
              Col
            </th>
            {allColumns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-center text-xs font-medium text-[#A1A1A1] rotate-45 transform origin-bottom-left w-20"
              >
                <span className="inline-block -rotate-45 whitespace-nowrap">
                  {col}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[#1E1C1C] divide-y divide-[#3F3F3F]">
          {allColumns.map((rowCol) => (
            <tr key={rowCol}>
              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-white bg-[#2A2828] border-r border-[#3F3F3F]">
                {rowCol}
              </td>
              {allColumns.map((colCol) => {
                const isDiagonal = rowCol === colCol;
                const corr = isDiagonal ? 1 : matrixData[`${rowCol}-${colCol}`];

                return (
                  <td
                    key={colCol}
                    className={`px-2 py-1 text-xs text-center font-mono transition-colors ${getColor(
                      corr
                    )} ${isDiagonal ? "bg-gray-500/80" : "hover:scale-105"}`}
                  >
                    {isDiagonal ? "1.00" : corr ? corr.toFixed(2) : "N/A"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CorrelationHeatmap;
