import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Server, ChevronRight, CheckCircle2, Cpu, Network } from "lucide-react";
import { fetchActiveNodes } from "../lib/api";

export default function NodeDirectory() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNodes() {
      try {
        const data = await fetchActiveNodes();
        // Sort alphabetically by hostname for a cleaner list
        const sortedData = data.sort((a, b) => a.hostname.localeCompare(b.hostname));
        setNodes(sortedData);
      } catch (error) {
        console.error("Failed to load nodes:", error);
      } finally {
        setLoading(false);
      }
    }
    loadNodes();
  }, []);

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Node Directory</h1>
        <p className="text-neutral-400">Manage and monitor individual cluster instances.</p>
      </div>

      <div className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
            <Server size={32} className="mb-3 animate-pulse opacity-50" />
            <p>Scanning infrastructure...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-sm font-medium text-neutral-400">
                  <th className="py-4 px-6 font-medium">Hostname</th>
                  <th className="py-4 px-6 font-medium">Status</th>
                  <th className="py-4 px-6 font-medium">Role</th>
                  <th className="py-4 px-6 font-medium">System Specs</th>
                  <th className="py-4 px-6 font-medium">Fabric</th>
                  <th className="py-4 px-6 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {nodes.map((node) => (
                  <tr 
                    key={node.id} 
                    className="hover:bg-neutral-800/20 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-800 rounded-lg text-neutral-300">
                          <Server size={16} />
                        </div>
                        <span className="font-medium text-neutral-200">{node.hostname}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 w-max px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={14} />
                        Online
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-neutral-300 capitalize">
                        {node.metadata?.role?.replace("-", " ") || "Unknown"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm text-neutral-400">
                        <Cpu size={14} className="opacity-70" />
                        {node.metadata?.system_ram_gb}GB RAM
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm text-neutral-400">
                        <Network size={14} className="opacity-70" />
                        {node.metadata?.network_fabric || "Standard"}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {/* React Router Link to the specific Blast Radius page */}
                      <Link 
                        to={`/nodes/${node.hostname}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors border border-transparent hover:border-neutral-600"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}