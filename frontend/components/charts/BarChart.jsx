import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const BarChart = ({ data, xAxis, yAxis, title }) => {
  // FIX: The backend already formats the data as [{x: value, y: count}].
  // The transformation logic was unnecessarily mapping keys that didn't exist in the data.
  const chartData = data;

  if (!chartData || chartData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        No data available for this chart.
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart
          data={chartData} // Use the corrected data object
          margin={{
            top: 5,
            right: 5,
            left: -20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3F3F3F" />
          <XAxis
            dataKey="x" // Use the standardized key 'x'
            stroke="#A1A1A1"
            tick={{ fontSize: 10 }}
            angle={-20}
            textAnchor="end"
            height={50}
            interval={0}
          />
          <YAxis stroke="#A1A1A1" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#2A2828",
              border: "1px solid #3F3F3F",
              color: "#E8E8E8",
            }}
          />
          <Bar dataKey="y" fill="#F5D742" /> // Use the standardized key 'y'
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
