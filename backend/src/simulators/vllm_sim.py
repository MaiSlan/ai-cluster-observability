import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_vllm_metrics(
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
    
    # Map node IDs to roles
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # State Memory: Track the queue size and dev test bursts
    gpu_states = {}
    for gpu in gpus:
        gpu_states[gpu["id"]] = {"current_queue": 0, "dev_testing_ticks": 0}
            
    logger.info(f"Generating {minutes_to_simulate} mins of vLLM telemetry (Chaos Anomaly at min {anomaly_minute})...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            metadata = gpu.get("metadata", {})
            max_vram_gb = metadata.get("vram_gb", 24)
            
            current_queue = gpu_states[gpu_id]["current_queue"]
            
            # ==========================================
            # WORKLOAD PROFILING & OOM LOGIC
            # ==========================================
            if fault_active and gpu_id in victim_gpu_ids:
                # CHAOS MODE: Hardware is melting, TPS collapses to 0, queue backs up.
                vram_usage = max_vram_gb * random.uniform(0.95, 1.05) 
                cache_usage = 100.0
                tps = 0.0 # Compute halted due to thermal throttling / OOM
                
                current_queue += random.randint(5, 20)
                ttft_ms = 10000 
                
            else:
                # HEALTHY OR RECOVERING STATE
                if current_queue > 5:
                    # RECOVERY STATE: The linear drain.
                    vram_usage = max_vram_gb * random.uniform(0.85, 0.95)
                    cache_usage = random.uniform(90.0, 98.0)
                    tps = random.uniform(140.0, 180.0) 
                    
                    drain_rate = random.randint(4, 12)
                    current_queue = max(0, current_queue - drain_rate)
                    ttft_ms = 200 + (current_queue * 40)
                else:
                    # NORMAL STATE: Based on node role
                    if "inference" in role:
                        vram_usage = max_vram_gb * random.uniform(0.60, 0.85)
                        cache_usage = random.uniform(60.0, 85.0)
                        tps = random.uniform(80.0, 130.0) # Sustained High TPS
                        current_queue = random.randint(0, 3)
                        ttft_ms = random.randint(150, 350)
                    elif "training" in role:
                        # Training nodes don't serve vLLM traffic. Numbers stay near zero.
                        vram_usage = max_vram_gb * random.uniform(0.01, 0.05)
                        cache_usage = 0.0
                        tps = random.uniform(0.0, 2.0)
                        current_queue = 0
                        ttft_ms = 0
                    else:
                        # Dev sandbox: Aligning the 3% spike chance with the hardware sim
                        state = gpu_states[gpu_id]
                        if state.get("dev_testing_ticks", 0) > 0:
                            state["dev_testing_ticks"] -= 1
                            vram_usage = max_vram_gb * random.uniform(0.60, 0.90)
                            cache_usage = random.uniform(40.0, 70.0)
                            tps = random.uniform(50.0, 100.0)
                            current_queue = random.randint(0, 2)
                            ttft_ms = random.randint(200, 600)
                        else:
                            if random.random() < 0.03: 
                                state["dev_testing_ticks"] = random.randint(6, 24)
                                vram_usage = max_vram_gb * random.uniform(0.60, 0.90)
                                cache_usage = random.uniform(40.0, 70.0)
                                tps = random.uniform(50.0, 100.0)
                                current_queue = random.randint(0, 1)
                                ttft_ms = random.randint(200, 600)
                            else:
                                vram_usage = max_vram_gb * random.uniform(0.05, 0.15)
                                cache_usage = random.uniform(0.0, 5.0)
                                tps = 0.0
                                current_queue = 0
                                ttft_ms = 0
                            
            vram_usage = round(vram_usage, 2)
            cache_usage = min(round(cache_usage, 2), 100.0)
            
            gpu_states[gpu_id]["current_queue"] = current_queue

            payload.append({
                "gpu_id": gpu_id,
                "timestamp": current_time.isoformat(),
                "metric_type": "vllm",
                "payload": {
                    "vram_usage_gb": vram_usage,
                    "cache_usage_perc": cache_usage,
                    "tokens_per_second": round(tps, 2),
                    "requests_waiting": current_queue,
                    "time_to_first_token_ms": int(ttft_ms)
                }
            })
        
        current_time += timedelta(seconds=interval_seconds)
        
    return payload