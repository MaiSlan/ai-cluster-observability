import random
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def generate_historical_hardware_metrics(
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
        fault_end = fault_start + timedelta(minutes=5) # 5-minute cascading failure
    else:
        # Failsafe if run independently
        fault_start = end_time + timedelta(days=1) 
        fault_end = fault_start
        
    victim_gpu_ids = [g["id"] for g in gpus if g["node_id"] == anomaly_node_id] if anomaly_node_id else []

    # Map node IDs to their roles
    node_roles = {node["id"]: node.get("metadata", {}).get("role", "general-development") for node in nodes}
    
    # Initialize state memory for smooth thermal curves and bursty dev workloads
    gpu_states = {}
    for gpu in gpus:
        role = node_roles.get(gpu["node_id"], "general-development")
        if "training" in role or "inference" in role:
            start_temp = 42.0 # Lowered base temp for heavy nodes
        else:
            start_temp = 30.0 # Cool idle dev temp
            
        gpu_states[gpu["id"]] = {
            "current_temp": start_temp,
            "dev_testing_ticks": 0 # Memory for erratic dev spikes
        }
    
    logger.info(f"Generating {minutes_to_simulate} mins of hardware telemetry (Chaos Anomaly at min {anomaly_minute})...")
    
    current_time = start_time
    while current_time <= end_time:
        fault_active = fault_start <= current_time <= fault_end

        for gpu in gpus:
            gpu_id = gpu["id"]
            role = node_roles.get(gpu["node_id"], "general-development")
            metadata = gpu.get("metadata", {})
            max_tdp = metadata.get("max_tdp_w", 400) 
            
            ecc_corr = 0
            ecc_uncorr = 0
            
            # ==========================================
            # WORKLOAD PROFILING & THERMAL PHYSICS
            # ==========================================
            if fault_active and gpu_id in victim_gpu_ids:
                # CHAOS MODE: Total cooling failure + Thermal Runaway
                utilization = 100
                power_draw = max_tdp * random.uniform(0.98, 1.05) 
                target_temp = 105.0 # Violent spike
                cooling_factor = 0.15 # Fast overheat
                ecc_corr = random.randint(50, 500)
                ecc_uncorr = random.randint(0, 2) 

            elif "training" in role or "inference" in role:
                # HEAVY MODE: Lower base, sustained waves
                utilization = random.randint(70, 95)
                power_draw = (utilization / 100.0) * max_tdp * random.uniform(0.95, 1.0)
                target_temp = 42.0 + ((power_draw / max_tdp) * 35.0) # Normal peak around ~75C
                cooling_factor = 0.05 # Massive heatsinks respond slowly (rolling waves)
                ecc_corr = 1 if random.random() > 0.98 else 0

            else:
                # DEV MODE: Low average, highly erratic sharp spikes
                state = gpu_states[gpu_id]
                if state["dev_testing_ticks"] > 0:
                    # Actively running a test script
                    state["dev_testing_ticks"] -= 1
                    utilization = random.randint(90, 100)
                else:
                    # Idle, wait for a dev to hit "Run" (3% chance per 5s tick)
                    if random.random() < 0.03:
                        state["dev_testing_ticks"] = random.randint(6, 24) # 30s to 120s burst
                        utilization = random.randint(90, 100)
                    else:
                        utilization = random.randint(0, 10)
                
                power_draw = (utilization / 100.0) * max_tdp * random.uniform(0.95, 1.0)
                target_temp = 30.0 + ((power_draw / max_tdp) * 55.0) # Sharp spikes up to ~85C
                cooling_factor = 0.25 # Smaller heatsinks heat/cool extremely fast (shark fins)

            # Apply Newton's Law of Cooling based on workload characteristics
            current_temp = gpu_states[gpu_id]["current_temp"]
            current_temp += (target_temp - current_temp) * cooling_factor
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