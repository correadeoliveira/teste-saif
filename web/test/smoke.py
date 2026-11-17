"""Smoke test the Vite preview and standalone web client with fixture network responses."""

import os
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = {
    "meta": {"crime_type": "all", "period": "all"},
    "count": 1,
    "points": [[-23.55, -46.63, 0.8]],
}


@contextmanager
def server(command, base):
    with subprocess.Popen(command, cwd=ROOT) as process:
        try:
            for _ in range(70):
                if process.poll() is not None:
                    raise RuntimeError("Web server stopped before startup.")
                try:
                    with urlopen(base, timeout=1) as response:
                        if response.status == 200:
                            break
                except URLError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Web server did not become ready.")
            yield
        finally:
            process.terminate()
            process.wait(timeout=5)


def route_fixture(route, base, available, pending_summaries):
    url = urlsplit(route.request.url)
    if url.netloc == urlsplit(base).netloc:
        if url.path == "/shared/summary.json":
            # Keep the summary pending while checking that the map shows its source.
            pending_summaries.append(route)
            return
        if "/heatmap_points" in url.path:
            if available and url.path.endswith("/heatmap_points.json"):
                route.fulfill(json=ARTIFACT)
            else:
                route.fulfill(status=404)
        else:
            route.continue_()
    elif url.hostname == "unpkg.com" and "/leaflet@1.9.4/dist/" in url.path:
        filename = url.path.rsplit("/", 1)[-1]
        if filename in ("leaflet.js", "leaflet.css"):
            route.fulfill(path=ROOT / "node_modules/leaflet/dist" / filename)
        else:
            route.abort()
    elif url.hostname == "unpkg.com" and url.path.endswith("/leaflet-heat.js"):
        route.fulfill(path=ROOT / "node_modules/leaflet.heat/dist/leaflet-heat.js")
    elif route.request.resource_type == "image":
        route.fulfill(status=204)
    else:
        route.abort()


def smoke(browser, base):
    for available in (True, False):
        page = browser.new_page()
        pending_summaries = []
        page.route(
            "**/*", lambda route: route_fixture(route, base, available, pending_summaries)
        )
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base)
        expected_source = "real" if available else "mock"
        indicator = page.locator(f'[data-heatmap-source="{expected_source}"]')
        expect(indicator).to_be_visible(timeout=15_000)
        for route in pending_summaries:
            route.fulfill(json={"total_incidents": 10})
        if available and urlsplit(base).path == "/web/":
            expect(indicator).to_contain_text("base total:")
        assert not errors, errors
        page.close()


def main():
    apps = (
        (["node", "tools/serve-web.mjs", "8031"], "http://127.0.0.1:8031/web/"),
        (["node", "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "8032"],
         "http://127.0.0.1:8032/"),
    )
    executable_path = os.getenv("SAIFEN_CHROMIUM")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=executable_path, args=["--enable-unsafe-swiftshader"])
        for command, base in apps:
            with server(command, base):
                smoke(browser, base)
                print(f"Web smoke OK: {base}")
        browser.close()


if __name__ == "__main__":
    main()
