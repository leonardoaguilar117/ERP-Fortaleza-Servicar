"""Valida el catálogo de vehículos y genera el JSON seed combinado (marcas → modelos → versiones).

Fuentes editables:
  catalogo_vehiculos_mx.csv   marca/modelo/años/carrocerías/alias (416 modelos)
  versiones_vehiculos_mx.csv  versión, motor, cilindros, combustible, transmisión y km/l (255 modelos)

Uso (desde data/vehiculos):
  python -I build_catalog.py . versiones_vehiculos_mx.csv

Genera catalogo_vehiculos_mx.json y reescribe versiones_vehiculos_mx.csv ordenado. No edites el JSON a mano.
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path

CURRENT_YEAR = 2026
BODY_TYPES = {"SEDAN", "HATCHBACK", "SUV", "PICKUP", "VAN", "MINIVAN", "COUPE", "CONVERTIBLE", "WAGON"}
FUELS = {"Gasolina", "Diésel", "Híbrido", "Eléctrico"}
VERSION_FIELDS = ["marca", "modelo", "anio_inicio", "anio_fin", "version", "motor", "cilindros",
                  "combustible", "transmision", "rendimiento_kml"]

data_dir = Path(sys.argv[1])
parts = [Path(p) for p in sys.argv[2:]]

# --- catálogo base (marca/modelo) ---
base = {}
with (data_dir / "catalogo_vehiculos_mx.csv").open(encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        key = (row["marca"], row["modelo"])
        assert key not in base, f"duplicado en base: {key}"
        start = int(row["anio_inicio"]); end = int(row["anio_fin"]) if row["anio_fin"] else None
        assert 1990 <= start <= CURRENT_YEAR and (end is None or start <= end <= CURRENT_YEAR), key
        bodies = row["carrocerias"].split("|")
        assert set(bodies) <= BODY_TYPES, (key, bodies)
        base[key] = {"yearFrom": start, "yearTo": end, "bodyTypes": bodies,
                     "aliases": [a.strip() for a in row["alias"].split(";")] if row["alias"] else []}

# --- versiones ---
rows, errors, warnings = [], [], []
for p in parts:
    with p.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == VERSION_FIELDS, (p, reader.fieldnames)
        rows.extend(reader)

versions = defaultdict(list)
for i, r in enumerate(rows, start=2):
    key = (r["marca"], r["modelo"])
    if key not in base:
        errors.append(f"fila {i}: {key} no existe en catalogo_vehiculos_mx.csv"); continue
    start = int(r["anio_inicio"]); end = int(r["anio_fin"]) if r["anio_fin"] else None
    if not (1990 <= start <= CURRENT_YEAR and (end is None or start <= end <= CURRENT_YEAR)):
        errors.append(f"fila {i}: años inválidos {key} {start}-{end}")
    b = base[key]
    if start < b["yearFrom"] or (b["yearTo"] and (end is None or end > b["yearTo"])):
        warnings.append(f"{key} versión {start}-{end or 'hoy'} fuera del rango base {b['yearFrom']}-{b['yearTo'] or 'hoy'}")
    fuels = r["combustible"].split("|")
    if not set(fuels) <= FUELS:
        errors.append(f"fila {i}: combustible inválido {fuels}")
    kml = float(r["rendimiento_kml"])
    if not 4.0 <= kml <= 30.0:
        errors.append(f"fila {i}: rendimiento fuera de rango {kml}")
    versions[key].append({
        "yearFrom": start, "yearTo": end,
        "trims": r["version"].split("|"),
        "engine": r["motor"],
        "cylinders": [int(c) for c in r["cilindros"].split("|")],
        "fuel": fuels,
        "transmissions": r["transmision"].split("|"),
        "fuelEconomyKmlCombined": kml,
    })

if errors:
    print("\n".join(errors)); sys.exit(1)

# --- salida combinada ---
with (data_dir / "versiones_vehiculos_mx.csv").open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=VERSION_FIELDS)
    w.writeheader()
    w.writerows(sorted(rows, key=lambda r: (r["marca"], r["modelo"], int(r["anio_inicio"]))))

makes = defaultdict(list)
for (make, model), info in sorted(base.items()):
    entry = {"name": model, **info}
    if (make, model) in versions:
        entry["versions"] = sorted(versions[(make, model)], key=lambda v: v["yearFrom"])
    makes[make].append(entry)

out = {
    "version": "2026-10-28",
    "scope": "Vehículos ligeros comunes en el mercado mexicano, 1990 a la fecha",
    "notes": [
        "yearTo = null significa que sigue a la venta.",
        "Rangos de años aproximados de comercialización en México.",
        "fuelEconomyKmlCombined: rendimiento combinado aproximado en km/l, referencia CONUEE (Catálogo de Rendimientos de vehículos ligeros). No es consumo garantizado; varía por versión, transmisión y uso.",
        "Catálogo editable desde la UI: el taller puede agregar marcas, modelos y versiones faltantes.",
    ],
    "bodyTypes": sorted(BODY_TYPES),
    "fuels": sorted(FUELS),
    "makes": [{"name": m, "models": ms} for m, ms in sorted(makes.items())],
}
(data_dir / "catalogo_vehiculos_mx.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

detailed = len(versions)
print(f"base: {len(makes)} marcas, {len(base)} modelos | detallados: {detailed} modelos, {len(rows)} filas de versión/motor")
print(f"combustibles: { {f: sum(1 for r in rows if f in r['combustible']) for f in FUELS} }")
if warnings:
    print(f"{len(warnings)} avisos de rango:"); print("\n".join(warnings))
