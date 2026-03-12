#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

build_page() {
  local output_file="$1"
  shift
  mkdir -p "$(dirname "$output_file")"
  : > "$output_file"
  for part in "$@"; do
    cat "$part" >> "$output_file"
    printf '\n' >> "$output_file"
  done
}

build_page "$DIST_DIR/index.html" \
  "$ROOT_DIR/partials/index/head.html" \
  "$ROOT_DIR/partials/index/floating-bg.html" \
  "$ROOT_DIR/partials/index/header-shell.html" \
  "$ROOT_DIR/partials/index/next-task-card.html" \
  "$ROOT_DIR/partials/index/timeline-section.html" \
  "$ROOT_DIR/partials/index/shell-close.html" \
  "$ROOT_DIR/partials/index/fab-add.html" \
  "$ROOT_DIR/partials/index/task-modal.html" \
  "$ROOT_DIR/partials/index/confirm-modal.html" \
  "$ROOT_DIR/partials/index/tail.html"

build_page "$DIST_DIR/groups.html" \
  "$ROOT_DIR/partials/groups/head.html" \
  "$ROOT_DIR/partials/groups/floating-bg.html" \
  "$ROOT_DIR/partials/groups/main-content.html" \
  "$ROOT_DIR/partials/groups/confirm-modal.html" \
  "$ROOT_DIR/partials/groups/tail.html"

mkdir -p "$DIST_DIR/assets"
cp -R "$ROOT_DIR/assets/." "$DIST_DIR/assets/"

cat > "$ROOT_DIR/index.html" <<'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url=dist/index.html" />
  <title>Ritmo</title>
</head>
<body>
  <p>Redirigiendo a <a href="dist/index.html">dist/index.html</a>...</p>
</body>
</html>
EOF

cat > "$ROOT_DIR/groups.html" <<'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url=dist/groups.html" />
  <title>Ritmo - Grupos</title>
</head>
<body>
  <p>Redirigiendo a <a href="dist/groups.html">dist/groups.html</a>...</p>
</body>
</html>
EOF

echo "Build complete: dist/index.html y dist/groups.html"
