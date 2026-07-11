import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Cpu, Activity, Network, ShieldAlert, Server, Bot, X, Loader2 } from "lucide-react";
import { fetchNodeDetailsAndTelemetry, extractLocalContext, askAIAssistant } from "../lib/api";

// Imports for the modular charts
import HardwareChart from "../components/charts/HardwareChart";
import InferenceChart from "../components/charts/InferenceChart";
import NetworkChart from "../components/charts/NetworkChart";

export default function NodeBlastRadius() {
  const { hostname } = useParams();
  const [node, setNode] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // NEW: AI Diagnostic State
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 100 });
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetchNodeDetailsAndTelemetry(hostname);
        if (result) {
          setNode(result.node);
          setTimeline(result.timeline);
          // Default the brush to the full length of the data
          setBrushRange({ startIndex: 0, endIndex: result.timeline.length - 1 });
        }
      } catch (err) {
        console.error("Failed to load timeline metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [hostname]);

  // ==========================================
  // THE AI TRIGGER
  // ==========================================
  const handleAskAI = async () => {
    setIsAiOpen(true);
    
    // Prevent re-fetching if they just opened the drawer without changing the timeline
    if (aiResponse && !isAiLoading) return; 

    setIsAiLoading(true);
    setAiResponse("");

    // Slice the exact data the user is currently looking at
    const payload = extractLocalContext(node, timeline, brushRange.startIndex, brushRange.endIndex);
    
    if (!payload) {
      setAiResponse("Error: No telemetry data found in the highlighted window.");
      setIsAiLoading(false);
      return;
    }

    // Send to Groq via our FastAPI backend
    const diagnosis = await askAIAssistant(payload, "diagnostician");
    setAiResponse(diagnosis);
    setIsAiLoading(false);
  };

  const handleBrushChange = (newRange) => {
    setBrushRange({ startIndex: newRange.startIndex, endIndex: newRange.endIndex });
    setAiResponse(""); // Clear old analysis when user changes the timeline
  };

  if (loading) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-neutral-500">
        <Activity size={32} className="animate-pulse mb-2 text-blue-400" />
        <p>Reconstructing timeline correlation vectors...</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="p-8 text-center text-red-400">
        Host {hostname} could not be resolved within the infrastructure catalog.
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col space-y-6 h-full relative overflow-x-hidden">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4">
          <Link to="/nodes" className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{node.hostname}</h1>
              {/* NEW: The AI Trigger Button Next to Hostname */}
              <button 
                onClick={handleAskAI}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-medium rounded-md transition-all shadow-[0_0_10px_rgba(79,70,229,0.1)]"
              >
                <Bot size={14} /> Ask AI Diagnostician
              </button>
            </div>
            <p className="text-sm text-neutral-400 capitalize">{node.metadata?.role?.replace("-", " ")} Instance</p>
          </div>
        </div>
        <div className="text-xs font-mono text-neutral-500 bg-neutral-900 px-3 py-1.5 border border-neutral-800 rounded-md">
          ID: {node.id}
        </div>
      </div>

      {/* Node Hardware Specifications Metadata Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Server className="text-neutral-500 shrink-0" size={18} />
          <div>
            <div className="text-xs text-neutral-500 font-medium">Chassis Form Factor</div>
            <div className="text-sm text-neutral-200 font-mono">{node.metadata?.form_factor || "N/A"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Cpu className="text-neutral-500 shrink-0" size={18} />
          <div>
            <div className="text-xs text-neutral-500 font-medium">Processor Layout</div>
            <div className="text-sm text-neutral-200 text-ellipsis overflow-hidden whitespace-nowrap">{node.metadata?.system_cpu || "N/A"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Network className="text-neutral-500 shrink-0" size={18} />
          <div>
            <div className="text-xs text-neutral-500 font-medium">Interconnect Fabric</div>
            <div className="text-sm text-neutral-200 font-mono">{node.metadata?.network_fabric || "N/A"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-neutral-500 shrink-0" size={18} />
          <div>
            <div className="text-xs text-neutral-500 font-medium">GPU Inventory</div>
            <div className="text-sm text-neutral-200 font-mono">{node.gpus?.length}x {node.gpus?.[0]?.model?.replace(/_/g, " ")}</div>
          </div>
        </div>
      </div>

      {/* Correlated Stacked Time-Series Charts Layout */}
      <div className="flex flex-col space-y-6 flex-1">
        
        {/* Layer 1: Physical Hardware Telemetry */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-orange-400 font-medium text-sm">
            <Cpu size={16} />
            <span>Layer 1: Node Physical Thermals & Silicon Power</span>
          </div>
          <div className="h-44 w-full">
             <HardwareChart data={timeline} syncId="node-blast-radius" />
          </div>
        </div>

        {/* Layer 2: Compute Engine Inference Pipeline (vLLM) */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-purple-400 font-medium text-sm">
            <Activity size={16} />
            <span>Layer 2: Inference Pipeline Performance (vLLM Engine)</span>
          </div>
          <div className="h-44 w-full">
            <InferenceChart data={timeline} syncId="node-blast-radius" />
          </div>
        </div>

        {/* Layer 3: Interconnect Switch Networking Fabric (NCCL) */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-emerald-400 font-medium text-sm">
            <Network size={16} />
            <span>Layer 3: Interconnect Inter-GPU Switch Fabric (NCCL Bus)</span>
          </div>
          <div className="h-44 w-full">
            {/* We pass the onBrushChange handler ONLY to the bottom chart */}
            <NetworkChart 
              data={timeline} 
              syncId="node-blast-radius" 
              onBrushChange={handleBrushChange} 
            />
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* THE AI SLIDING DRAWER UI                     */}
      {/* ========================================== */}
      <div 
        className={`fixed inset-y-0 right-0 w-[450px] bg-neutral-900 border-l border-neutral-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
          isAiOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-medium text-neutral-100">AI Root Cause Analysis</h3>
              <p className="text-xs text-neutral-400">Powered by DeepSeek-R1 & Groq</p>
            </div>
          </div>
          <button onClick={() => setIsAiOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isAiLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-neutral-400">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm animate-pulse">DeepSeek is analyzing the telemetry slice...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-neutral-300 leading-relaxed">
                {aiResponse || "Highlight an anomaly on the timeline below and click 'Ask AI' to generate a report."}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
           <div className="text-xs text-neutral-500 text-center">
             Diagnostic window restricted to highlighted timeline bounds.
           </div>
        </div>
      </div>

    </div>
  );
}