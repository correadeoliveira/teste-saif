-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 001
-- Habilita extensões geoespaciais
-- ═══════════════════════════════════════════════════

create extension if not exists postgis;
create extension if not exists postgis_topology;
create extension if not exists "uuid-ossp";
