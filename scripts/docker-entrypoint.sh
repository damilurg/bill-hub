#!/bin/sh
set -eu
umask 077
node scripts/preflight.mjs
exec node server.js
