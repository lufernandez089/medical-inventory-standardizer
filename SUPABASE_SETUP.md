# Supabase Setup Guide

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Admin Password (optional - defaults to 'TINCTester' if not set)
VITE_ADMIN_PASSWORD=your_admin_password
```

## Database Schema

The application expects the following Supabase tables:

### nomenclature_systems
- `id` (text, primary key)
- `name` (text)
- `description` (text)
- `last_updated` (timestamp)

### device_type_terms
- `id` (uuid, primary key)
- `system_id` (text, foreign key to nomenclature_systems.id)
- `standard` (text)
- `variations` (text[])

### reference_terms
- `id` (uuid, primary key)
- `field` (text) - 'Manufacturer' or 'Model'
- `standard` (text)
- `variations` (text[])

## Setup Steps

1. Create a new Supabase project
2. Create the tables with the schema above
3. Set up Row Level Security (RLS) policies as needed
4. Copy your project URL and anon key to the .env file
5. Restart the development server

## Row Level Security (RLS) Setup

For MVP development, you can use the provided RLS policies that allow anonymous access:

```sql
-- Run the contents of supabase/sql/mvp_open_policies.sql
-- This will enable RLS and create permissive policies for development
```

**⚠️ Security Warning**: These policies allow anyone to read/write to your database. 
For production use, implement proper authentication and restrict access based on user roles.

### Alternative: Manual RLS Setup

If you prefer to set up RLS manually:

1. Enable RLS on all tables:
   ```sql
   alter table nomenclature_systems enable row level security;
   alter table device_type_terms enable row level security;
   alter table reference_terms enable row level security;
   ```

2. Create policies that allow your anon key to access:
   ```sql
   create policy "anon access" on nomenclature_systems for all using (true) with check (true);
   create policy "anon access" on device_type_terms for all using (true) with check (true);
   create policy "anon access" on reference_terms for all using (true) with check (true);
   ```
## Fallback Behavior

If Supabase is not configured or fails to connect, the application will:
- Show a warning message
- Fall back to local hardcoded data
- Continue functioning normally

## Troubleshooting

### Common Issues

1. **"Supabase Environment Variables Missing" Banner**
   - Ensure `.env` file exists in project root
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
   - Restart development server after adding `.env` file

2. **"Error creating term" Messages**
   - Check browser console for detailed error logs
   - Verify RLS policies are set up correctly
   - Ensure database tables exist with correct schema
   - Check Supabase project status and API limits

3. **Database Connection Failures**
   - Verify Supabase project is active
   - Check if anon key has correct permissions
   - Ensure RLS policies allow anonymous access
   - Check network connectivity to Supabase

### Debug Mode

The application now includes enhanced error logging. Check the browser console for:
- Detailed Supabase error messages
- Environment variable validation results
- Database operation logs
- Connectivity test results

### Testing Database Connectivity

Use the built-in connectivity test:
```javascript
// In browser console
import { canWriteToSupabase } from './src/lib/db.js';
const result = await canWriteToSupabase();
console.log(result);
```
