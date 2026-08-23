import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = """
[out:json];
(
  way["name"~"Avenida Ipiranga|Rua Conselheiro Crispiniano|Rua 24 de Maio"](-23.550,-46.645,-23.540,-46.635);
);
out geom;
"""
url = "https://overpass-api.de/api/interpreter"
data = query.encode('utf-8')
req = urllib.request.Request(url, data=data)
req.add_header('Accept', 'application/json')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        resp_data = response.read().decode('utf-8')
        d = json.loads(resp_data)
        for el in d.get('elements', []):
            name = el.get('tags', {}).get('name', 'Unknown')
            geom = el.get('geometry', [])
            coords = [[pt['lat'], pt['lon']] for pt in geom]
            if len(coords) > 1:
                print(f"Name: {name}")
                print(f"Coords: {coords[:3]} ...")
except Exception as e:
    print(e)
