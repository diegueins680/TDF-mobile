#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

SIM_ID="8DB9DCE0-2F80-49C9-A614-F21DA3876B7B"
APP_PATH="$MOBILE_DIR/ios/build/Build/Products/Debug-iphonesimulator/TDFRecords.app"
EXPECTED_BUNDLE_ID="com.tdfrecords.app"
METRO_URL="http://127.0.0.1:8081/status"
PROOF_ARTIFACT="/Users/diegosaa/.openclaw/orgs/tdf-label/evidence/ios-native-modules-resmoke-20260425-213834"

python3 - <<'PY'
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

sim_id = "8DB9DCE0-2F80-49C9-A614-F21DA3876B7B"
mobile_dir = Path("/Users/diegosaa/GitHub/tdf-app/tdf-mobile")
app_path = mobile_dir / "ios/build/Build/Products/Debug-iphonesimulator/TDFRecords.app"
expected_bundle_id = "com.tdfrecords.app"
metro_url = "http://127.0.0.1:8081/status"
proof_artifact = Path("/Users/diegosaa/.openclaw/orgs/tdf-label/evidence/ios-native-modules-resmoke-20260425-213834")
metro_command = f"cd '{mobile_dir}' && npx expo start --dev-client --host localhost"
install_command = f"xcrun simctl install {sim_id} '{app_path}'"
launch_command = f"xcrun simctl launch {sim_id} {expected_bundle_id}"


def emit(key: str, value: str) -> None:
    print(f"{key}={value}")


emit("simulator_id", sim_id)
emit("app_path", str(app_path))
emit("expected_bundle_id", expected_bundle_id)
emit("proof_artifact", str(proof_artifact))
emit("exact_step_1", metro_command)
emit("exact_step_2", install_command)
emit("exact_step_3", launch_command)

sim_present = False
sim_state = "missing"
sim_name = ""

simctl = subprocess.run(
    ["xcrun", "simctl", "list", "devices", "available", "--json"],
    capture_output=True,
    text=True,
    check=False,
)
if simctl.returncode == 0 and simctl.stdout.strip():
    try:
        payload = json.loads(simctl.stdout)
    except json.JSONDecodeError:
        payload = {}
    for devices in payload.get("devices", {}).values():
        for device in devices:
            if device.get("udid") == sim_id:
                sim_present = True
                sim_state = device.get("state", "unknown")
                sim_name = device.get("name", "unknown")
                break
        if sim_present:
            break
else:
    emit("simctl_probe_status", f"exit-{simctl.returncode}")

emit("simulator_present", "true" if sim_present else "false")
if sim_present:
    emit("simulator_name", sim_name)
    emit("simulator_state", sim_state)

app_exists = app_path.is_dir()
emit("app_exists", "true" if app_exists else "false")

actual_bundle_id = "missing"
if app_exists:
    info_plist = app_path / "Info.plist"
    if info_plist.exists():
        plist = subprocess.run(
            ["plutil", "-extract", "CFBundleIdentifier", "raw", "-o", "-", str(info_plist)],
            capture_output=True,
            text=True,
            check=False,
        )
        if plist.returncode == 0 and plist.stdout.strip():
            actual_bundle_id = plist.stdout.strip()
        else:
            actual_bundle_id = "unreadable"
    else:
        actual_bundle_id = "missing-info-plist"

emit("actual_bundle_id", actual_bundle_id)
bundle_match = actual_bundle_id == expected_bundle_id
emit("bundle_id_matches", "true" if bundle_match else "false")

metro_running = False
metro_response = "unreachable"
try:
    with urllib.request.urlopen(metro_url, timeout=1.5) as response:
        metro_response = response.read().decode("utf-8", errors="replace").strip() or "empty-response"
        metro_running = response.status == 200
except urllib.error.URLError as exc:
    metro_response = str(exc.reason)
except Exception as exc:  # pragma: no cover - defensive fallback
    metro_response = str(exc)

emit("metro_status", "running" if metro_running else "not-running")
emit("metro_probe", metro_response.replace("\n", " "))

static_ok = sim_present and app_exists and bundle_match
live_ready = static_ok and sim_state == "Booted" and metro_running

if live_ready:
    emit("status", "objective-exact-lane-ready")
    emit("verdict", "exact iPhone 16 smoke lane is live-runnable from the current simulator/app/Metro contract")
    sys.exit(0)

if static_ok:
    emit("status", "objective-exact-lane-static-prereqs-ok")
    missing = []
    if sim_state != "Booted":
        missing.append("booted simulator")
    if not metro_running:
        missing.append("Metro on 127.0.0.1:8081")
    emit("missing_live_prerequisites", ", ".join(missing) if missing else "none")
    emit("verdict", "exact iPhone 16 smoke lane contract matches the objective, but the live run session is not active yet")
    sys.exit(2)

emit("status", "objective-exact-lane-blocked")
if not sim_present:
    emit("blocker", "exact simulator id is unavailable on this workstation")
    emit("blocker_owner", "tdf-label-platform")
elif not app_exists:
    emit("blocker", "objective-pinned Debug-iphonesimulator app bundle is missing from this workstation")
    emit("blocker_owner", "tdf-label-platform")
else:
    emit("blocker", f"objective-pinned app bundle identifier drifted: expected {expected_bundle_id}, got {actual_bundle_id}")
    emit("blocker_owner", "tdf-label-platform")
emit("verdict", "same-run packager-backed iPhone 16 lane is no longer smoke-runnable from the proved simulator/app contract; Release stopped before recording flow verdicts.")
sys.exit(1)
PY
