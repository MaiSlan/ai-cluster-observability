from src.db.client import supabase_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_connection():
    try:
        # Attempt to fetch the clusters table (it should be empty, but it will prove the connection works)
        response = supabase_client.table("clusters").select("*").limit(1).execute()
        logger.info(f"Connection Successful! Response: {response.data}")
    except Exception as e:
        logger.error(f"Connection Failed: {e}")

if __name__ == "__main__":
    test_connection()