-- ═══════════════════════════════════════════════════
-- SAIFEN — Seed (dev local)
--
-- Pequeno conjunto de dados para que `supabase db reset` deixe o
-- ambiente local utilizável imediatamente, sem precisar rodar o
-- pipeline Python.
-- ═══════════════════════════════════════════════════

insert into public.crimes (bo_number, lat, lng, crime_type, period, occurred_at, neighborhood, city, phone_brand) values
    ('SEED-0001', -23.5505, -46.6333, 'furto', 'manha', '2026-06-01 09:30:00+00', 'CENTRO',         'S.PAULO', 'Apple'),
    ('SEED-0002', -23.5616, -46.6558, 'roubo', 'noite', '2026-06-02 21:00:00+00', 'PAULISTA',       'S.PAULO', 'Samsung'),
    ('SEED-0003', -23.5598, -46.6925, 'furto', 'tarde', '2026-06-03 15:00:00+00', 'PINHEIROS',      'S.PAULO', 'Xiaomi'),
    ('SEED-0004', -23.5430, -46.6428, 'roubo', 'madrugada', '2026-06-04 02:00:00+00', 'REPUBLICA', 'S.PAULO', 'Motorola'),
    ('SEED-0005', -23.5576, -46.6348, 'furto', 'noite', '2026-06-05 19:30:00+00', 'LIBERDADE',      'S.PAULO', 'Apple');

-- Uma única célula de heatmap_grid, só pra a RPC retornar algo
insert into public.heatmap_grid (crime_type, density, cell) values
    ('all', 1.0, st_geogfromtext('POLYGON((-46.64 -23.56, -46.63 -23.56, -46.63 -23.55, -46.64 -23.55, -46.64 -23.56))'));
