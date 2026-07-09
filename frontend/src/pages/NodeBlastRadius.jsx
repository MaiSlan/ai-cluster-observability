import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Cpu, Activity, Network, ShieldAlert, Server } from "lucide-react";
import { fetchNodeDetailsAndTelemetry } from "../lib/api";

// NEW Imports for the modular charts
import HardwareChart from "../components/charts/HardwareChart";
import InferenceChart from "../components/charts/InferenceChart";
import NetworkChart from "../components/charts/NetworkChart";

export default function NodeBlastRadius() {
  const { hostname } = useParams();
  const [node, setNode] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetchNodeDetailsAndTelemetry(hostname);
        if (result) {
          setNode(result.node);
          setTimeline(result.timeline);
        }
      } catch (err) {
        console.error("Failed to load timeline metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [hostname]);

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
    <div className="p-8 flex flex-col space-y-6 h-full overflow-y-auto">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4">
          <Link to="/nodes" className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{node.hostname}</h1>
            <p className="text-sm text-neutral-400 capitalize">{node.metadata?.role?.replace("-", " ")} Instance</p>
          </div>
        </div>
        <div className="text-xs font-mono text-neutral-500 bg-neutral-900 px-3 py-1.5 border border-neutral-800 rounded-md">
          ID: {node.id}
        </div>
      </div>

      {/* Node Hardware Specifications Metadata Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4">
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
      <div className="flex flex-col space-y-6">
        
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
            <NetworkChart data={timeline} syncId="node-blast-radius" />
          </div>
        </div>

      </div>
    </div>
  );
}