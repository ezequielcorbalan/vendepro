#!/usr/bin/env bash
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$BACKEND_DIR/.local-pids"

if [ ! -f "$PIDS_FILE" ]; then
  echo "No hay procesos locales registrados (.local-pids no encontrado)"
  exit 0
fi

echo "Deteniendo procesos locales..."
while IFS= read -r pid; do
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "  ✓ PID $pid detenido"
  fi
done < "$PIDS_FILE"

rm -f "$PIDS_FILE"
echo "Listo."
