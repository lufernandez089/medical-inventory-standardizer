-- Enable RLS (only if currently enabled without policies) and allow all for MVP
-- This file contains RLS policies for development/testing purposes
-- WARNING: These policies allow anonymous access - tighten for production!

-- Nomenclature Systems
alter table nomenclature_systems enable row level security;
create policy "anon all" on nomenclature_systems for all using (true) with check (true);

-- Device Type Terms
alter table device_type_terms enable row level security;
create policy "anon all" on device_type_terms for all using (true) with check (true);

-- Reference Terms
alter table reference_terms enable row level security;
create policy "anon all" on reference_terms for all using (true) with check (true);

-- Note: If you have separate variation tables, uncomment and adjust these:
-- alter table device_type_variations enable row level security;
-- create policy "anon all" on device_type_variations for all using (true) with check (true);
-- alter table reference_variations enable row level security;
-- create policy "anon all" on reference_variations for all using (true) with check (true);

-- IMPORTANT: These policies are for MVP development only
-- In production, implement proper authentication and restrict access based on user roles
-- Example of tighter policy:
-- create policy "authenticated users only" on device_type_terms 
--   for all using (auth.role() = 'authenticated') 
--   with check (auth.role() = 'authenticated');
