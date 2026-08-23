import requests
import json

query = """
[out:json];
(
  way["name"~"Avenida Ipiranga|Rua São João|Rua Conselheiro Crispiniano|Rua Coronel Xavier de Toledo|Rua Barão de Itapetininga|Rua Dom José de Barros|Rua 24 de Maio|Rua Marconi"](-23.548,-46.645,-23.541,-46.637);
);
out geom;
"""
url = "https://overpass-api.de/api/interpreter"
response = requests.post(url, data={'data': query})

data = response.json()
streets = {}
for element in data.get('elements', []):
    name = element.get('tags', {}).get('name', 'Unknown')
    coords = [[node['lat'], node['lon']] for node in element.get('geometry', [])]
    if name not in streets:
        streets[name] = coords
    else:
        # Just append for simplicity
        streets[name].extend(coords)

output = []
for name, coords in streets.items():
    output.append(f"    {{ name: '{name}', level: 'bem_iluminada', coords: {json.dumps(coords)} }},")

with open('osm_streets.txt', 'w') as f:
    f.write("\n".join(output))
print("Done")
