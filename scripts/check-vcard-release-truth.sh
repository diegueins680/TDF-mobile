#!/bin/sh
set -eu

mode=${1:-current}
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
vcard_file="$root_dir/app/(tabs)/vcard.tsx"
config_file="$root_dir/app.config.ts"

require_contains() {
  file=$1
  needle=$2
  label=$3
  if grep -Fq -- "$needle" "$file"; then
    printf 'ok: %s\n' "$label"
  else
    printf 'missing: %s\n' "$label" >&2
    exit 1
  fi
}

require_absent() {
  file=$1
  needle=$2
  label=$3
  if grep -Fq -- "$needle" "$file"; then
    printf 'unexpected: %s\n' "$label" >&2
    exit 1
  else
    printf 'ok absent: %s\n' "$label"
  fi
}

require_current_truth() {
  require_contains "$vcard_file" "CameraView" "vCard screen still mounts CameraView"
  require_contains "$vcard_file" "barcodeTypes: ['qr']" "vCard scanner is QR-only"
  require_contains "$vcard_file" "Escanear QR" "vCard screen still advertises QR scanning"
  require_contains "$vcard_file" "Abrir cámara" "vCard screen still exposes the camera CTA"
  require_contains "$config_file" "scan vCard QR codes and capture inventory images." "camera permission copy matches QR scanning plus inventory capture"
  require_contains "$config_file" "attach inventory images." "photo-library permission copy matches inventory attachment"
  require_contains "$config_file" "show nearby venues." "location permission copy matches nearby venues"
}

require_removed_truth() {
  require_absent "$vcard_file" "CameraView" "CameraView removed from the vCard flow"
  require_absent "$vcard_file" "barcodeTypes: ['qr']" "QR-only scanner config removed from the vCard flow"
  require_absent "$vcard_file" "Escanear QR" "QR scanning UI copy removed from the vCard flow"
  require_absent "$vcard_file" "Abrir cámara" "camera CTA removed from the vCard flow"
  require_absent "$config_file" "scan vCard QR codes" "camera permission copy no longer claims QR scanning"
  require_contains "$config_file" "capture inventory images." "camera access still covers inventory capture"
  require_contains "$config_file" "attach inventory images." "photo-library permission copy still covers inventory attachment"
  require_contains "$config_file" "show nearby venues." "location permission copy still covers nearby venues"
}

case "$mode" in
  current)
    require_current_truth
    printf 'verdict: current source still supports QR/vCard scanning plus inventory photo capture.\n'
    ;;
  removed)
    require_removed_truth
    printf 'verdict: scanner-removal proof satisfied for current source.\n'
    ;;
  *)
    printf 'usage: %s [current|removed]\n' "$0" >&2
    exit 64
    ;;
esac
