import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_nccl_metrics(gpus: list, nodes: list, minutes_to_simulate: int = 60, interval_seconds: int = 5) -> list:
    payload = []
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=minutes_to_simulate)
    
    fault_start = start_time + timedelta(minutes=(minutes_to_simulate / 2))
    fault_end = fault_start + timedelta(minutes=5)
    
    # Map node IDs to roles to determine network baselines
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # NCCL (NVIDIA Collective Communications Library) is most critical during heavy training.
    # We will specifically target a training GPU for the Noisy Neighbor fault.
    training_gpus = [gpu["id"] for gpu in gpus if "training" in node_roles.get(gpu["node_id"], "")]
    unlucky_gpu_id = random.choice(training_gpus) if training_gpus else gpus[0]["id"]
    
    logger.info(f"Generating {minutes_to_simulate} mins of context-aware JSONB NCCL telemetry...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            
            if fault_active and gpu_id == unlucky_gpu_id:
                # ==========================================
                # THE "NOISY NEIGHBOR" FAULT
                # ==========================================
                # Another rogue process is saturating the PCIe switch or InfiniBand fabric.
                # Bandwidth is choked to a trickle, and execution time skyrockets.
                bus_bandwidth = random.uniform(5.0, 15.0) 
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
                elif "inference" in role:
                    # Tensor parallelism splits models, requiring moderate/spiky communication
                    bus_bandwidth = random.uniform(50.0, 150.0)
                    exec_time_us = random.randint(2000, 5000)
                else:
                    # Dev Sandbox: Occasional spikes if running local tests, mostly quiet
                    is_testing = random.random() < 0.10
                    if is_testing:
                        bus_bandwidth = random.uniform(20.0, 80.0)
                        exec_time_us = random.randint(5000, 10000)
                    else:
                        bus_bandwidth = random.uniform(0.0, 5.0)
                        exec_time_us = random.randint(100, 500)

                # Minor network jitter occasionally causes a micro-second false positive straggler
                straggler = True if random.random() > 0.99 else False

            # Notice there is no "State Memory" or decay curve here. 
            # Once the fault_active boolean flips to False, the network instantly recovers.

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