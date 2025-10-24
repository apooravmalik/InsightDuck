// frontend/views/EdaView.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useProjects } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/config";
import { Loader2, AlertTriangle, Info, Download } from "lucide-react";
import Accordion from "../components/Accordion";
import DataTable from "../components/DataTable";
// NEW IMPORTS FOR PHASE 3
import BarChart from "../components/charts/BarChart";
import ScatterPlot from "../components/charts/ScatterPlot";
import CorrelationHeatmap from "../components/charts/CorrelationHeatmap";
// End NEW IMPORTS

// Define a universal Chart component to handle different types
const VisualizationCard = ({
  suggestion,
  projectId,
  fetchChartData,
  chartData,
  isLoading,
}) => {
  // Determine the component and props
  const { chart_type, title, description, parameters } = suggestion;
  const { x_axis, y_axis } = parameters;

  useEffect(() => {
    // Fetch data when component mounts or suggestion changes
    if (!chartData) {
      fetchChartData(suggestion);
    }
  }, [suggestion, fetchChartData, chartData]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-[#A1A1A1]">
          <Loader2 className="h-6 w-6 animate-spin text-[#F5D742]" />
          <span className="ml-2">Loading Chart Data...</span>
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="text-center text-gray-500 py-10">
          Chart data not found or is empty.
        </div>
      );
    }

    const baseProps = {
      data: chartData,
      xAxis: x_axis,
      yAxis: y_axis || "count",
      title,
    };

    switch (chart_type) {
      case "bar_chart":
      case "histogram": // Use BarChart for both histogram (count of categories/bins) and bar chart
        return <BarChart {...baseProps} yAxis={"count"} />;
      case "scatter_plot":
        return <ScatterPlot {...baseProps} />;
      // Future chart types: box_plot, line_chart, etc. will go here.
      default:
        return (
          <div className="text-center text-red-400 py-10">
            Unsupported chart type: {chart_type}
          </div>
        );
    }
  };

  return (
    <div className="bg-[#2A2828] rounded-lg p-4 border border-[#3F3F3F]">
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-[#A1A1A1] mb-3">{description}</p>
      <div className="bg-[#1E1C1C] rounded-md p-3 mb-4">
        <p className="text-xs text-[#F5D742] font-mono">
          {chart_type.toUpperCase()} | X: {x_axis}
          {y_axis && ` | Y: ${y_axis}`}
        </p>
      </div>
      <div className="h-[300px] w-full">{renderChart()}</div>
      <div className="flex justify-end pt-3 border-t border-[#3F3F3F] mt-2">
        <button className="text-xs text-[#A1A1A1] hover:text-[#F5D742] flex items-center">
          <Download className="h-3 w-3 mr-1" /> Download Plot (Phase 4)
        </button>
      </div>
    </div>
  );
};

const EdaView = () => {
  const { currentSession, activeProjectId, updateCurrentSession } =
    useProjects();
  const { makeAuthenticatedRequest } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // NEW: State for chart data, keyed by a unique chart ID
  const [chartDataState, setChartDataState] = useState({});
  const [loadingChartId, setLoadingChartId] = useState(null);

  const fetchEdaData = useCallback(async () => {
    // ... (Existing logic for fetching summary, insights, and suggestions remains the same) ...
    if (!activeProjectId || (currentSession && currentSession.edaResults))
      return;

    setLoading(true);
    setError("");

    try {
      // 1. Fetch Statistical Summary
      const summaryResponse = await makeAuthenticatedRequest(
        `${API_URL}/eda-summary/`,
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId }),
        }
      );
      const summaryData = await summaryResponse.json();
      if (!summaryResponse.ok)
        throw new Error(summaryData.detail || "Failed to fetch summary");

      // 2. Fetch Automated Insights
      const insightsResponse = await makeAuthenticatedRequest(
        `${API_URL}/eda-insights/`,
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId }),
        }
      );
      const insightsData = await insightsResponse.json();
      if (!insightsResponse.ok)
        throw new Error(insightsData.detail || "Failed to fetch insights");

      // 3. Fetch LLM Suggestions
      const suggestionsResponse = await makeAuthenticatedRequest(
        `${API_URL}/suggest-llm-visualizations/`,
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId }),
        }
      );
      const suggestionsData = await suggestionsResponse.json();
      if (!suggestionsResponse.ok)
        throw new Error(
          suggestionsData.detail || "Failed to fetch suggestions"
        );

      const newEdaResults = {
        summary: summaryData,
        insights: insightsData.insights,
        suggestions: suggestionsData.suggestions,
      };

      updateCurrentSession({ edaResults: newEdaResults });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    activeProjectId,
    currentSession,
    makeAuthenticatedRequest,
    updateCurrentSession,
  ]);

  // NEW: Function to fetch individual chart data
  const fetchChartData = useCallback(
    async (suggestion) => {
      const chartId = `${suggestion.chart_type}-${
        suggestion.parameters.x_axis
      }-${suggestion.parameters.y_axis || "null"}`;
      if (chartDataState[chartId] || loadingChartId === chartId) return;

      setLoadingChartId(chartId);
      try {
        const response = await makeAuthenticatedRequest(
          `${API_URL}/get-chart-data/`,
          {
            method: "POST",
            body: JSON.stringify({
              project_id: activeProjectId,
              chart_type: suggestion.chart_type,
              x_axis: suggestion.parameters.x_axis,
              y_axis: suggestion.parameters.y_axis,
            }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || `Failed to fetch data for ${suggestion.title}`
          );
        }

        setChartDataState((prev) => ({
          ...prev,
          [chartId]: data.chart_data,
        }));
      } catch (err) {
        console.error("Error fetching chart data:", err);
        setChartDataState((prev) => ({
          ...prev,
          [chartId]: { error: err.message }, // Store error in state
        }));
      } finally {
        setLoadingChartId(null);
      }
    },
    [activeProjectId, makeAuthenticatedRequest, chartDataState, loadingChartId]
  );

  useEffect(() => {
    // Only fetch if a project is active and results haven't been loaded yet
    if (activeProjectId && !currentSession?.edaResults) {
      fetchEdaData();
    }
  }, [activeProjectId, currentSession, fetchEdaData]);

  if (!currentSession) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#F5D742]">
          Exploratory Data Analysis
        </h1>
        <p className="mt-2 text-[#A1A1A1]">
          Select a project from the sidebar to view its analysis.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 flex flex-col items-center justify-center h-full">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg">Error loading EDA: {error}</p>
        <button
          onClick={fetchEdaData}
          className="mt-4 text-[#F5D742] hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (loading || !currentSession.edaResults) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#A1A1A1]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5D742]" />
        <span className="mt-4 text-lg">Generating EDA Report...</span>
      </div>
    );
  }

  const { summary, insights, suggestions } = currentSession.edaResults;

  const numericSummaryData = Object.entries(summary.numeric_summary).map(
    ([col, data]) => ({
      "Column Name": col,
      Count: data.count,
      Mean: data.mean === null ? "N/A" : parseFloat(data.mean)?.toFixed(2),
      "Std Dev": data.std === null ? "N/A" : parseFloat(data.std)?.toFixed(2),
      Min: data.min,
      Max: data.max,
    })
  );
  const numericSummaryColumns = [
    { Header: "Column Name", accessor: "Column Name" },
    { Header: "Count", accessor: "Count" },
    { Header: "Mean", accessor: "Mean" },
    { Header: "Std Dev", accessor: "Std Dev" },
    { Header: "Min", accessor: "Min" },
    { Header: "Max", accessor: "Max" },
  ];

  const categoricalSummaryData = Object.entries(
    summary.categorical_summary
  ).map(([col, data]) => ({
    "Column Name": col,
    Unique: data.unique_count,
    Mode: data.mode,
    "Top 5 Frequencies": Object.entries(data.top_5_frequencies)
      .map(([val, count]) => `${val} (${count})`)
      .join("; "),
  }));
  const categoricalSummaryColumns = [
    { Header: "Column Name", accessor: "Column Name" },
    { Header: "Unique Count", accessor: "Unique" },
    { Header: "Mode", accessor: "Mode" },
    { Header: "Top 5 Frequencies", accessor: "Top 5 Frequencies" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-[#F5D742]">
        Exploratory Data Analysis
      </h1>
      <p className="text-[#A1A1A1]">
        InsightDuck analyzed your cleaned dataset ({summary.total_rows} rows,{" "}
        {summary.total_columns} columns) for project:
        <span className="font-semibold text-white ml-1">
          {currentSession.profile.project_name || `ID ${activeProjectId}`}
        </span>
      </p>

      {/* Automated Insights Section */}
      <Accordion
        title={`Automated Insights (${insights.length})`}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.length > 0 ? (
            insights.map((insight, index) => {
              const colors =
                insight.severity === "warning"
                  ? {
                      bg: "bg-yellow-900/50",
                      border: "border-yellow-500/50",
                      text: "text-yellow-400",
                      icon: AlertTriangle,
                    }
                  : insight.severity === "info"
                  ? {
                      bg: "bg-blue-900/50",
                      border: "border-blue-500/50",
                      text: "text-blue-400",
                      icon: Info,
                    }
                  : {
                      bg: "bg-gray-800/50",
                      border: "border-gray-500/50",
                      text: "text-gray-400",
                      icon: Info,
                    };

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg flex items-start gap-3 ${colors.bg} border ${colors.border}`}
                >
                  {React.createElement(colors.icon, {
                    className: `h-5 w-5 ${colors.text} flex-shrink-0`,
                  })}
                  <div>
                    <h4 className="font-semibold text-white">
                      {insight.title}
                    </h4>
                    <p className="text-sm text-[#A1A1A1]">
                      {insight.description}
                    </p>
                    {insight.affected_columns && (
                      <p className="text-xs text-gray-500 mt-1">
                        Columns: {insight.affected_columns.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[#A1A1A1] text-sm md:col-span-2">
              No critical issues or interesting insights were automatically
              detected.
            </p>
          )}
        </div>
      </Accordion>

      {/* Statistical Summary Section */}
      <Accordion title="Statistical Summary" defaultOpen={true}>
        {numericSummaryData.length > 0 && (
          <DataTable
            title="Numeric Column Statistics"
            columns={numericSummaryColumns}
            data={numericSummaryData}
          />
        )}
        {categoricalSummaryData.length > 0 && (
          <DataTable
            title="Categorical Column Frequencies"
            columns={categoricalSummaryColumns}
            data={categoricalSummaryData}
          />
        )}
        <div className="mt-6 pt-4 border-t border-[#3F3F3F]">
          <h3 className="text-lg font-semibold text-[#F5D742] mb-2">
            Feature Correlation
          </h3>
          {summary.correlation_matrix.length > 0 ? (
            <CorrelationHeatmap data={summary.correlation_matrix} />
          ) : (
            <p className="text-[#A1A1A1]">
              Not enough numeric columns (min 2) to calculate correlation.
            </p>
          )}
        </div>
      </Accordion>

      {/* Interactive Visualizations Section */}
      <Accordion
        title={`LLM Visualization Suggestions (${suggestions.length})`}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => {
              const chartId = `${suggestion.chart_type}-${
                suggestion.parameters.x_axis
              }-${suggestion.parameters.y_axis || "null"}`;
              return (
                <VisualizationCard
                  key={chartId}
                  suggestion={suggestion}
                  projectId={activeProjectId}
                  fetchChartData={fetchChartData}
                  chartData={chartDataState[chartId]}
                  isLoading={loadingChartId === chartId}
                />
              );
            })
          ) : (
            <p className="text-[#A1A1A1] lg:col-span-2">
              No LLM suggestions were generated.
            </p>
          )}
        </div>
      </Accordion>
    </div>
  );
};

export default EdaView;
