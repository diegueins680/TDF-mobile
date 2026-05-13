#!/usr/bin/env bash
set -euo pipefail

# TDF Label — Release-iphonesimulator build script
# Fixes COCOAPODS_LOCALE_BUG and uses correct workspace invocation.

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

cd "$(dirname "$0")/../ios"

echo "=== Step 1: pod install ==="
pod install

echo "=== Step 2: Release xcodebuild ==="
xcodebuild \
  -workspace TDFRecords.xcworkspace \
  -scheme TDFRecords \
  -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -derivedDataPath ./build \
  build

echo "=== Step 3: Verify binary ==="
BINARY="./build/Build/Products/Release-iphonesimulator/TDFRecords.app/TDFRecords"
ls -lh "$BINARY"
echo "Release build complete: $BINARY"
