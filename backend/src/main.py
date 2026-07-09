import logging
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Your existing imports remain completely unchanged
from db.client import supabase_client
from db.ingestion import seed_infrastructure, chunked_insert, purge_old_telemetry
from simulators.hardware_sim import generate_historical_hardware_metrics
from simulators.vllm_sim import generate_historical_vllm_metrics
from simulators.nccl_sim import generate_historical_nccl_metrics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)

# 1. Initialize the FastAPI App
app = FastAPI(title="AI Cluster Observability API")

# 2. Configure CORS so Vercel can talk to Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Your original main() function, renamed to run_simulation()
def run_simulation():
    logger.info("Booting AI Cluster Observability Backend (JSONB Pipeline)...")
    
    # 1. Seed Infrastructure
    seed_infrastructure()
    
    # 2. Fetch Infrastructure Context
    logger.info("Fetching infrastructure context...")
    gpus = supabase_client.table("gpus").select("id, node_id, metadata").execute().data
    nodes = supabase_client.table("nodes").select("id, metadata").execute().data
    
    if not gpus or not nodes:
        logger.error("Missing infrastructure in database. Exiting.")
        return

    # 3. Purge Old Data
    purge_old_telemetry()

    # 4. Generate Telemetry
    logger.info(f"Generating rich JSONB telemetry for {len(gpus)} GPUs...")
    hw_metrics = generate_historical_hardware_metrics(gpus, nodes, minutes_to_simulate=60, interval_seconds=5)
    vllm_metrics = generate_historical_vllm_metrics(gpus, nodes, minutes_to_simulate=60, interval_seconds=5)
    nccl_metrics = generate_historical_nccl_metrics(gpus, nodes, minutes_to_simulate=60, interval_seconds=5)
    
    # 5. Execute Ingestion
    unified_telemetry = hw_metrics + vllm_metrics + nccl_metrics
    logger.info(f"--- Starting Bulk Ingestion of {len(unified_telemetry)} records ---")
    chunked_insert("telemetry", unified_telemetry)
    
    logger.info("Backfill complete. Unified Time-Series DB populated cleanly.")

# 4. Create the Web Endpoint
@app.post("/api/simulate")
async def trigger_simulation(background_tasks: BackgroundTasks):
    # This fires your generation script without making the frontend wait for 32,000 rows to insert
    background_tasks.add_task(run_simulation)
    return {
        "status": "success", 
        "message": "Simulation started. Telemetry generation in progress in the background."
    }

# 5. Local Server Execution
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)