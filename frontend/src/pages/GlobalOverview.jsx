import { useState, useEffect } from "react";
import { Activity, Server, Cpu, PlayCircle, ZoomIn } from "lucide-react";
import { fetchActiveNodes, fetchLatestClusterMetrics, fetchGlobalTimeSeries } from "../lib/api";
import GlobalChart from "../components/charts/GlobalChart";
import KpiCard from "../components/dashboard/KpiCard"; // <-- New Import

export default function GlobalOverview() {
  const [nodeCount, setNodeCount] = useState("--");
  const [metrics, setMetrics] = useState({ avgTemp: "--", aggregateTps: "--" });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 100 });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [nodes, latestMetrics, timeSeries] = await Promise.all([
          fetchActiveNodes(),
          fetchLatestClusterMetrics(),
          fetchGlobalTimeSeries() 
        ]);

        setNodeCount(nodes.length);
        setMetrics(latestMetrics);
        setChartData(timeSeries);
        setBrushRange({ startIndex: 0, endIndex: timeSeries.length - 1 });
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleViewFullHour = () => {
    setBrushRange({ startIndex: 0, endIndex: chartData.length - 1 });
  };

  const handleJumpToAnomaly = () => {
    const midPoint = Math.floor(chartData.length / 2);
    const windowSize = 60; 
    setBrushRange({ 
      startIndex: Math.max(0, midPoint - windowSize), 
      endIndex: Math.min(chartData.length - 1, midPoint + windowSize) 
    });
  };

  const handleBrushChange = (newRange) => {
    setBrushRange({ startIndex: newRange.startIndex, endIndex: newRange.endIndex });
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <h1 className="text-2xl font-semibold mb-6">Global Overview</h1>
      
      {/* Refactored Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
        <KpiCard 
          title="Active Nodes" 
          value={loading ? "..." : nodeCount} 
          icon={Server} 
          color="blue" 
        />
        <KpiCard 
          title="Avg Cluster Temp" 
          value={loading ? "..." : `${metrics.avgTemp}°C`} 
          icon={Cpu} 
          color="orange" 
          alert={!loading && metrics.avgTemp > 80} 
        />
        <KpiCard 
          title="Aggregate TPS" 
          value={loading ? "..." : metrics.aggregateTps} 
          icon={Activity} 
          color="purple" 
        />
      </div>

      {/* Recharts Time-Series */}
      <div className="w-full flex-1 min-h-[450px] border border-neutral-800 rounded-xl bg-neutral-900/50 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-neutral-200">Cluster Performance Timeline</h3>
          <div className="flex gap-3">
            <button onClick={handleViewFullHour} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors border border-neutral-700">
              <PlayCircle size={14} /> View Full History
            </button>
            <button onClick={handleJumpToAnomaly} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors border border-red-500/20">
              <ZoomIn size={14} /> Inspect Incident Window
            </button>
          </div>
        </div>

        <div className="w-full flex-1">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
              <Activity size={32} className="mb-3 animate-pulse opacity-50" />
              <p>Aggregating 1-hour telemetry...</p>
            </div>
          ) : (
            <GlobalChart data={chartData} startIndex={brushRange.startIndex} endIndex={brushRange.endIndex} onBrushChange={handleBrushChange} />
          )}
        </div>
      </div>
    </div>
  );
}