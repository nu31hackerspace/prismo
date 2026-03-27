FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System deps required by ESP-IDF and MicroPython
RUN apt-get update && apt-get install -y \
    git wget flex bison gperf python3 python3-pip python3-venv \
    cmake ninja-build ccache libffi-dev libssl-dev dfu-util \
    libusb-1.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install psycopg2-binary --break-system-packages

# ── ESP-IDF ──────────────────────────────────────────────────────────────────
# Shallow clone to save time; --shallow-submodules limits submodule history too
RUN git clone --depth 1 -b v5.5.1 --recurse-submodules --shallow-submodules \
    https://github.com/espressif/esp-idf.git /opt/esp-idf
RUN cd /opt/esp-idf && ./install.sh esp32c3

# ── MicroPython ───────────────────────────────────────────────────────────────
RUN git clone --depth 1 -b v1.27.0 --recurse-submodules --shallow-submodules \
    https://github.com/micropython/micropython.git /opt/micropython

RUN cd /opt/micropython && make -C mpy-cross

RUN bash -c ". /opt/esp-idf/export.sh && \
    cd /opt/micropython/ports/esp32 && \
    make BOARD=ESP32_GENERIC_C3 submodules"

# ── Firmware source ───────────────────────────────────────────────────────────
# Build context is the repo root so both firmware/ and web/worker/ are reachable
COPY firmware/ /firmware/

# Pre-build with template placeholders to cache all compiled objects.
# Subsequent per-job builds only recompile the changed frozen Python modules.
RUN bash -c ". /opt/esp-idf/export.sh && \
    cd /opt/micropython/ports/esp32 && \
    make BOARD=ESP32_GENERIC_C3 FROZEN_MANIFEST=/firmware/manifest.py"

# ── Worker script ─────────────────────────────────────────────────────────────
COPY web/worker/build.sh /worker/build.sh
COPY web/worker/worker.py /worker/worker.py
RUN chmod +x /worker/build.sh

CMD ["python3", "/worker/worker.py"]
