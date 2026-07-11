import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import our isolated routers
from routers.simulation import router as simulation_router
from routers.diagnostic import router as diagnostic_router

# Set up global logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Initialize the FastAPI App
app = FastAPI(title="AI Cluster Observability API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the routes
app.include_router(simulation_router)
app.include_router(diagnostic_router)
# Local Server Execution
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)