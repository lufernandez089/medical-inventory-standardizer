-- Fix database schema for Medical Inventory Standardizer
-- Run this in your Supabase SQL editor to resolve the 'variations' column error

-- First, check if the variations column exists
DO $$
BEGIN
    -- Check if device_type_terms table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_type_terms') THEN
        -- Check if variations column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'device_type_terms' AND column_name = 'variations') THEN
            -- Add the missing variations column
            ALTER TABLE device_type_terms ADD COLUMN variations text[] DEFAULT '{}';
            RAISE NOTICE 'Added variations column to device_type_terms table';
        ELSE
            RAISE NOTICE 'variations column already exists in device_type_terms table';
        END IF;
    ELSE
        RAISE NOTICE 'device_type_terms table does not exist - create it first';
    END IF;
    
    -- Check if reference_terms table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reference_terms') THEN
        -- Check if variations column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reference_terms' AND column_name = 'variations') THEN
            -- Add the missing variations column
            ALTER TABLE reference_terms ADD COLUMN variations text[] DEFAULT '{}';
            RAISE NOTICE 'Added variations column to reference_terms table';
        ELSE
            RAISE NOTICE 'variations column already exists in reference_terms table';
        END IF;
    ELSE
        RAISE NOTICE 'reference_terms table does not exist - create it first';
    END IF;
END $$;

-- Verify the schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('device_type_terms', 'reference_terms')
ORDER BY table_name, ordinal_position;
