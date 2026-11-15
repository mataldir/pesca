-- Script opcional si decidís usar Supabase Cloud directo sin servidor propio:
-- Ejecutá esto en el SQL Editor de tu proyecto gratuito en https://supabase.com

create table if not exists public.pesca_sync_store (
  id text primary key default 'main',
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pesca_sync_store enable row level security;

create policy "Acceso lectura/escritura sincronizado"
  on public.pesca_sync_store
  for all
  using (true)
  with check (true);
