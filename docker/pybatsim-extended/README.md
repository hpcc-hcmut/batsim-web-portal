# Extended PyBatSim Image

Adds common scheduling-research libraries to upstream `tanaxer/pybatsim:latest`.

## Why

Strategies uploaded through the portal run inside this container. We pre-install
`numpy / scipy / networkx / pandas / sortedcontainers / more-itertools` so most published
HPC scheduling strategies work out of the box, without breaking the snapshot-freeze
reproducibility contract via runtime `pip install`.

## Build

```bash
docker build -t batsim-portal/pybatsim-extended:1.0 docker/pybatsim-extended/
```

## Use

Set `PYBATSIM_IMAGE=batsim-portal/pybatsim-extended:1.0` (default in `app/core/config.py`).

## Adding a library

1. Edit `Dockerfile` — add the pinned `pip install` line.
2. Edit `runtime-info.json` — add `{name, version}` to `available_libs`.
3. Rebuild: `docker build -t batsim-portal/pybatsim-extended:<new-tag> .`
4. Bump `PYBATSIM_IMAGE` config to the new tag.
5. Re-run existing strategies to confirm backwards-compat.

## Policy

Runtime `requirements.txt` upload is intentionally NOT supported:
- Reproducibility: same image across every experiment in a research program.
- Security: avoids arbitrary pip install at simulation start.
- Determinism: dependency resolution time variance breaks measurement.
