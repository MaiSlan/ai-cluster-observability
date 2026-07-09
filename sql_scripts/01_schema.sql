-- ==============================================================================
-- AI CLUSTER OBSERVABILITY - CORE SCHEMA
-- ==============================================================================

-- ==========================================
-- 0. TEARDOWN (Clean State)
-- WARNING: This will destroy all existing data.
-- ==========================================
DROP TABLE IF EXISTS telemetry CASCADE;
DROP TABLE IF EXISTS gpus CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS datacenters CASCADE;
DROP TABLE IF EXISTS clusters CASCADE;

-- ==========================================
-- 1. TABLE CREATION
-- ==========================================

-- Clusters (Top Level)
CREATE TABLE clusters (
    id UUID DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    fault_simulation_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT PK_CLU_CLUSTERS PRIMARY KEY (id)
);

-- Datacenters (Physical Locations)
CREATE TABLE datacenters (
    id UUID DEFAULT gen_random_uuid(),
    region TEXT NOT NULL UNIQUE,
    zone TEXT NOT NULL,
    tier TEXT NOT NULL,
    pue_rating FLOAT NOT NULL,
    cooling TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT PK_DC_DATACENTERS PRIMARY KEY (id)
);

-- Nodes (Physical Servers)
CREATE TABLE nodes (
    id UUID DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    datacenter_id UUID REFERENCES datacenters(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    status TEXT DEFAULT 'online',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT PK_NOD_NODES PRIMARY KEY (id)
);

-- GPUs (Compute Units)
CREATE TABLE gpus (
    id UUID DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    pci_bus_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT PK_GPU_GPUS PRIMARY KEY (id)
);

-- The Unified Time-Series Telemetry Table
CREATE TABLE telemetry (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    gpu_id UUID REFERENCES gpus(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metric_type TEXT NOT NULL, -- e.g., 'hardware', 'vllm', 'nccl'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT PK_TEL_TELEMETRY PRIMARY KEY (id)
);

-- ==========================================
-- 2. INDEXING (Optimized for TSDB and JSON reads)
-- ==========================================
CREATE INDEX idx_telemetry_timestamp ON telemetry(timestamp DESC);
CREATE INDEX idx_telemetry_lookup ON telemetry(gpu_id, metric_type);
CREATE INDEX idx_telemetry_payload ON telemetry USING GIN (payload);

-- ==========================================
-- 3. PERMISSIONS & SECURITY (RLS)
-- ==========================================
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Enable Row Level Security to prevent unauthorized writes
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE datacenters ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;

-- Explicitly allow the frontend (anon role) to read the data
CREATE POLICY "Allow public read access on clusters" 
ON clusters 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow public read access on datacenters" 
ON datacenters 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow public read access on nodes" 
ON nodes 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow public read access on gpus" 
ON gpus 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow public read access on telemetry" 
ON telemetry 
FOR SELECT 
TO anon 
USING (true);