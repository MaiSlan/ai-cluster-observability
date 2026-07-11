import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_nccl_metrics(
    gpus: list, 
    nodes: list, 
    minutes_to_simulate: int = 60, 
    interval_seconds: int = 5,
    anomaly_node_id: str = None,
    anomaly_minute: int = None
) -> list:
    
    payload = []
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=minutes_to_simulate)
    
    # NEW: Chaos Coordinator Window
    if anomaly_minute is not None:
        fault_start = start_time + timedelta(minutes=anomaly_minute)
        fault_end = fault_start + timedelta(minutes=5)
    else:
        fault_start = end_time + timedelta(days=1)
        fault_end = fault_start
        
    victim_gpu_ids = [g["id"] for g in gpus if g["node_id"] == anomaly_node_id] if anomaly_node_id else []
    
    # Map node IDs to roles to determine network baselines
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # State Memory: Track Dev test bursts so network spikes perfectly align with hardware/vllm
    gpu_states = {}
    for gpu in gpus:
        gpu_states[gpu["id"]] = {"dev_testing_ticks": 0}
    
    logger.info(f"Generating {minutes_to_simulate} mins of NCCL telemetry (Chaos Anomaly at min {anomaly_minute})...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            
            if fault_active and gpu_id in victim_gpu_ids:
                # ==========================================
                # CASCADING FAILURE (NETWORK COLLAPSE)
                # ==========================================
                # The GPU is thermally throttling and vLLM has halted. 
                # Network communication grinds to a halt. Latency spikes massively.
                bus_bandwidth = random.uniform(0.1, 2.0) 
                exec_time_us = random.randint(40000, 80000) # Massive latency delay (40-80ms)
                straggler = True

            else:
                # ==========================================
                # HEALTHY STATE PROFILING
                # ==========================================
                if "training" in role:
                    # Multi-GPU AllReduce operations require massive, constant bandwidth
                    bus_bandwidth = random.uniform(250.0, 400.0)
                    exec_time_us = random.randint(500, 1500)
                    straggler = True if random.random() > 0.99 else False
                    
                elif "inference" in role:
                    # Tensor parallelism splits models, requiring moderate/spiky communication
                    bus_bandwidth = random.uniform(50.0, 150.0)
                    exec_time_us = random.randint(2000, 5000)
                    straggler = True if random.random() > 0.98 else False
                    
                else:
                    # Dev Sandbox: Synchronizing the exact 3% run chance with hardware & vLLM
                    state = gpu_states[gpu_id]
                    if state.get("dev_testing_ticks", 0) > 0:
                        state["dev_testing_ticks"] -= 1
                        bus_bandwidth = random.uniform(20.0, 80.0)
                        exec_time_us = random.randint(5000, 10000)
                        straggler = True if random.random() > 0.95 else False
                    else:
                        if random.random() < 0.03:
                            state["dev_testing_ticks"] = random.randint(6, 24)
                            bus_bandwidth = random.uniform(20.0, 80.0)
                            exec_time_us = random.randint(5000, 10000)
                            straggler = True if random.random() > 0.95 else False
                        else:
                            bus_bandwidth = random.uniform(0.0, 5.0)
                            exec_time_us = random.randint(100, 500)
                            straggler = False

            # JSONB payload insertion mapping to the unified telemetry table
            payload.append({
                "gpu_id": gpu_id,
                "timestamp": current_time.isoformat(),
                "metric_type": "nccl",
                "payload": {
                    "bus_bandwidth_gbps": round(bus_bandwidth, 2),
                    "execution_time_us": int(exec_time_us),
                    "straggler_detected": straggler
                }
            })
        
        current_time += timedelta(seconds=interval_seconds)
        
    return payload