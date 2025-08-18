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

## Fallback Behavior

If Supabase is not configured or fails to connect, the application will:
- Show a warning message
- Fall back to local hardcoded data
- Continue functioning normally
