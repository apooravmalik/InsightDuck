import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const ScatterPlot = ({ data, xAxis, yAxis, title }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        No data available for this chart.
      </div>
    );
  }

  // NOTE: The backend 'get_chart_data' should return data with 'x' and 'y' keys for this component.

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: -20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3F3F3F" />
          <XAxis type="number" dataKey="x" name={xAxis} stroke="#A1A1A1" />
          <YAxis type="number" dataKey="y" name={yAxis} stroke="#A1A1A1" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "#A1A1A1" }}
            contentStyle={{
              backgroundColor: "#2A2828",
              border: "1px solid #3F3F3F",
              color: "#E8E8E8",
            }}
          />
          <Scatter name={title} data={data} fill="#6EE7B7" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterPlot;
