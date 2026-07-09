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
 * Since we have 15 GPUs and 3 metric types, fetching the last ~50 rows 
 * gives us a complete picture of the cluster's current state.
 */
export async function fetchLatestClusterMetrics() {
  // We fetch 100 rows to safely grab the latest slice (15 GPUs * 3 metric types = 45 rows per tick)
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

  // Track GPUs to ensure we only count the absolute newest row per GPU
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
 * Fetches the last ~12 minutes of telemetry and groups it into 5-second buckets
 * to power the dual-axis global Recharts component.
 */
export async function fetchGlobalTimeSeries() {
  // 40,000 limit ensures we comfortably grab the entire 1-hour simulation
  const { data, error } = await supabase
    .from('telemetry')
    .select('metric_type, payload, timestamp')
    .in('metric_type', ['hardware', 'vllm'])
    .order('timestamp', { ascending: false })
    .limit(40000);

  if (error) {
    console.error("Error fetching time series:", error.message);
    return [];
  }

  const grouped = {};
  
  data.forEach(row => {
    // FIX: Time Bucketing
    // Round the timestamp down to the nearest 5 seconds to align the offset Python data
    const dateObj = new Date(row.timestamp);
    const coeff = 1000 * 5; 
    const roundedDate = new Date(Math.round(dateObj.getTime() / coeff) * coeff);
    
    // Use this perfectly aligned 5-second string as the new grouping key
    const bucketKey = roundedDate.toISOString();

    if (!grouped[bucketKey]) {
      grouped[bucketKey] = { 
        time: roundedDate.toLocaleTimeString([], { hour12: false }), 
        rawTemp: 0, 
        hwCount: 0, 
        tps: 0 
      };
    }

    if (row.metric_type === 'hardware' && row.payload.temperature_c) {
      grouped[bucketKey].rawTemp += row.payload.temperature_c;
      grouped[bucketKey].hwCount += 1;
    }
    
    if (row.metric_type === 'vllm' && typeof row.payload.tokens_per_second !== 'undefined') {
      grouped[bucketKey].tps += row.payload.tokens_per_second;
    }
  });

  const chartData = Object.values(grouped).map(g => ({
    time: g.time,
    // Calculate final averages per bucket
    avgTemp: g.hwCount > 0 ? Math.round(g.rawTemp / g.hwCount) : null,
    tps: g.tps > 0 ? Math.round(g.tps) : null
  }));

  return chartData.reverse();
}


/**
 * Fetches specific node configurations along with all its nested GPU telemetry,
 * grouping data points into unified 5-second synchronized buckets.
 */
export async function fetchNodeDetailsAndTelemetry(hostname) {
  // 1. Fetch Node info and join its associated GPUs
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

  // 2. Fetch the full historical telemetry array for this node's specific GPUs
  const { data: telemetryData, error: telemetryError } = await supabase
    .from('telemetry')
    .select('gpu_id, metric_type, payload, timestamp')
    .in('gpu_id', gpuIds)
    .order('timestamp', { ascending: false })
    .limit(30000); // High limit ensures full hour capture for all multi-GPU rows

  if (telemetryError) {
    console.error("Error fetching node telemetry:", telemetryError.message);
    return { node: nodeData, timeline: [] };
  }

  // 3. Process and bucket metrics by 5-second intervals
  const buckets = {};

  telemetryData.forEach(row => {
    const dateObj = new Date(row.timestamp);
    const coeff = 1000 * 5; 
    const roundedDate = new Date(Math.round(dateObj.getTime() / coeff) * coeff);
    const bucketKey = roundedDate.toISOString();

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        time: roundedDate.toLocaleTimeString([], { hour12: false }),
        // Hardware Aggregations
        tempSum: 0, tempCount: 0,
        powerSum: 0, utilSum: 0,
        // vLLM Aggregations
        tpsSum: 0, queueSum: 0, ttftSum: 0, vllmCount: 0,
        // NCCL Aggregations
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

  // 4. Map buckets into flat averages/sums readable by Recharts
  const timeline = Object.keys(buckets).map(key => {
    const b = buckets[key];
    const gCount = nodeData.gpus.length;

    return {
      time: b.time,
      // Hardware: average temperature, total combined system power draw and utilization
      temperature: b.tempCount > 0 ? Math.round(b.tempSum / b.tempCount) : null,
      powerDraw: b.tempCount > 0 ? Math.round(b.powerSum) : null,
      utilization: b.tempCount > 0 ? Math.round(b.utilSum / b.tempCount) : null,
      // vLLM: aggregate throughput, maximum queue buildup, average latency
      tps: b.vllmCount > 0 ? Math.round(b.tpsSum) : null,
      queue: b.vllmCount > 0 ? Math.round(b.queueSum / b.vllmCount) : null,
      latency: b.vllmCount > 0 ? Math.round(b.ttftSum / b.vllmCount) : null,
      // NCCL: aggregate bus bandwidth, network step delays, active warning flags
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