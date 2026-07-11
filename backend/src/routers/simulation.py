import logging
import random
from fastapi import APIRouter, BackgroundTasks

# Import existing database and simulation logic
from db.client import supabase_client
from db.ingestion import seed_infrastructure, chunked_insert, purge_old_telemetry
from simulators.hardware_sim import generate_historical_hardware_metrics
from simulators.vllm_sim import generate_historical_vllm_metrics
from simulators.nccl_sim import generate_historical_nccl_metrics

logger = logging.getLogger(__name__)

# Initialize the router for this specific domain
router = APIRouter()

def run_simulation():
    logger.info("Booting AI Cluster Observability Backend (JSONB Pipeline)...")
    
    # 1. Seed Infrastructure
    seed_infrastructure()
    
    # 2. Fetch Infrastructure Context
    logger.info("Fetching infrastructure context...")
    gpus = supabase_client.table("gpus").select("id, node_id, metadata").execute().data
    nodes = supabase_client.table("nodes").select("id, hostname, metadata").execute().data
    
    if not gpus or not nodes:
        logger.error("Missing infrastructure in database. Exiting.")
        return

    # 3. Purge Old Data
    purge_old_telemetry()

    # ---------------------------------------------------------
    # NEW: THE CHAOS COORDINATOR
    # ---------------------------------------------------------
    # Isolate Heavy Nodes (We want the big spikes to happen here)
    heavy_nodes = [n for n in nodes if n["hostname"] in ["hgx-trn-001", "inf-prd-002"]]
    victim_node = random.choice(heavy_nodes) if heavy_nodes else random.choice(nodes)
    
    # Pick a random minute for the failure to occur (between minute 10 and 50 to avoid boot/end)
    anomaly_minute = random.randint(10, 50)
    
    logger.info(f"🔥 CHAOS INJECTED: Target {victim_node['hostname']} will suffer a cascading failure at minute {anomaly_minute} 🔥")
    # ---------------------------------------------------------

    # 4. Generate Telemetry (Now passing the Chaos parameters)
    logger.info(f"Generating rich JSONB telemetry for {len(gpus)} GPUs...")
    
    hw_metrics = generate_historical_hardware_metrics(
        gpus, nodes, minutes_to_simulate=60, interval_seconds=5, 
        anomaly_node_id=victim_node['id'], anomaly_minute=anomaly_minute
    )
    
    vllm_metrics = generate_historical_vllm_metrics(
        gpus, nodes, minutes_to_simulate=60, interval_seconds=5, 
        anomaly_node_id=victim_node['id'], anomaly_minute=anomaly_minute
    )
    
    nccl_metrics = generate_historical_nccl_metrics(
        gpus, nodes, minutes_to_simulate=60, interval_seconds=5, 
        anomaly_node_id=victim_node['id'], anomaly_minute=anomaly_minute
    )
    
    # 5. Execute Ingestion
    unified_telemetry = hw_metrics + vllm_metrics + nccl_metrics
    logger.info(f"--- Starting Bulk Ingestion of {len(unified_telemetry)} records ---")
    chunked_insert("telemetry", unified_telemetry)
    
    logger.info("Backfill complete. Unified Time-Series DB populated cleanly.")

@router.post("/api/simulate")
async def trigger_simulation(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_simulation)
    return {
        "status": "success", 
        "message": "Simulation started. Telemetry generation in progress in the background."
    }