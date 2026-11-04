#!/bin/bash
# ABOUTME: Test double for `docker` in trufflehogExceptions.test.ts. Records argv and the modes of its stdout/stderr
# ABOUTME: targets to $FAKE_LOG, then replays $FAKE_OUT / $FAKE_ERR / $FAKE_RC. Never pulls or runs anything.
echo "$*" >> "$FAKE_LOG"
if [ "$1" = pull ]; then [ "${FAKE_PULL_FAIL:-}" = 1 ] && exit 1; echo pulled; exit 0; fi
o=$(readlink "/proc/$$/fd/1"); e=$(readlink "/proc/$$/fd/2")
echo "modes $(stat -c %a "$(dirname "$o")") $(stat -c %a "$o") $(stat -c %a "$e")" >> "$FAKE_LOG"
[ -n "${FAKE_OUT:-}" ] && printf '%s\n' "$FAKE_OUT"
[ -n "${FAKE_ERR:-}" ] && printf '%s\n' "$FAKE_ERR" >&2
exit "${FAKE_RC:-0}"
