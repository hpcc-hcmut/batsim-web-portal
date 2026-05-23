# Extended PyBatSim image — adds common scheduling-research libraries to upstream tanaxer/pybatsim.
#
# Why this exists:
#   Strategy uploads run inside this container with the user's .py file mounted read-only.
#   Upstream tanaxer/pybatsim ships only Python 3.10 + pybatsim. We pre-install the common
#   scheduling libraries (numpy, scipy, networkx, pandas, sortedcontainers, more-itertools)
#   to support published strategies without resorting to runtime pip install (which would
#   break the snapshot-freeze reproducibility contract).
#
# Strategy authors who need a library NOT listed here must contact the operator to extend
# this Dockerfile and rebuild — runtime requirements.txt is intentionally NOT supported.
#
# Build:
#   docker build -t batsim-portal/pybatsim-extended:1.0 docker/pybatsim-extended/
#
# Override in .env:
#   PYBATSIM_IMAGE=batsim-portal/pybatsim-extended:1.0

FROM tanaxer/pybatsim:latest

# Pin minor versions for reproducibility. Bump intentionally, not via :latest.
RUN /opt/venv/bin/pip install --no-cache-dir \
        numpy==1.26.4 \
        scipy==1.13.0 \
        networkx==3.3 \
        pandas==2.2.2 \
        sortedcontainers==2.4.0 \
        more-itertools==10.2.0

# Bake runtime manifest into image so backend /system/runtime endpoint can read it later.
COPY runtime-info.json /opt/runtime-info.json
