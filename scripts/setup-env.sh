#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source the Emscripten environment
source "$PROJECT_ROOT/emsdk/emsdk_env.sh"

# Execute the command passed as arguments
exec "$@"
