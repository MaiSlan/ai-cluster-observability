import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_hardware_metrics(gpus: list, nodes: list, minutes_to_simulate: int = 60, interval_seconds: int = 5) -> list:
    payload = []
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=minutes_to_simulate)
    
    fault_start = start_time + timedelta(minutes=(minutes_to_simulate / 2))
    fault_end = fault_start + timedelta(minutes=5)
    
    # Map node IDs to their roles so the GPU knows its environment
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # 1. State Memory: Initialize starting temps based on environment, not a hardcoded 40
    gpu_states = {}
    training_gpus = []
    
    for gpu in gpus:
        role = node_roles.get(gpu["node_id"], "general-development")
        if "training" in role:
            start_temp = 50.0  # Hotter ambient baseline in dense racks
            training_gpus.append(gpu["id"])
        elif "inference" in role:
            start_temp = 40.0
        else:
            start_temp = 32.0  # Cool office environment for dev towers
            
        gpu_states[gpu["id"]] = {"current_temp": start_temp}
    
    # Ensure the catastrophic fault happens to a heavy training node (where it hurts the most)
    unlucky_gpu_id = random.choice(training_gpus) if training_gpus else gpus[0]["id"]
    
    logger.info(f"Generating {minutes_to_simulate} mins of context-aware hardware telemetry...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            metadata = gpu.get("metadata", {})
            max_tdp = metadata.get("max_tdp_w", 300) 
            
            ecc_corr = 0
            ecc_uncorr = 0
            
            # ==========================================
            # WORKLOAD PROFILING
            # ==========================================
            if fault_active and gpu_id == unlucky_gpu_id:
                # Catastrophic failure logic (Thermal Runaway + Memory Degradation)
                utilization = random.randint(10, 100) 
                power_draw = max_tdp * random.uniform(0.95, 1.0) 
                idle_temp = 50.0
                max_heat_delta = 50.0 # Pushes target to 100C+
                ecc_corr = random.randint(50, 500)
                ecc_uncorr = random.randint(0, 2) 

            else:
                # Healthy behavior based on node role
                if "training" in role:
                    # Sustained heavy matrix multiplication
                    utilization = random.randint(90, 100)
                    idle_temp = 50.0
                    max_heat_delta = 40.0
                elif "inference" in role:
                    # Spiky based on prompt traffic
                    utilization = random.randint(40, 85)
                    idle_temp = 40.0
                    max_heat_delta = 35.0
                else:
                    # Development Towers: Mostly idle typing, occasional test runs
                    is_testing = random.random() < 0.15 # 15% chance they hit "Run"
                    utilization = random.randint(80, 100) if is_testing else random.randint(0, 10)
                    idle_temp = 32.0
                    max_heat_delta = 30.0

                power_draw = (utilization / 100.0) * max_tdp * random.uniform(0.95, 1.0)
                # Ambient cosmic rays
                ecc_corr = 1 if random.random() > 0.98 else 0

            # Calculate where the temperature *wants* to go
            target_temp = idle_temp + ((power_draw / max_tdp) * max_heat_delta)
            
            # Apply Newton's Law of Cooling (10% step towards target)
            current_temp = gpu_states[gpu_id]["current_temp"]
            current_temp += (target_temp - current_temp) * 0.1 
            gpu_states[gpu_id]["current_temp"] = current_temp

            payload.append({
                "gpu_id": gpu_id,
                "timestamp": current_time.isoformat(),
                "metric_type": "hardware",
                "payload": {
                    "temperature_c": int(current_temp),
                    "power_draw_w": round(power_draw, 2),
                    "utilization_perc": utilization,
                    "ecc_correctable": ecc_corr,
                    "ecc_uncorrectable": ecc_uncorr
                }
            })
        
        current_time += timedelta(seconds=interval_seconds)
        
    return payload