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
            elif available and url.path.endswith("/heatmap_points__roubo__noite.json"):
                route.fulfill(json={**ARTIFACT, "meta": {"crime_type": "roubo", "period": "noite"}})
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


def smoke_mobile_drawer(browser, base):
    page = browser.new_page(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True)
    summaries = []
    page.route("**/*", lambda route: route_fixture(route, base, True, summaries))
    page.goto(base)
    expect(page.locator('[data-heatmap-source="real"]')).to_be_attached(timeout=15_000)
    for route in summaries:
        route.fulfill(json={"total_incidents": 10})
    drawer = page.locator("#side-panel")
    toggle = page.locator("#mobile-panel-fab")
    toggle.tap()
    expect(drawer).to_have_class("side-panel open-mobile")
    page.wait_for_function("""() =>
        document.querySelector('#side-panel').getBoundingClientRect().bottom <= innerHeight
    """)
    page.locator("#map").tap(position={"x": 180, "y": 120})
    expect(drawer).to_have_class("side-panel collapsed")
    toggle.tap()
    expect(drawer).to_have_class("side-panel open-mobile")
    page.close()


def smoke_recovered_map_controls(browser, base):
    page = browser.new_page(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True)
    page.add_init_script("""
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...options) {
            return type.includes('webgl') ? null : getContext.call(this, type, ...options);
        };
    """)
    summaries = []
    page.route("**/*", lambda route: route_fixture(route, base, True, summaries))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base)
    expect(page.locator('[data-heatmap-source="real"]')).to_be_visible(timeout=15_000)
    page.get_by_role("button", name="Pular", exact=True).tap()
    page.get_by_role("button", name="Sim, Pular").tap()

    expect(page.get_by_text("VIGIL_OS")).to_be_visible()
    expect(page.locator("header time")).to_be_visible()
    expect(page.locator("header")).to_contain_text("Praça da Sé")
    layer_box = page.get_by_role("button", name="HEAT", exact=True).bounding_box()
    nav_box = page.locator("[data-bottom-nav]").bounding_box()
    assert layer_box["width"] >= 44 and layer_box["height"] >= 44
    assert layer_box["y"] + layer_box["height"] < nav_box["y"]
    filters = page.get_by_role("button", name="FILTROS", exact=True)
    dialog = page.get_by_role("dialog", name="Filtros do mapa")
    filters.tap()
    expect(dialog).to_be_visible()
    for name in ("furto", "outros", "manhã", "tarde", "madrugada"):
        dialog.get_by_role("button", name=name, exact=True, pressed=True).tap()
    dialog.get_by_role("button", name="Salvar filtros").tap()
    expect(dialog.get_by_role("status")).to_have_text("Filtros salvos")
    dialog.get_by_role("button", name="FECHAR").tap()
    expect(dialog).to_be_hidden()

    heat = page.get_by_role("button", name="HEAT", exact=True)
    heat.tap()
    expect(page.get_by_role("button", name="RISCO ROUBO · NOITE")).to_be_visible()
    canvas = page.locator("canvas.leaflet-heatmap-layer")
    expect(canvas).to_have_count(1)
    page.wait_for_function("""() => {
        const canvas = document.querySelector('canvas.leaflet-heatmap-layer');
        if (!canvas?.width || !canvas.height) return false;
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
    }""")
    page.locator("#map").tap()
    popup = page.locator(".leaflet-popup-content")
    expect(popup).to_contain_text("Fatia SSP-SP · roubo · noite")
    expect(popup).to_contain_text("Peso relativo 0,8")
    page.locator(".leaflet-popup-close-button").tap()

    flow = page.get_by_role("button", name="Fluxo simulado")
    routes = page.get_by_role("button", name="Rotas simuladas")
    flow.tap()
    routes.tap()
    expect(page.get_by_text("Fluxo e rotas simulados")).to_be_visible()
    expect(canvas).to_have_count(2)
    expect(page.locator("path.saifen-demo-route")).to_have_count(3)
    flow.tap()
    routes.tap()
    expect(canvas).to_have_count(1)
    expect(page.locator("path.saifen-demo-route")).to_have_count(0)
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
                if urlsplit(base).path == "/web/":
                    smoke_mobile_drawer(browser, base)
                else:
                    smoke_recovered_map_controls(browser, base)
                print(f"Web smoke OK: {base}")
        browser.close()


if __name__ == "__main__":
    main()
