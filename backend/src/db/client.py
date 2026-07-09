from supabase import create_client, Client
from core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client:
    """
    Initializes and returns the Supabase client using the Service Role Key.
    This bypasses RLS for administrative backend data insertion.
    """
    try:
        supabase: Client = create_client(
            settings.supabase_url, 
            settings.supabase_service_role_key
        )
        return supabase
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        raise

# Initialize the client once to be imported by the ingestion modules
supabase_client = get_supabase_client()