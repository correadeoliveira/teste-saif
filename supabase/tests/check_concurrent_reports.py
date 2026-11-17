"""Check the report rate limit under concurrent calls in the ephemeral CI database."""

from concurrent.futures import ThreadPoolExecutor
from subprocess import check_output
from uuid import uuid4


def rpc(device: str) -> str:
    query = f"""
        with response as materialized (
            select public.report_crime(-23.55, -46.63, 'furto', '{device}') as result
        )
        select case when result->>'ok' = 'true' then 'ok' else result->>'error' end
        from response
    """
    return check_output(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", "set role anon", "-c", query],
        text=True,
        timeout=15,
    ).strip()


if __name__ == "__main__":
    device = str(uuid4())
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = sorted(pool.map(rpc, [device, device]))
    assert outcomes == ["ok", "rate_limited"], outcomes
    print("concurrent reports contract ok")
