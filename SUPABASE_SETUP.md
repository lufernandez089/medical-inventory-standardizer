# Supabase Setup Guide

## Initial Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)
2. **Get your project credentials**:
   - Project URL (found in Settings > API)
   - Anon/Public key (found in Settings > API)
3. **Set environment variables** in your `.env.local` file:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## Database Schema Setup

### Option 1: Run the complete schema (Recommended)
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/sql/create_schema.sql`
4. Click **Run** to execute the script

### Option 2: Fix existing schema issues
If you're getting errors about missing columns, run the fix scripts:

1. **Fix variations column issue**:
   - Copy and paste `supabase/sql/fix_schema.sql`
   - Click **Run**

2. **Fix updated_at column issue**:
   - Copy and paste `supabase/sql/fix_updated_at_column.sql`
   - Click **Run**

## Row Level Security (RLS) Policies

After creating the schema, apply the RLS policies:
1. Copy and paste `supabase/sql/mvp_open_policies.sql`
2. Click **Run**

## Verify Setup

1. **Check tables exist**: Go to **Table Editor** and verify you see:
   - `nomenclature_systems`
   - `device_type_terms`
   - `reference_terms`

2. **Test the app**: Your app should now work without the "updated_at column" error

## Troubleshooting

### Common Issues

1. **"Could not find the 'updated_at' column" error**:
   - Run `supabase/sql/fix_updated_at_column.sql` in SQL Editor
   - This adds the missing column to your tables

2. **"Could not find the 'variations' column" error**:
   - Run `supabase/sql/fix_schema.sql` in SQL Editor
   - This adds the missing variations column

3. **Permission denied errors**:
   - Ensure you've run `supabase/sql/mvp_open_policies.sql`
   - Check that RLS is enabled on your tables

### Schema Verification

To verify your current schema, run this query in SQL Editor:

```sql
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('nomenclature_systems', 'device_type_terms', 'reference_terms')
ORDER BY table_name, ordinal_position;
```

## Next Steps

Once the database is set up correctly:
1. Restart your development server (`npm run dev`)
2. The app should now work without database errors
3. You can add terms and variations successfully
