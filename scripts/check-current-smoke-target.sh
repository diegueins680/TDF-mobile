#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$MOBILE_DIR"

python3 - <<'PY'
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

mobile_dir = Path.cwd()
android_outputs = mobile_dir / "android" / "app" / "build" / "outputs"
ios_build_dir = mobile_dir / "ios" / "build"
source_roots = [
    mobile_dir / "app",
    mobile_dir / "components",
    mobile_dir / "lib",
    mobile_dir / "providers",
    mobile_dir / "src",
    mobile_dir / "android" / "app" / "src",
    mobile_dir / "ios",
    mobile_dir / "app.config.ts",
    mobile_dir / "package.json",
]
ignored_source_prefixes = [
    mobile_dir / "ios" / "build",
]


def fmt_ts(ts: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S %z", time.localtime(ts))


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=mobile_dir, text=True).strip()


def installable_paths(root: Path, *, suffixes: set[str], include_app_dirs: bool = False) -> list[Path]:
    found: list[Path] = []
    if not root.exists():
        return found
    for path in root.rglob("*"):
        if not path.exists():
            continue
        if path.is_file() and path.suffix.lower() in suffixes:
            found.append(path)
        elif include_app_dirs and path.is_dir() and path.name.endswith(".app"):
            found.append(path)
    return sorted(set(found), key=lambda p: p.stat().st_mtime, reverse=True)


def is_ignored_source_path(path: Path) -> bool:
    for prefix in ignored_source_prefixes:
        try:
            path.relative_to(prefix)
            return True
        except ValueError:
            continue
    return False


def newer_source_files_since(ts: float) -> list[tuple[float, Path]]:
    stale_files: list[tuple[float, Path]] = []
    for root in source_roots:
        if not root.exists():
            continue
        if root.is_file():
            candidates = [root]
        else:
            candidates = [p for p in root.rglob("*") if p.is_file()]
        for path in candidates:
            if is_ignored_source_path(path):
                continue
            try:
                mtime = path.stat().st_mtime
            except FileNotFoundError:
                continue
            if mtime > ts:
                stale_files.append((mtime, path))
    stale_files.sort(key=lambda item: item[0])
    return stale_files


def shlex_quote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def bundle_id_for_app(app_path: Path) -> str | None:
    info_plist = app_path / "Info.plist"
    if not info_plist.exists():
        return None
    result = subprocess.run(
        ["plutil", "-extract", "CFBundleIdentifier", "raw", "-o", "-", str(info_plist)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    bundle_id = result.stdout.strip()
    return bundle_id or None


android_artifacts = installable_paths(android_outputs, suffixes={".apk"})
ios_artifacts = installable_paths(ios_build_dir, suffixes={".ipa"}, include_app_dirs=True)
all_artifacts = sorted(set(android_artifacts + ios_artifacts), key=lambda p: p.stat().st_mtime, reverse=True)

head = git_output("rev-parse", "HEAD")
head_date = git_output("show", "-s", "--format=%ci", "HEAD")
print(f"git_head={head}")
print(f"git_head_date={head_date}")

adb_path = shutil.which("adb")
print(f"adb_available={'true' if adb_path else 'false'}")
adb_devices: list[str] = []
if adb_path:
    adb_result = subprocess.run([adb_path, "devices", "-l"], capture_output=True, text=True, check=False)
    adb_output = (adb_result.stdout or "") + (adb_result.stderr or "")
    for raw_line in adb_output.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("List of devices attached"):
            continue
        if "\tdevice" in line:
            adb_devices.append(line)
    print(f"adb_connected_device_count={len(adb_devices)}")
    for line in adb_devices[:5]:
        print(f"adb_connected_device={line}")
    if adb_result.returncode != 0:
        print(f"adb_probe_status=exit-{adb_result.returncode}")
else:
    print("adb_connected_device_count=0")

xcrun_path = shutil.which("xcrun")
print(f"xcrun_available={'true' if xcrun_path else 'false'}")
booted_simulators: list[str] = []
if xcrun_path:
    simctl_result = subprocess.run(
        [xcrun_path, "simctl", "list", "devices", "booted", "--json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if simctl_result.returncode == 0 and simctl_result.stdout.strip():
        try:
            payload = json.loads(simctl_result.stdout)
        except json.JSONDecodeError:
            payload = {}
        for runtime, devices in payload.get("devices", {}).items():
            for device in devices:
                if device.get("state") != "Booted":
                    continue
                name = device.get("name", "unknown")
                udid = device.get("udid", "unknown")
                booted_simulators.append(f"{name} ({udid}) runtime={runtime}")
    else:
        print(f"booted_simulator_probe_status=exit-{simctl_result.returncode}")
print(f"booted_simulator_count={len(booted_simulators)}")
for entry in booted_simulators[:5]:
    print(f"booted_simulator={entry}")

if not all_artifacts:
    expected_output = android_outputs / "apk" / "debug" / "app-debug.apk"
    print("status=missing-installable-artifact")
    print(f"expected_rebuild_lane=cd {shlex_quote(str(mobile_dir / 'android'))} && ./gradlew assembleDebug")
    print(f"expected_output={expected_output}")
    print("android_artifact_status=missing")
    print("ios_artifact_status=missing")
    print("android_lane_runnable=false")
    print("ios_lane_runnable=false")
    print("workstation_blocker=current-build smoke target unavailable on this workstation")
    print("workstation_blocker_owner=tdf-label-platform")
    print("workstation_missing_prerequisite=fresh installable build plus one runnable local execution lane (adb-connected Android device/emulator or booted iOS simulator)")
    print("verdict=no local installable current-build target found")
    sys.exit(1)

artifact = all_artifacts[0]
artifact_mtime = artifact.stat().st_mtime
print(f"artifact_path={artifact}")
print(f"artifact_kind={artifact.suffix.lower() or '.app'}")
print(f"artifact_mtime={fmt_ts(artifact_mtime)}")
print(f"artifact_size_bytes={artifact.stat().st_size if artifact.is_file() else 0}")

if artifact.suffix.lower() == ".apk":
    install_command = f"adb install -r {shlex_quote(str(artifact))}"
else:
    install_command = f"open {shlex_quote(str(artifact))}"
print(f"exact_install_command={install_command}")

overall_stale_files = newer_source_files_since(artifact_mtime)

android_artifact = android_artifacts[0] if android_artifacts else None
ios_artifact = ios_artifacts[0] if ios_artifacts else None
android_artifact_current = False
ios_artifact_current = False
ios_launch_command: str | None = None

if android_artifact is None:
    print("android_artifact_status=missing")
else:
    android_mtime = android_artifact.stat().st_mtime
    android_stale_files = newer_source_files_since(android_mtime)
    print(f"android_artifact_path={android_artifact}")
    print(f"android_artifact_mtime={fmt_ts(android_mtime)}")
    print(f"android_exact_install_command=adb install -r {shlex_quote(str(android_artifact))}")
    if android_stale_files:
        print("android_artifact_status=stale")
        print(f"android_newer_source_count={len(android_stale_files)}")
        for _, path in android_stale_files[:10]:
            print(f"android_newer_source={path.relative_to(mobile_dir)}")
        print(f"android_expected_rebuild_lane=cd {shlex_quote(str(mobile_dir / 'android'))} && ./gradlew assembleDebug")
        print(f"android_expected_output={android_outputs / 'apk' / 'debug' / 'app-debug.apk'}")
    else:
        print("android_artifact_status=current")
        android_artifact_current = True

if ios_artifact is None:
    print("ios_artifact_status=missing")
else:
    ios_mtime = ios_artifact.stat().st_mtime
    ios_stale_files = newer_source_files_since(ios_mtime)
    print(f"ios_artifact_path={ios_artifact}")
    print(f"ios_artifact_kind={ios_artifact.suffix.lower() or '.app'}")
    print(f"ios_artifact_mtime={fmt_ts(ios_mtime)}")
    if ios_artifact.name.endswith('.app'):
        bundle_id = bundle_id_for_app(ios_artifact)
        if bundle_id:
            print(f"ios_bundle_id={bundle_id}")
            print(f"ios_exact_install_command=xcrun simctl install booted {shlex_quote(str(ios_artifact))}")
            ios_launch_command = f"xcrun simctl launch booted {bundle_id}"
            print(f"ios_exact_launch_command={ios_launch_command}")
            if "Debug-iphonesimulator" in str(ios_artifact):
                metro_command = f"cd {shlex_quote(str(mobile_dir))} && npx expo start --dev-client --host localhost"
                print("ios_launch_contract_mode=packager-backed-debug")
                print(f"ios_required_packager_command={metro_command}")
                print("ios_required_packager_reason=debug simulator build requires Metro; launching without it can fail with No script URL provided")
                print(f"ios_smoke_sequence_step_1={metro_command}")
                print(f"ios_smoke_sequence_step_2=xcrun simctl install booted {shlex_quote(str(ios_artifact))}")
                print(f"ios_smoke_sequence_step_3={ios_launch_command}")
    if ios_stale_files:
        print("ios_artifact_status=stale")
        print(f"ios_newer_source_count={len(ios_stale_files)}")
        for _, path in ios_stale_files[:10]:
            print(f"ios_newer_source={path.relative_to(mobile_dir)}")
    else:
        print("ios_artifact_status=current")
        ios_artifact_current = True

android_lane_runnable = android_artifact_current and bool(adb_devices)
ios_lane_runnable = ios_artifact_current and bool(booted_simulators) and ios_launch_command is not None
print(f"android_lane_runnable={'true' if android_lane_runnable else 'false'}")
print(f"ios_lane_runnable={'true' if ios_lane_runnable else 'false'}")

if android_artifact is not None:
    if not android_artifact_current:
        print("android_missing_prerequisite=fresh app-debug.apk")
    elif not adb_path:
        print("android_missing_prerequisite=adb")
    elif not adb_devices:
        print("android_missing_prerequisite=connected Android device or emulator")

if ios_artifact is not None or xcrun_path:
    if not ios_artifact_current:
        print("ios_missing_prerequisite=current .app build")
    elif not booted_simulators:
        print("ios_missing_prerequisite=booted iOS simulator")
    elif ios_launch_command is None:
        print("ios_missing_prerequisite=discoverable iOS bundle id")

if android_lane_runnable:
    print("workstation_smoke_target=android")
    print(f"workstation_smoke_target_path={android_artifact}")
    print(f"workstation_smoke_target_command=adb install -r {shlex_quote(str(android_artifact))}")
    print(f"workstation_smoke_target_context={adb_devices[0]}")
    print("status=current-runnable-smoke-target")
    print("verdict=release smoke can start from the current Android artifact on this workstation")
    sys.exit(0)

if ios_lane_runnable:
    print("workstation_smoke_target=ios")
    print(f"workstation_smoke_target_path={ios_artifact}")
    print(f"workstation_smoke_target_command=xcrun simctl install booted {shlex_quote(str(ios_artifact))}")
    print(f"workstation_smoke_target_launch={ios_launch_command}")
    print(f"workstation_smoke_target_context={booted_simulators[0]}")
    print("status=current-runnable-smoke-target")
    print("verdict=release smoke can start from the current iOS simulator artifact on this workstation")
    sys.exit(0)

print("workstation_smoke_target=unavailable")
print("workstation_blocker=current-build smoke target unavailable on this workstation")
print("workstation_blocker_owner=tdf-label-platform")
print("workstation_missing_prerequisite=fresh installable build plus one runnable local execution lane (adb-connected Android device/emulator or booted iOS simulator)")

if overall_stale_files:
    print("status=stale-installable-artifact")
    print(f"newer_source_count={len(overall_stale_files)}")
    for _, path in overall_stale_files[:10]:
        print(f"newer_source={path.relative_to(mobile_dir)}")
    print(f"expected_rebuild_lane=cd {shlex_quote(str(mobile_dir / 'android'))} && ./gradlew assembleDebug")
    print(f"expected_output={android_outputs / 'apk' / 'debug' / 'app-debug.apk'}")
    print("verdict=installable artifact exists but there is still no runnable current-build smoke target on this workstation")
    sys.exit(2)

print("status=current-installable-artifact-but-no-runnable-lane")
print("verdict=installable artifact exists but no runnable local execution lane is available on this workstation")
sys.exit(3)
PY
