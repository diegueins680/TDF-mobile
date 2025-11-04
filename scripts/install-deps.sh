#!/usr/bin/env bash
set -euo pipefail
# Install runtime deps needed by the new mobile features
# Run from repo root:  bash ./scripts/install-deps.sh
npm i axios @tanstack/react-query react-native-calendars zod
echo "Done. If Expo prompts to re-build the native project for react-native-calendars, accept it."
