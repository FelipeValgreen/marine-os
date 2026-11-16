CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tax_id TEXT,
    country_code CHAR(2) DEFAULT 'CL',
    plan_tier TEXT CHECK (plan_tier IN ('b2c_free', 'b2c_pro', 'b2b_fleet')) DEFAULT 'b2b_fleet',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    vessel_type TEXT CHECK (vessel_type IN ('sailboat', 'catamaran', 'motor_yacht')),
    loa_meters NUMERIC(5,2) NOT NULL,
    beam_meters NUMERIC(5,2),
    draft_meters NUMERIC(4,2) NOT NULL,
    mast_height_meters NUMERIC(5,2),
    fuel_capacity_l INTEGER,
    water_capacity_l INTEGER,
    engine_hours_current NUMERIC(8,1) DEFAULT 0,
    polar_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessel_systems_qr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    qr_slug TEXT UNIQUE NOT NULL,
    system_name TEXT NOT NULL,
    category TEXT CHECK (category IN ('engine', 'plumbing_wc', 'electrical', 'anchoring', 'safety', 'rigging')),
    compartment_location TEXT,
    video_tutorial_url TEXT,
    quick_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    qr_node_id UUID REFERENCES vessel_systems_qr(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    min_threshold INTEGER DEFAULT 1,
    expiration_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE anchorages_spatial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country_code CHAR(2),
    location GEOMETRY(Point, 4326) NOT NULL,
    shelter_polygon GEOMETRY(Polygon, 4326),
    exposed_bearings INT[] DEFAULT '{}',
    seabed_type TEXT CHECK (seabed_type IN ('sand', 'mud', 'rock', 'weed', 'mixed')),
    min_depth_m NUMERIC(4,1),
    max_depth_m NUMERIC(4,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_anchorages_location ON anchorages_spatial USING GIST (location);

CREATE TABLE voyages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('draft', 'checkin_pending', 'active', 'completed')) DEFAULT 'draft',
    departure_port TEXT NOT NULL,
    arrival_port TEXT NOT NULL,
    departure_at TIMESTAMPTZ NOT NULL,
    estimated_arrival_at TIMESTAMPTZ,
    route_geom GEOMETRY(LineString, 4326),
    gpx_raw_url TEXT,
    magic_link_token TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
    security_deposit_amount NUMERIC(10,2),
    security_deposit_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE voyage_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('skipper', 'crew', 'guest')) DEFAULT 'crew',
    full_name TEXT NOT NULL,
    document_type TEXT,
    document_number TEXT,
    nationality TEXT,
    license_type TEXT,
    license_expiry DATE,
    ocr_verified BOOLEAN DEFAULT FALSE,
    waiver_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE handover_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
    inspection_type TEXT CHECK (inspection_type IN ('checkin', 'checkout')) NOT NULL,
    checklist_data JSONB NOT NULL,
    photos_evidence JSONB DEFAULT '[]'::jsonb,
    signature_svg TEXT,
    integrity_hash TEXT,
    completed_offline_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessel_manual_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    manual_title TEXT NOT NULL,
    page_number INTEGER,
    content TEXT NOT NULL,
    embedding VECTOR(1536)
);
