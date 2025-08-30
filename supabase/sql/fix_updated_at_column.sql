-- Fix missing updated_at column in device_type_terms table
-- Run this in your Supabase SQL editor to resolve the 'updated_at' column error

-- Check if the updated_at column exists in device_type_terms table
DO $$
BEGIN
    -- Check if device_type_terms table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_type_terms') THEN
        -- Check if updated_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'device_type_terms' AND column_name = 'updated_at') THEN
            -- Add the missing updated_at column
            ALTER TABLE device_type_terms ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column to device_type_terms table';
        ELSE
            RAISE NOTICE 'updated_at column already exists in device_type_terms table';
        END IF;
    ELSE
        RAISE NOTICE 'device_type_terms table does not exist - create it first';
    END IF;
    
    -- Check if reference_terms table has updated_at column
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reference_terms') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reference_terms' AND column_name = 'updated_at') THEN
            ALTER TABLE reference_terms ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column to reference_terms table';
        ELSE
            RAISE NOTICE 'updated_at column already exists in reference_terms table';
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
  AND column_name = 'updated_at'
ORDER BY table_name, ordinal_position;
