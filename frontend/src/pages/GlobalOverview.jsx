import { useState, useEffect, useCallback } from "react";
import { Activity, Server, Cpu, PlayCircle, ZoomIn, RefreshCw, Network, Bot, X, Loader2 } from "lucide-react";
import { 
  fetchActiveNodes, 
  fetchGlobalTimeSeries,
  triggerSimulation,
  getTelemetryRowCount,
  extractGlobalContext,
  askAIAssistant
} from "../lib/api";

import GlobalHardwareChart from "../components/charts/GlobalHardwareChart";
import GlobalInferenceChart from "../components/charts/GlobalInferenceChart";
import GlobalNetworkChart from "../components/charts/GlobalNetworkChart";
import KpiCard from "../components/dashboard/KpiCard";

export default function GlobalOverview() {
  const [nodeCount, setNodeCount] = useState("--");
  const [gpuCount, setGpuCount] = useState("--");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [currentKpis, setCurrentKpis] = useState({
    heavyTemp: "--", devTemp: "--", tps: "--", bandwidth: "--"
  });

  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 100 });
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [nodes, timeSeries] = await Promise.all([
        fetchActiveNodes(),
        fetchGlobalTimeSeries() 
      ]);

      setNodeCount(nodes.length);
      const totalGpus = nodes.reduce((acc, node) => acc + (node.metadata?.gpu_count || 0), 0);
      setGpuCount(totalGpus > 0 ? totalGpus : 15); 
      setChartData(timeSeries);
      setBrushRange({ startIndex: 0, endIndex: timeSeries.length - 1 });

      // FIX: Smart Lookback Logic for KPIs
      // We reverse the array to search backwards from the newest data to the oldest
      if (timeSeries.length > 0) {
        const reversed = [...timeSeries].reverse();
        
        // Find the first occurrence where the metric is NOT null
        const latestHeavyTemp = reversed.find(t => t.heavyTemp !== null)?.heavyTemp || 0;
        const latestDevTemp = reversed.find(t => t.devTemp !== null)?.devTemp || 0;
        
        const latestHeavyTps = reversed.find(t => t.heavyTps !== null)?.heavyTps || 0;
        const latestDevTps = reversed.find(t => t.devTps !== null)?.devTps || 0;
        
        const latestHeavyBw = reversed.find(t => t.heavyBandwidth !== null)?.heavyBandwidth || 0;
        const latestDevBw = reversed.find(t => t.devBandwidth !== null)?.devBandwidth || 0;

        setCurrentKpis({
          heavyTemp: latestHeavyTemp,
          devTemp: latestDevTemp,
          tps: latestHeavyTps + latestDevTps,
          bandwidth: latestHeavyBw + latestDevBw
        });
      }

    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRegenerateSimulation = async () => {
    setIsSimulating(true);
    const started = await triggerSimulation();
    if (!started) {
      alert("Failed to reach simulation API. Check backend logs.");
      setIsSimulating(false);
      return;
    }

    const pollInterval = setInterval(async () => {
      const count = await getTelemetryRowCount();
      if (count > 32000) {
        clearInterval(pollInterval);
        setTimeout(async () => {
          await loadDashboardData();
          setIsSimulating(false);
        }, 2000);
      }
    }, 3000);
  };

  const handleAskAI = async () => {
    setIsAiOpen(true);
    if (aiResponse && !isAiLoading) return; 

    setIsAiLoading(true);
    setAiResponse("");

    const payload = extractGlobalContext(chartData, brushRange.startIndex, brushRange.endIndex);
    
    if (!payload) {
      setAiResponse("Error: No telemetry data found in the highlighted window.");
      setIsAiLoading(false);
      return;
    }

    const diagnosis = await askAIAssistant(payload, "investigator");
    setAiResponse(diagnosis);
    setIsAiLoading(false);
  };

  const handleBrushChange = (newRange) => {
    setBrushRange({ startIndex: newRange.startIndex, endIndex: newRange.endIndex });
    setAiResponse(""); 
  };

  const handleViewFullHour = () => setBrushRange({ startIndex: 0, endIndex: chartData.length - 1 });

  const handleJumpToAnomaly = () => {
    if (!chartData || chartData.length < 3) return;

    // 1. Calculate the true averages for THIS specific 60-minute run
    let sumTemp = 0, sumTps = 0, validTicks = 0;
    chartData.forEach(tick => {
      if (tick.heavyTemp !== null) {
        sumTemp += tick.heavyTemp;
        sumTps += (tick.heavyTps || 0);
        validTicks++;
      }
    });
    
    const avgTemp = validTicks > 0 ? (sumTemp / validTicks) : 50;
    const avgTps = validTicks > 0 ? (sumTps / validTicks) : 500;

    // FIX: Start at 0! If no anomaly is found, it safely falls back to the midpoint.
    let highestScore = 0; 
    let epicenterIndex = Math.floor(chartData.length / 2);

    // 2. The Relative Scoring Loop
    for (let i = 1; i < chartData.length - 1; i++) {
      const prev = chartData[i - 1];
      const current = chartData[i];
      let currentScore = 0;

      // RULE 1: Relative Temperature Spikes
      // If the temp is 10% higher than the normal average, start adding threat points.
      // A 20-degree spike adds 40 points.
      if (current.heavyTemp > avgTemp * 1.1) {
        currentScore += (current.heavyTemp - avgTemp) * 2; 
      }

      // RULE 2: Relative Throughput Collapse (Violent Drops)
      const prevTps = prev.heavyTps || 0;
      const currentTps = current.heavyTps || 0;
      
      // Only penalize if it was previously processing somewhat normally (> 50% of average)
      // AND it suddenly drops by more than 30% in a single 5-second tick.
      if (prevTps > (avgTps * 0.5) && currentTps < (prevTps * 0.7)) {
        currentScore += 100;
      }

      // RULE 3: The Multi-Dimensional Cascade
      // If it's hotter than average AND dropping throughput rapidly, this is the epicenter.
      if (current.heavyTemp > avgTemp && currentTps < (prevTps * 0.5)) {
        currentScore += 150;
      }

      // Track the worst moment
      if (currentScore > highestScore) {
        highestScore = currentScore;
        epicenterIndex = i;
      }
    }
    if (highestScore > 50) {
      const alertEvent = new CustomEvent('ai-cluster-alert', { 
        detail: { 
          node: "Heavy Workload Cluster", 
          message: `Critical anomaly detected with Threat Score: ${highestScore}. Thermals and/or throughput collapsed.`, 
          time: new Date().toLocaleTimeString() 
        }
      });
      window.dispatchEvent(alertEvent);
    }

    console.log(`[AIOps Engine] Peak Anomaly found at index: ${epicenterIndex} with Threat Score: ${highestScore}`);

    // 3. Snap the Recharts brush to a 5-minute window (30 ticks * 5s = 2.5 mins on each side)
    const windowSize = 30; 
    
    setBrushRange({ 
      startIndex: Math.max(0, epicenterIndex - windowSize), 
      endIndex: Math.min(chartData.length - 1, epicenterIndex + windowSize) 
    });
  };

  return (
    <div className="p-8 flex flex-col h-full relative overflow-x-hidden">
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Global Infrastructure</h1>
          <button 
            onClick={handleAskAI}
            disabled={loading || isSimulating}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-medium rounded-md transition-all shadow-[0_0_10px_rgba(79,70,229,0.1)] disabled:opacity-50"
          >
            <Bot size={14} /> Ask AI Investigator
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={handleViewFullHour} disabled={loading || isSimulating} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-md transition-colors border border-neutral-700 disabled:opacity-50">
            <PlayCircle size={14} /> View Full
          </button>
          <button onClick={handleJumpToAnomaly} disabled={loading || isSimulating} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-md transition-colors border border-red-500/20 disabled:opacity-50">
            <ZoomIn size={14} /> Inspect Anomaly
          </button>
          <button onClick={handleRegenerateSimulation} disabled={isSimulating} className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all border ${isSimulating ? "bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500"}`}>
            <RefreshCw size={14} className={isSimulating ? "animate-spin" : ""} /> 
            {isSimulating ? "Synthesizing..." : "Regenerate Simulation"}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 shrink-0">
        <KpiCard title="Active Nodes (GPUs)" value={`${nodeCount} (${gpuCount})`} icon={Server} color="blue" />
        <KpiCard title="Heavy Workload Temp" value={`${currentKpis.heavyTemp}°C`} icon={Cpu} color="orange" alert={currentKpis.heavyTemp > 80} />
        <KpiCard title="Dev Workload Temp" value={`${currentKpis.devTemp}°C`} icon={Cpu} color="emerald" />
        <KpiCard title="Global Aggregate TPS" value={currentKpis.tps} icon={Activity} color="purple" />
        <KpiCard title="Global Interconnect" value={`${currentKpis.bandwidth} GB/s`} icon={Network} color="indigo" />
      </div>

      <div className="w-full flex-1 border border-neutral-800 rounded-xl bg-neutral-900/50 p-4 flex flex-col space-y-4 relative overflow-hidden">
        
        {(loading || isSimulating) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 z-50 bg-neutral-900/80 rounded-xl backdrop-blur-sm">
            <RefreshCw size={32} className="mb-3 animate-spin text-blue-500" />
            <p>{isSimulating ? "Injecting Hardware Failures..." : "Aggregating 1-hour telemetry..."}</p>
          </div>
        )}

        {/* FIX: Changed from h-40 shrink-0 to flex-1 min-h-[160px] to stretch automatically */}
        <div className="flex-1 min-h-[160px] w-full flex flex-col">
          <div className="text-xs font-medium text-neutral-400 mb-1 flex items-center gap-2 shrink-0"><Cpu size={14}/> Layer 1: Hardware Thermals</div>
          <div className="flex-1 min-h-0"><GlobalHardwareChart data={chartData} syncId="global-sync" /></div>
        </div>

        <div className="flex-1 min-h-[160px] w-full flex flex-col">
          <div className="text-xs font-medium text-neutral-400 mb-1 flex items-center gap-2 shrink-0"><Activity size={14}/> Layer 2: Compute Throughput</div>
          <div className="flex-1 min-h-0"><GlobalInferenceChart data={chartData} syncId="global-sync" /></div>
        </div>

        <div className="flex-1 min-h-[160px] w-full flex flex-col">
          <div className="text-xs font-medium text-neutral-400 mb-1 flex items-center gap-2 shrink-0"><Network size={14}/> Layer 3: Network Fabric</div>
          <div className="flex-1 min-h-0"><GlobalNetworkChart data={chartData} syncId="global-sync" startIndex={brushRange.startIndex} endIndex={brushRange.endIndex} onBrushChange={handleBrushChange} /></div>
        </div>
      </div>

      <div className={`fixed inset-y-0 right-0 w-[450px] bg-neutral-900 border-l border-neutral-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isAiOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Bot size={20} /></div>
            <div>
              <h3 className="font-medium text-neutral-100">AI Global Investigator</h3>
              <p className="text-xs text-neutral-400">Powered by DeepSeek-R1 & Groq</p>
            </div>
          </div>
          <button onClick={() => setIsAiOpen(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isAiLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-neutral-400">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm animate-pulse">Triaging cluster anomalies...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-neutral-300 leading-relaxed">
                {aiResponse || "Highlight an anomaly on the timeline below and click 'Ask AI' to triage the failing node."}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
           <div className="text-xs text-neutral-500 text-center">Triage restricted to highlighted timeline bounds.</div>
        </div>
      </div>

    </div>
  );
}