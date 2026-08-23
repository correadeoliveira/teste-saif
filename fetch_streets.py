import urllib.request
import json

# Overpass API query for a few specific streets near Praça Ramos, SP
query = """
[out:json];
(
  way["name"~"Avenida Ipiranga"](-23.546,-46.645,-23.541,-46.637);
  way["name"~"Rua Conselheiro Crispiniano"](-23.546,-46.645,-23.541,-46.637);
  way["name"~"Rua 24 de Maio"](-23.546,-46.645,-23.541,-46.637);
  way["name"~"Rua Barão de Itapetininga"](-23.546,-46.645,-23.541,-46.637);
  way["name"~"Rua Coronel Xavier de Toledo"](-23.547,-46.645,-23.541,-46.637);
);
out geom;
"""

url = "https://overpass-api.de/api/interpreter"
req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

streets = {}
for element in data['elements']:
    name = element['tags'].get('name', 'Unknown')
    coords = [[node['lat'], node['lon']] for node in element['geometry']]
    if name not in streets:
        streets[name] = coords
    else:
        streets[name].extend(coords)

print(json.dumps(streets, indent=2))
