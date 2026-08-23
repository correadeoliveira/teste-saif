import json

with open('result.json', 'r') as f:
    data = json.load(f)

streets = {}
for el in data.get('elements', []):
    tags = el.get('tags', {})
    name = tags.get('name')
    if not name: continue
    coords = [[node['lat'], node['lon']] for node in el.get('geometry', [])]
    if name not in streets:
        streets[name] = coords
    else:
        streets[name].extend(coords)

output = "export const nightLighting = [\n"
levels = ['bem_iluminada', 'parcial', 'escura']
idx = 0
for name, coords in streets.items():
    if len(coords) < 2: continue
    level = levels[idx % 3]
    idx += 1
    # simplify coordinates to reduce size slightly (take every 2nd or just all)
    simplified = coords[::2]
    if coords[-1] not in simplified:
        simplified.append(coords[-1])
    
    # Format coords as string
    coords_str = ", ".join(f"[{lat:.5f}, {lon:.5f}]" for lat, lon in simplified)
    
    output += f"    {{\n        name: '{name}',\n        level: '{level}',\n        coords: [{coords_str}]\n    }},\n"
output += "];\n"

with open('new_mock_data.txt', 'w') as f:
    f.write(output)

print("Parsed successfully!")
