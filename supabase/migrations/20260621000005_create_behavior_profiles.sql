-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 005
-- Perfil de enrollment IMU (mobile → Supabase)
--
-- O JSONL bruto permanece no device. Esta tabela é só o cupom
-- de perfil (quantas sessões genuine, status ready, etc.).
-- Sem auth no MVP: anon pode upsert. Trocar quando houver login.
-- ═══════════════════════════════════════════════════

create table if not exists public.behavior_profiles (
    device_id          uuid primary key,
    subject_id         text not null,
    genuine_sessions   integer not null default 0,
    required_sessions  integer not null default 3,
    status             text not null default 'none'
                       check (status in ('none', 'enrolling', 'ready')),
    platform           text,
    updated_at         timestamptz not null default now()
);

create index if not exists behavior_profiles_subject_idx
    on public.behavior_profiles (subject_id);

comment on table public.behavior_profiles is
    'Cupom de enrollment IMU por device. JSONL fica no aparelho; '
    'o treino LR continua no host.';

alter table public.behavior_profiles enable row level security;

drop policy if exists "behavior_profiles_read_anon" on public.behavior_profiles;
create policy "behavior_profiles_read_anon" on public.behavior_profiles
    for select using (true);

drop policy if exists "behavior_profiles_insert_anon" on public.behavior_profiles;
create policy "behavior_profiles_insert_anon" on public.behavior_profiles
    for insert with check (true);

drop policy if exists "behavior_profiles_update_anon" on public.behavior_profiles;
create policy "behavior_profiles_update_anon" on public.behavior_profiles
    for update using (true) with check (true);

grant select, insert, update on public.behavior_profiles to anon, authenticated;
