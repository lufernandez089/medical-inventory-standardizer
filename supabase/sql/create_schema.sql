-- Complete database schema for Medical Inventory Standardizer
-- Run this in your Supabase SQL editor to create all required tables

-- Create nomenclature_systems table
CREATE TABLE IF NOT EXISTS nomenclature_systems (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device_type_terms table
CREATE TABLE IF NOT EXISTS device_type_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id TEXT NOT NULL REFERENCES nomenclature_systems(id) ON DELETE CASCADE,
    standard TEXT NOT NULL,
    variations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reference_terms table
CREATE TABLE IF NOT EXISTS reference_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field TEXT NOT NULL CHECK (field IN ('Manufacturer', 'Model')),
    standard TEXT NOT NULL,
    variations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_type_terms_system_id ON device_type_terms(system_id);
CREATE INDEX IF NOT EXISTS idx_device_type_terms_standard ON device_type_terms(standard);
CREATE INDEX IF NOT EXISTS idx_reference_terms_field ON reference_terms(field);
CREATE INDEX IF NOT EXISTS idx_reference_terms_standard ON reference_terms(standard);

-- Enable Row Level Security
ALTER TABLE nomenclature_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_type_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_terms ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for MVP development
CREATE POLICY "anon all nomenclature_systems" ON nomenclature_systems FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all device_type_terms" ON device_type_terms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all reference_terms" ON reference_terms FOR ALL USING (true) WITH CHECK (true);

-- Verify the schema was created correctly
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('nomenclature_systems', 'device_type_terms', 'reference_terms')
ORDER BY table_name, ordinal_position;
