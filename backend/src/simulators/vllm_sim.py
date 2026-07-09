import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_vllm_metrics(gpus: list, nodes: list, minutes_to_simulate: int = 60, interval_seconds: int = 5) -> list:
    payload = []
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=minutes_to_simulate)
    
    fault_start = start_time + timedelta(minutes=(minutes_to_simulate / 2))
    fault_end = fault_start + timedelta(minutes=5)
    
    # Map node IDs to roles
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # 1. State Memory: Track the queue size for every GPU to simulate the linear drain
    gpu_states = {}
    inference_gpus = []
    
    for gpu in gpus:
        role = node_roles.get(gpu["node_id"], "general-development")
        gpu_states[gpu["id"]] = {"current_queue": 0}
        if "inference" in role:
            inference_gpus.append(gpu["id"])
            
    # The OOM crash should ideally hit a dedicated inference node serving live users
    unlucky_gpu_id = random.choice(inference_gpus) if inference_gpus else gpus[0]["id"]
    
    logger.info(f"Generating {minutes_to_simulate} mins of context-aware JSONB vLLM telemetry...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            metadata = gpu.get("metadata", {})
            max_vram_gb = metadata.get("vram_gb", 24) # Fallback to 24GB if missing
            
            current_queue = gpu_states[gpu_id]["current_queue"]
            
            # ==========================================
            # WORKLOAD PROFILING & OOM LOGIC
            # ==========================================
            if fault_active and gpu_id == unlucky_gpu_id:
                # OOM CRASH: VRAM allocation exceeds physical limits
                vram_usage = max_vram_gb + random.uniform(0.1, 2.5) # The fatal overshoot
                cache_usage = 100.0
                tps = 0.0 # Processing has halted
                
                # Queue backs up rapidly because users keep sending prompts
                current_queue += random.randint(5, 20)
                ttft_ms = 10000 # Max timeout limit for users waiting
                
            else:
                # HEALTHY OR RECOVERING STATE
                if current_queue > 5:
                    # RECOVERY STATE: The linear drain. 
                    # The system is back online and chewing through the backlog.
                    vram_usage = max_vram_gb * random.uniform(0.85, 0.95)
                    cache_usage = random.uniform(90.0, 98.0)
                    tps = random.uniform(140.0, 180.0) # Running at absolute maximum throughput
                    
                    # Drain the queue linearly (processing faster than new requests arrive)
                    drain_rate = random.randint(4, 12)
                    current_queue = max(0, current_queue - drain_rate)
                    
                    # Latency is still high, but dropping as the queue shortens
                    ttft_ms = 200 + (current_queue * 40)
                else:
                    # NORMAL STATE: Based on node role
                    if "inference" in role:
                        vram_usage = max_vram_gb * random.uniform(0.60, 0.85)
                        cache_usage = random.uniform(60.0, 85.0)
                        tps = random.uniform(80.0, 130.0)
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
                        # Dev sandbox: Occasional massive test prompt, otherwise idle
                        is_testing = random.random() < 0.10
                        if is_testing:
                            vram_usage = max_vram_gb * random.uniform(0.40, 0.90)
                            cache_usage = random.uniform(20.0, 60.0)
                            tps = random.uniform(50.0, 100.0)
                            current_queue = random.randint(0, 1)
                            ttft_ms = random.randint(200, 600)
                        else:
                            vram_usage = max_vram_gb * random.uniform(0.05, 0.15)
                            cache_usage = random.uniform(0.0, 5.0)
                            tps = 0.0
                            current_queue = 0
                            ttft_ms = 0
                            
            # Cap variables realistically
            vram_usage = round(vram_usage, 2)
            cache_usage = min(round(cache_usage, 2), 100.0)
            
            # Save the updated queue state for the next 5-second interval
            gpu_states[gpu_id]["current_queue"] = current_queue

            # JSONB payload insertion mapping to the unified telemetry table
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