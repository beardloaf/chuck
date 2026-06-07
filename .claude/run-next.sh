#!/bin/bash
# Wrapper so child processes spawned by Next.js (PostCSS worker, etc.) can find `node`.
export PATH="$HOME/.local/node/bin:$PATH"
exec /Users/mikula/.local/node/bin/node ./node_modules/next/dist/bin/next "$@"
