import { supabase } from './supabase';

/**
 * Fetches all active compute nodes to populate our infrastructure KPI.
 */
export async function fetchActiveNodes() {
  const { data, error } = await supabase
    .from('nodes')
    .select('id, hostname, status, metadata');

  if (error) {
    console.error("Error fetching nodes:", error.message);
    return [];
  }
  return data;
}

/**
 * Fetches the most recent telemetry slice across all GPUs.
 */
export async function fetchLatestClusterMetrics() {
  const { data, error } = await supabase
    .from('telemetry')
    .select('gpu_id, metric_type, payload, timestamp')
    .order('timestamp', { ascending: false })
    .limit(100); 

  if (error) {
    console.error("Error fetching latest telemetry:", error.message);
    return { avgTemp: 0, aggregateTps: 0 };
  }

  let totalTemp = 0;
  let hardwareCount = 0;
  let aggregateTps = 0;

  const seenHwGpus = new Set();
  const seenVllmGpus = new Set();

  data.forEach((row) => {
    if (row.metric_type === 'hardware' && row.payload.temperature_c) {
      if (!seenHwGpus.has(row.gpu_id)) {
        totalTemp += row.payload.temperature_c;
        hardwareCount++;
        seenHwGpus.add(row.gpu_id);
      }
    }
    
    if (row.metric_type === 'vllm' && typeof row.payload.tokens_per_second !== 'undefined') {
      if (!seenVllmGpus.has(row.gpu_id)) {
        aggregateTps += row.payload.tokens_per_second;
        seenVllmGpus.add(row.gpu_id);
      }
    }
  });

  const avgTemp = hardwareCount > 0 ? Math.round(totalTemp / hardwareCount) : 0;

  return { 
    avgTemp, 
    aggregateTps: Math.round(aggregateTps) 
  };
}

/**
 * Fetches the last ~60 minutes of telemetry and groups it into 5-second buckets.
 * Separates data into "Heavy" (Training/High-Throughput) and "Dev" categories to prevent noise.
 */
export async function fetchGlobalTimeSeries() {
  // 1. Build the Node/GPU Category Mapping
  const { data: nodesData, error: nodesError } = await supabase
    .from('nodes')
    .select('hostname, gpus(id)');

  if (nodesError) {
    console.error("Error fetching nodes for global series:", nodesError.message);
    return [];
  }

  const heavyNodes = ["hgx-trn-001", "inf-prd-002"];
  const gpuCategoryMap = {};

  nodesData.forEach(node => {
    const category = heavyNodes.includes(node.hostname) ? "Heavy" : "Dev";
    node.gpus.forEach(gpu => {
      gpuCategoryMap[gpu.id] = category;
    });
  });

  // 2. Fetch the raw telemetry (increased limit to capture the new NCCL metrics)
  const { data, error } = await supabase
    .from('telemetry')
    .select('gpu_id, metric_type, payload, timestamp')
    .in('metric_type', ['hardware', 'vllm', 'nccl'])
    .order('timestamp', { ascending: false })
    .limit(60000);

  if (error) {
    console.error("Error fetching time series:", error.message);
    return [];
  }

  const grouped = {};
  
  // 3. Map into 5-second buckets by category
  data.forEach(row => {
    const category = gpuCategoryMap[row.gpu_id] || "Dev"; 
    const dateObj = new Date(row.timestamp);
    const coeff = 1000 * 5; 
    const roundedDate = new Date(Math.round(dateObj.getTime() / coeff) * coeff);
    const bucketKey = roundedDate.toISOString();

    if (!grouped[bucketKey]) {
      grouped[bucketKey] = { 
        time: roundedDate.toLocaleTimeString([], { hour12: false }), 
        heavyTempSum: 0, heavyTempCount: 0,
        devTempSum: 0, devTempCount: 0,
        heavyTpsSum: 0, heavyVllmCount: 0,
        devTpsSum: 0, devVllmCount: 0,
        heavyBandwidthSum: 0, heavyNcclCount: 0,
        devBandwidthSum: 0, devNcclCount: 0
      };
    }

    const b = grouped[bucketKey];
    const p = row.payload;

    // Route the metrics to the correct category accumulator
    if (category === "Heavy") {
      if (row.metric_type === 'hardware' && typeof p.temperature_c !== 'undefined') { b.heavyTempSum += p.temperature_c; b.heavyTempCount++; }
      if (row.metric_type === 'vllm' && typeof p.tokens_per_second !== 'undefined') { b.heavyTpsSum += p.tokens_per_second; b.heavyVllmCount++; }
      if (row.metric_type === 'nccl' && typeof p.bus_bandwidth_gbps !== 'undefined') { b.heavyBandwidthSum += p.bus_bandwidth_gbps; b.heavyNcclCount++; }
    } else {
      if (row.metric_type === 'hardware' && typeof p.temperature_c !== 'undefined') { b.devTempSum += p.temperature_c; b.devTempCount++; }
      if (row.metric_type === 'vllm' && typeof p.tokens_per_second !== 'undefined') { b.devTpsSum += p.tokens_per_second; b.devVllmCount++; }
      if (row.metric_type === 'nccl' && typeof p.bus_bandwidth_gbps !== 'undefined') { b.devBandwidthSum += p.bus_bandwidth_gbps; b.devNcclCount++; }
    }
  });

  // 4. Calculate Final Averages & Aggregates
  const chartData = Object.values(grouped).map(g => ({
    time: g.time,
    // Hardware: Average temperatures
    heavyTemp: g.heavyTempCount > 0 ? Math.round(g.heavyTempSum / g.heavyTempCount) : null,
    devTemp: g.devTempCount > 0 ? Math.round(g.devTempSum / g.devTempCount) : null,
    // vLLM: Aggregated TPS
    heavyTps: g.heavyVllmCount > 0 ? Math.round(g.heavyTpsSum) : null,
    devTps: g.devVllmCount > 0 ? Math.round(g.devTpsSum) : null,
    // NCCL: Aggregated Bandwidth
    heavyBandwidth: g.heavyNcclCount > 0 ? Math.round(g.heavyBandwidthSum) : null,
    devBandwidth: g.devNcclCount > 0 ? Math.round(g.devBandwidthSum) : null
  }));

  return chartData.reverse();
}

/**
 * Fetches specific node configurations along with all its nested GPU telemetry.
 */
export async function fetchNodeDetailsAndTelemetry(hostname) {
  const { data: nodeData, error: nodeError } = await supabase
    .from('nodes')
    .select('id, hostname, metadata, gpus(id, model, pci_bus_id, metadata)')
    .eq('hostname', hostname)
    .single();

  if (nodeError || !nodeData) {
    console.error("Error fetching node infrastructure:", nodeError?.message);
    return null;
  }

  const gpuIds = nodeData.gpus.map(g => g.id);
  if (gpuIds.length === 0) {
    return { node: nodeData, timeline: [] };
  }

  const { data: telemetryData, error: telemetryError } = await supabase
    .from('telemetry')
    .select('gpu_id, metric_type, payload, timestamp')
    .in('gpu_id', gpuIds)
    .order('timestamp', { ascending: false })
    .limit(30000); 

  if (telemetryError) {
    console.error("Error fetching node telemetry:", telemetryError.message);
    return { node: nodeData, timeline: [] };
  }

  const buckets = {};

  telemetryData.forEach(row => {
    const dateObj = new Date(row.timestamp);
    const coeff = 1000 * 5; 
    const roundedDate = new Date(Math.round(dateObj.getTime() / coeff) * coeff);
    const bucketKey = roundedDate.toISOString();

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        time: roundedDate.toLocaleTimeString([], { hour12: false }),
        tempSum: 0, tempCount: 0,
        powerSum: 0, utilSum: 0,
        tpsSum: 0, queueSum: 0, ttftSum: 0, vllmCount: 0,
        bandwidthSum: 0, execTimeSum: 0, ncclCount: 0, stragglerCount: 0
      };
    }

    const b = buckets[bucketKey];
    const p = row.payload;

    if (row.metric_type === 'hardware') {
      if (typeof p.temperature_c !== 'undefined') { b.tempSum += p.temperature_c; b.tempCount++; }
      if (typeof p.power_draw_w !== 'undefined') b.powerSum += p.power_draw_w;
      if (typeof p.utilization_perc !== 'undefined') b.utilSum += p.utilization_perc;
    } 
    else if (row.metric_type === 'vllm') {
      if (typeof p.tokens_per_second !== 'undefined') { b.tpsSum += p.tokens_per_second; b.vllmCount++; }
      if (typeof p.requests_waiting !== 'undefined') b.queueSum += p.requests_waiting;
      if (typeof p.time_to_first_token_ms !== 'undefined') b.ttftSum += p.time_to_first_token_ms;
    } 
    else if (row.metric_type === 'nccl') {
      if (typeof p.bus_bandwidth_gbps !== 'undefined') { b.bandwidthSum += p.bus_bandwidth_gbps; b.ncclCount++; }
      if (typeof p.execution_time_us !== 'undefined') b.execTimeSum += p.execution_time_us;
      if (p.straggler_detected) b.stragglerCount++;
    }
  });

  const timeline = Object.keys(buckets).map(key => {
    const b = buckets[key];
    return {
      time: b.time,
      temperature: b.tempCount > 0 ? Math.round(b.tempSum / b.tempCount) : null,
      powerDraw: b.tempCount > 0 ? Math.round(b.powerSum) : null,
      utilization: b.tempCount > 0 ? Math.round(b.utilSum / b.tempCount) : null,
      tps: b.vllmCount > 0 ? Math.round(b.tpsSum) : null,
      queue: b.vllmCount > 0 ? Math.round(b.queueSum / b.vllmCount) : null,
      latency: b.vllmCount > 0 ? Math.round(b.ttftSum / b.vllmCount) : null,
      bandwidth: b.ncclCount > 0 ? Math.round(b.bandwidthSum) : null,
      networkDelay: b.ncclCount > 0 ? Math.round(b.execTimeSum / b.ncclCount) : null,
      stragglers: b.stragglerCount
    };
  });

  return {
    node: nodeData,
    timeline: timeline.reverse()
  };
}

// ==========================================
// NEW: SIMULATION ORCHESTRATION LAYER
// ==========================================

/**
 * Triggers the FastAPI backend to purge old data and generate a new 32k row simulation.
 */
export async function triggerSimulation() {
  try {
    // Falls back to localhost if the environment variable isn't set yet
    const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${baseUrl}/api/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("Failed to trigger backend simulation:", error);
    return false;
  }
}

/**
 * Fetches only the raw count of telemetry rows. 
 * Used for lightweight polling to detect when the backend completes the bulk ingestion.
 */
export async function getTelemetryRowCount() {
  const { count, error } = await supabase
    .from('telemetry')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error("Error checking telemetry count:", error.message);
    return 0;
  }
  
  return count || 0;
}

// ==========================================
// NEW: AIOPS DIAGNOSTIC ENGINE (GROQ)
// ==========================================

/**
 * Tier 1: The Global Investigator
 * Slices the dimensional data down to the highlighted window
 * focusing specifically on the Heavy Workload metrics where failures matter most.
 */
export function extractGlobalContext(chartData, startIndex, endIndex) {
  const slice = chartData.slice(startIndex, endIndex + 1);
  if (!slice || slice.length === 0) return null;

  let maxHeavyTemp = 0;
  let minHeavyTps = Infinity;
  let minHeavyBw = Infinity;
  let sumHeavyTps = 0;

  slice.forEach(d => {
    if (d.heavyTemp > maxHeavyTemp) maxHeavyTemp = d.heavyTemp;
    if (d.heavyTps !== null && d.heavyTps < minHeavyTps) minHeavyTps = d.heavyTps;
    if (d.heavyTps !== null) sumHeavyTps += d.heavyTps;
    if (d.heavyBandwidth !== null && d.heavyBandwidth < minHeavyBw) minHeavyBw = d.heavyBandwidth;
  });

  const avgHeavyTps = Math.round(sumHeavyTps / slice.length);

  return {
    context: "Global Cluster Anomaly Search - Dimensional Split",
    window: `${slice[0].time} to ${slice[slice.length - 1].time}`,
    metrics: {
      peak_heavy_workload_temp_c: maxHeavyTemp,
      lowest_heavy_tps_recorded: minHeavyTps === Infinity ? 0 : minHeavyTps,
      average_heavy_tps_in_window: avgHeavyTps,
      lowest_heavy_bandwidth_gbps: minHeavyBw === Infinity ? 0 : minHeavyBw
    }
  };
}

/**
 * Tier 2: The Local Diagnostician
 * Slices the specific Node's timeline down to the highlighted window
 * and counts exact hardware limits and network stragglers.
 */
export function extractLocalContext(nodeData, timelineData, startIndex, endIndex) {
  const slice = timelineData.slice(startIndex, endIndex + 1);
  if (!slice || slice.length === 0) return null;

  let maxTemp = 0;
  let peakPower = 0;
  let totalStragglers = 0;
  let maxQueue = 0;

  slice.forEach(d => {
    if (d.temperature > maxTemp) maxTemp = d.temperature;
    if (d.powerDraw > peakPower) peakPower = d.powerDraw;
    if (d.stragglers) totalStragglers += d.stragglers;
    if (d.queue > maxQueue) maxQueue = d.queue;
  });

  return {
    context: "Specific Node Root Cause Analysis",
    hostname: nodeData.hostname,
    gpu_count: nodeData.gpus.length,
    window: `${slice[0].time} to ${slice[slice.length - 1].time}`,
    telemetry_summary: {
      peak_temperature_c: maxTemp,
      peak_power_draw_w: peakPower,
      total_network_stragglers: totalStragglers,
      max_vllm_queue_depth: maxQueue
    }
  };
}

/**
 * The HTTP Bridge to the Render FastAPI backend.
 * Sends the targeted JSON payload and the tier type to Groq.
 */
export async function askAIAssistant(payload, tier) {
  try {
    const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${baseUrl}/api/diagnose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tier: tier, // Will be either 'investigator' or 'diagnostician'
        payload: payload
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.diagnosis;
  } catch (error) {
    console.error("AI Assistant API Error:", error);
    return "Error: Unable to reach the AI Diagnostic engine. Please check backend connection.";
  }
}