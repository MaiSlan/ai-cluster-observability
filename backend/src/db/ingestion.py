from .client import supabase_client
import logging
import json
import os
import random
from typing import List

logger = logging.getLogger(__name__)

def load_hardware_catalog() -> dict:
    """Loads the detailed enterprise hardware catalog."""
    current_dir = os.path.dirname(__file__)
    catalog_path = os.path.abspath(os.path.join(current_dir, '..', 'core', 'hardware_catalog.json'))
    
    with open(catalog_path, 'r') as f:
        return json.load(f)

def validate_catalog(catalog: dict):
    """
    PRE-FLIGHT CHECK:
    Validates the integrity of the JSON catalog before any database operations occur.
    Prevents partial database commits caused by missing keys.
    """
    logger.info("Running Pre-Flight validation on hardware catalog...")
    
    # 1. Validate Datacenters
    if not catalog.get("datacenters"):
        raise ValueError("Catalog is missing 'datacenters' array.")
    
    # 2. Validate Clusters
    if not catalog.get("clusters"):
        raise ValueError("Catalog is missing 'clusters' array.")
        
    # 3. Validate SKUs and their targets
    for sku in catalog.get("node_skus", []):
        sku_id = sku.get("sku_id", "Unknown SKU")
        
        # Check for the exact key that caused the previous crash
        if "target_cluster" not in sku:
            raise KeyError(f"Pre-Flight Failed: SKU '{sku_id}' is missing the 'target_cluster' key.")
            
        # Verify the target cluster actually exists in the defined clusters list
        valid_cluster_names = [c["name"] for c in catalog["clusters"]]
        if sku["target_cluster"] not in valid_cluster_names:
            raise ValueError(f"Pre-Flight Failed: SKU '{sku_id}' points to unknown cluster '{sku['target_cluster']}'.")
            
        if not sku.get("allowed_gpus"):
            raise ValueError(f"Pre-Flight Failed: SKU '{sku_id}' has no allowed GPUs.")
            
    logger.info("Pre-Flight validation passed. Catalog is structurally sound.")

def seed_infrastructure() -> List[str]:
    """Provisions a realistic, heterogeneous AI infrastructure."""
    logger.info("Checking infrastructure state...")
    
    catalog = load_hardware_catalog()
    
    # Run the strict validation before touching Supabase
    validate_catalog(catalog)
    
    # 1. Provision Datacenters
    datacenter_map = {} 
    for dc in catalog["datacenters"]:
        res = supabase_client.table("datacenters").select("id").eq("region", dc["region"]).execute()
        if not res.data:
            logger.info(f"Provisioning Datacenter: {dc['region']}")
            res = supabase_client.table("datacenters").insert(dc).execute()
            datacenter_map[dc["region"]] = res.data[0]["id"]
        else:
            datacenter_map[dc["region"]] = res.data[0]["id"]

    # 2. Provision Clusters
    cluster_map = {} 
    for cluster in catalog["clusters"]:
        res = supabase_client.table("clusters").select("id").eq("name", cluster["name"]).execute()
        if not res.data:
            logger.info(f"Creating Cluster: {cluster['name']}")
            res = supabase_client.table("clusters").insert({"name": cluster["name"]}).execute()
            cluster_map[cluster["name"]] = res.data[0]["id"]
        else:
            cluster_map[cluster["name"]] = res.data[0]["id"]

    # 3. Provision Nodes
    nodes_check = supabase_client.table("nodes").select("id").limit(1).execute()
    
    nodes_data = []
    if not nodes_check.data:
        logger.info("Provisioning compute nodes across clusters and datacenters...")
        new_nodes = []
        
        for i, sku in enumerate(catalog["node_skus"], start=1):
            dc_region = random.choice(catalog["datacenters"])["region"]
            dc_id = datacenter_map[dc_region]
            
            target_cluster_id = cluster_map[sku["target_cluster"]]
            hostname = f"{sku['hostname_prefix']}{i:03d}"
            
            new_nodes.append({
                "cluster_id": target_cluster_id,
                "datacenter_id": dc_id,
                "hostname": hostname, 
                "status": "online",
                "metadata": {
                    "role": sku["role"],
                    "system_cpu": sku["system_cpu"],
                    "system_ram_gb": sku["system_ram_gb"],
                    "network_fabric": sku["network_fabric"],
                    "form_factor": sku["form_factor"]
                }
            })
            
        nodes_res = supabase_client.table("nodes").insert(new_nodes).execute()
        nodes_data = nodes_res.data
    else:
        nodes_res = supabase_client.table("nodes").select("id, hostname").execute()
        nodes_data = nodes_res.data

    # 4. Install GPUs
    gpu_ids = []
    for node in nodes_data:
        node_id = node["id"]
        hostname = node["hostname"]
        
        gpus_res = supabase_client.table("gpus").select("id").eq("node_id", node_id).execute()
        
        if not gpus_res.data:
            sku = next((s for s in catalog["node_skus"] if hostname.startswith(s["hostname_prefix"])), None)
            
            if sku:
                gpu_model = sku["allowed_gpus"][0]
                gpu_details = catalog["gpu_specs"][gpu_model]
                num_gpus = sku["gpus_per_node"]
                
                logger.info(f"Installing {num_gpus}x {gpu_model} in {hostname}...")
                
                new_gpus = [
                    {
                        "node_id": node_id, 
                        "model": gpu_model, 
                        "pci_bus_id": f"0000:{i:02d}:00.0",
                        "metadata": gpu_details
                    }
                    for i in range(1, num_gpus + 1)
                ]
                gpus_res = supabase_client.table("gpus").insert(new_gpus).execute()
                gpu_ids.extend([gpu["id"] for gpu in gpus_res.data])
        else:
             gpu_ids.extend([gpu["id"] for gpu in gpus_res.data])

    logger.info(f"Infrastructure ready. Tracking {len(gpu_ids)} GPUs across {len(cluster_map)} clusters.")
    return gpu_ids

def insert_metrics(table_name: str, payload: List[dict]):
    """Generic fast-insert function for time-series data."""
    try:
        supabase_client.table(table_name).insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert into {table_name}: {e}")

def chunked_insert(table_name: str, payload: List[dict], chunk_size: int = 1000):
    """
    Slices massive datasets into smaller chunks to respect API payload limits
    and avoid timeouts during bulk inserts.
    """
    total = len(payload)
    for i in range(0, total, chunk_size):
        chunk = payload[i:i + chunk_size]
        insert_metrics(table_name, chunk)
        logger.info(f"Inserted chunk {i} to {min(i + chunk_size, total)} of {total} into {table_name}.")

def purge_old_telemetry():
    """
    Purges historical telemetry tables prior to a backfill execution.
    Ensures script idempotency and guards cloud resource caps.
    """
    logger.info("Starting Pre-Flight telemetry cleanup...")
    try:
        supabase_client.table("telemetry").delete().gt("timestamp", "2000-01-01").execute()
        logger.info("Successfully truncated existing data from table: telemetry")
    except Exception as e:
        logger.warning(f"Could not purge telemetry table: {e}")