import { useState, useEffect, useCallback } from "react";
import { Activity, Server, Cpu, PlayCircle, ZoomIn, RefreshCw } from "lucide-react";
import { 
  fetchActiveNodes, 
  fetchLatestClusterMetrics, 
  fetchGlobalTimeSeries,
  triggerSimulation,
  getTelemetryRowCount
} from "../lib/api";
import GlobalChart from "../components/charts/GlobalChart";
import KpiCard from "../components/dashboard/KpiCard";

export default function GlobalOverview() {
  const [nodeCount, setNodeCount] = useState("--");
  const [metrics, setMetrics] = useState({ avgTemp: "--", aggregateTps: "--" });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 100 });

  // 1. Extracted data loading logic so we can call it on mount AND after a simulation
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 2. The new Orchestration Engine
  const handleRegenerateSimulation = async () => {
    setIsSimulating(true);
    
    // Fire the background generation job on Render
    const started = await triggerSimulation();
    if (!started) {
      alert("Failed to reach simulation API. Check backend logs.");
      setIsSimulating(false);
      return;
    }

    // 3. Polling Mechanism: Check row count every 3 seconds
    const pollInterval = setInterval(async () => {
      const count = await getTelemetryRowCount();
      
      // We expect ~32,400 rows. Once it crosses 32,000, we know the bulk insert is finishing up.
      if (count > 32000) {
        clearInterval(pollInterval);
        
        // Wait an extra 2 seconds just to ensure the final chunks commit safely
        setTimeout(async () => {
          await loadDashboardData();
          setIsSimulating(false);
        }, 2000);
      }
    }, 3000);
  };

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Global Overview</h1>
      </div>
      
      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
        <KpiCard 
          title="Active Nodes" 
          value={loading || isSimulating ? "..." : nodeCount} 
          icon={Server} 
          color="blue" 
        />
        <KpiCard 
          title="Avg Cluster Temp" 
          value={loading || isSimulating ? "..." : `${metrics.avgTemp}°C`} 
          icon={Cpu} 
          color="orange" 
          alert={!loading && !isSimulating && metrics.avgTemp > 80} 
        />
        <KpiCard 
          title="Aggregate TPS" 
          value={loading || isSimulating ? "..." : metrics.aggregateTps} 
          icon={Activity} 
          color="purple" 
        />
      </div>

      {/* Recharts Time-Series */}
      <div className="w-full flex-1 min-h-[450px] border border-neutral-800 rounded-xl bg-neutral-900/50 p-6 flex flex-col transition-all">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-neutral-200">Cluster Performance Timeline</h3>
          
          {/* Controls Bar */}
          <div className="flex gap-3">
            <button 
              onClick={handleViewFullHour} 
              disabled={loading || isSimulating}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors border border-neutral-700 disabled:opacity-50"
            >
              <PlayCircle size={14} /> View Full History
            </button>
            <button 
              onClick={handleJumpToAnomaly} 
              disabled={loading || isSimulating}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors border border-red-500/20 disabled:opacity-50"
            >
              <ZoomIn size={14} /> Inspect Incident Window
            </button>
            
            {/* NEW: Simulation Trigger Button */}
            <button 
              onClick={handleRegenerateSimulation} 
              disabled={isSimulating}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all border ${
                isSimulating 
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
              }`}
            >
              <RefreshCw size={14} className={isSimulating ? "animate-spin" : ""} /> 
              {isSimulating ? "Generating 32k Rows..." : "Regenerate Simulation"}
            </button>
          </div>
        </div>

        <div className="w-full flex-1 relative">
          {loading || isSimulating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 z-10 bg-neutral-900/80 rounded-lg backdrop-blur-sm">
              <RefreshCw size={32} className="mb-3 animate-spin text-blue-500" />
              <p>{isSimulating ? "Synthesizing GPU Telemetry & Hardware Failures..." : "Aggregating 1-hour telemetry..."}</p>
            </div>
          ) : null}
          
          <GlobalChart 
            data={chartData} 
            startIndex={brushRange.startIndex} 
            endIndex={brushRange.endIndex} 
            onBrushChange={handleBrushChange} 
          />
        </div>
      </div>
    </div>
  );
}