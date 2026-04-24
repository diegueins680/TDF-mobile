#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$MOBILE_DIR"

python3 - <<'PY'
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

mobile_dir = Path.cwd()

candidate_roots = [
    mobile_dir / "android" / "app" / "build" / "outputs",
    mobile_dir / "ios" / "build",
]
installable_suffixes = {".apk", ".ipa", ".app"}
source_roots = [
    mobile_dir / "app",
    mobile_dir / "components",
    mobile_dir / "lib",
    mobile_dir / "providers",
    mobile_dir / "android" / "app" / "src",
    mobile_dir / "app.config.ts",
    mobile_dir / "package.json",
]

def fmt_ts(ts: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S %z", time.localtime(ts))


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=mobile_dir, text=True).strip()


artifacts: list[Path] = []
for root in candidate_roots:
    if not root.exists():
        continue
    for path in root.rglob("*"):
        if not path.exists():
            continue
        if path.suffix.lower() in installable_suffixes:
            artifacts.append(path)
        elif path.is_dir() and path.name.endswith(".app"):
            artifacts.append(path)

# De-duplicate .app directories that also appeared during recursive traversal.
artifacts = sorted(set(artifacts), key=lambda p: p.stat().st_mtime, reverse=True)

head = git_output("rev-parse", "HEAD")
head_date = git_output("show", "-s", "--format=%ci", "HEAD")

print(f"git_head={head}")
print(f"git_head_date={head_date}")

if not artifacts:
    expected_output = mobile_dir / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
    print("status=missing-installable-artifact")
    print(f"expected_rebuild_lane=cd '{mobile_dir / 'android'}' && ./gradlew assembleDebug")
    print(f"expected_output={expected_output}")
    print("verdict=no local installable current-build target found")
    sys.exit(1)

artifact = artifacts[0]
artifact_mtime = artifact.stat().st_mtime
print(f"artifact_path={artifact}")
print(f"artifact_kind={artifact.suffix.lower() or '.app'}")
print(f"artifact_mtime={fmt_ts(artifact_mtime)}")
print(f"artifact_size_bytes={artifact.stat().st_size if artifact.is_file() else 0}")

stale_files: list[tuple[float, Path]] = []
for root in source_roots:
    if not root.exists():
        continue
    if root.is_file():
        candidates = [root]
    else:
        candidates = [p for p in root.rglob("*") if p.is_file()]
    for path in candidates:
        try:
            mtime = path.stat().st_mtime
        except FileNotFoundError:
            continue
        if mtime > artifact_mtime:
            stale_files.append((mtime, path))

stale_files.sort(key=lambda item: item[0])
install_command = f"adb install -r '{artifact}'" if artifact.suffix.lower() == ".apk" else f"open '{artifact}'"
print(f"exact_install_command={install_command}")

if stale_files:
    print("status=stale-installable-artifact")
    print(f"newer_source_count={len(stale_files)}")
    for _, path in stale_files[:10]:
        print(f"newer_source={path.relative_to(mobile_dir)}")
    expected_output = mobile_dir / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
    print(f"expected_rebuild_lane=cd '{mobile_dir / 'android'}' && ./gradlew assembleDebug")
    print(f"expected_output={expected_output}")
    print("verdict=installable artifact exists but is older than current mobile source; rebuild required before release smoke")
    sys.exit(2)

print("status=current-installable-artifact")
print("verdict=release smoke can start from this artifact path without additional artifact search")
PY
