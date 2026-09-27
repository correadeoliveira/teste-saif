-- Testes das RPCs report_crime e zone_risk (opcional).
-- Exige Postgres+PostGIS. O CI atual NÃO executa este arquivo:
-- usa supabase/tests/check_sql.py (contrato estático, sem Docker).

create or replace function tests_fail(msg text, got json default null)
returns void
language plpgsql
as $$
begin
    raise exception '% (got %)', msg, coalesce(got::text, 'null');
end;
$$;

-- ─── report_crime ──────────────────────────────────────────────────

do $$
declare
    r json;
    device uuid := '11111111-1111-4111-8111-111111111111';
begin
    r := public.report_crime(-23.55, -46.63, 'furto', null);
    if r->>'ok' <> 'false' or r->>'error' <> 'device_required' then
        perform tests_fail('report_crime sem device deve falhar', r);
    end if;

    r := public.report_crime(200, -46.63, 'furto', device);
    if r->>'error' <> 'invalid_coords' then
        perform tests_fail('lat inválida', r);
    end if;

    r := public.report_crime(-23.55, -46.63, 'furto', device);
    if r->>'ok' <> 'true' or r->>'crime_type' <> 'furto' then
        perform tests_fail('primeiro relato deve passar', r);
    end if;

    r := public.report_crime(-23.55, -46.63, 'roubo', device);
    if r->>'error' <> 'rate_limited' then
        perform tests_fail('segundo relato em 2 min deve ser rate_limited', r);
    end if;
end
$$;

-- ─── zone_risk: clamp de raio ──────────────────────────────────────

do $$
declare
    r json;
begin
    r := public.zone_risk(-24.5, -47.5, 99999);
    if (r->>'radius_meters')::int <> 2000 then
        perform tests_fail('raio 99999 deve clampar em 2000', r);
    end if;

    r := public.zone_risk(-24.5, -47.5, 10);
    if (r->>'radius_meters')::int <> 50 then
        perform tests_fail('raio 10 deve clampar em 50', r);
    end if;

    r := public.zone_risk(-24.5, -47.5, 250);
    if r->>'level' <> 'low' then
        perform tests_fail('área vazia deve ser low', r);
    end if;
end
$$;

-- ─── zone_risk: níveis por contagem (espelha zone.ts) ───────────────

do $$
declare
    r json;
    i int;
    lat float := -23.10;
    lng float := -46.10;
begin
    for i in 1..3 loop
        insert into public.crimes (bo_number, lat, lng, crime_type, period, city, source_file)
        values ('ZONE-M-' || i, lat, lng, 'furto', 'tarde', 'S.PAULO', 'test');
    end loop;
    r := public.zone_risk(lat, lng, 250);
    if r->>'level' <> 'medium' or (r->>'nearby_count')::int < 3 then
        perform tests_fail('3 BOs → medium', r);
    end if;

    for i in 4..8 loop
        insert into public.crimes (bo_number, lat, lng, crime_type, period, city, source_file)
        values ('ZONE-H-' || i, lat, lng, 'furto', 'tarde', 'S.PAULO', 'test');
    end loop;
    r := public.zone_risk(lat, lng, 250);
    if r->>'level' <> 'high' then
        perform tests_fail('8 BOs → high', r);
    end if;

    for i in 9..20 loop
        insert into public.crimes (bo_number, lat, lng, crime_type, period, city, source_file)
        values ('ZONE-C-' || i, lat, lng, 'furto', 'tarde', 'S.PAULO', 'test');
    end loop;
    r := public.zone_risk(lat, lng, 250);
    if r->>'level' <> 'critical' then
        perform tests_fail('20 BOs → critical', r);
    end if;
end
$$;

-- ─── zone_risk: nível por densidade da grade ───────────────────────

do $$
declare
    r json;
    lat float := -23.20;
    lng float := -46.20;
begin
    insert into public.heatmap_grid (crime_type, density, cell) values (
        'all',
        0.75,
        st_geogfromtext(
            'POLYGON((-46.201 -23.201, -46.199 -23.201, -46.199 -23.199, -46.201 -23.199, -46.201 -23.201))'
        )
    );
    r := public.zone_risk(lat, lng, 250);
    if r->>'level' <> 'critical' then
        perform tests_fail('density 0.75 → critical', r);
    end if;
end
$$;

drop function tests_fail(text, json);
