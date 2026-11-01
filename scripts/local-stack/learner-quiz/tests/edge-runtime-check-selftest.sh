#!/usr/bin/env bash
# ABOUTME: MOCKED self-test (fake docker on PATH) for edge-runtime-check.sh: the accept path and every refuse path.
# ABOUTME: Proves the check's logic only; it is not evidence about any real stack.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0; P=abcdefghijklmnopqrst
mkdir "$T/bin"; cat > "$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
[ -n "${FAKE_FAIL:-}" ] && { echo "boom secret" >&2; exit 7; }
case "$1" in
  ps) printf '%b' "$FAKE_PS" ;;
  inspect) case "$3" in *Networks*) printf '%b' "$FAKE_NETS" ;; *) printf '%b' "$FAKE_ENV" ;; esac ;;
esac
EOF
chmod +x "$T/bin/docker"
OKPS="supabase_db_$P\t127.0.0.1:54322->5432/tcp\nsupabase_kong_$P\t127.0.0.1:54321->8000/tcp\nsupabase_auth_$P\t\nsupabase_rest_$P\t\nsupabase_edge_runtime_$P\t8081/tcp\n"
run() { # label expect-exit grep-pattern env...
  local label="$1" want="$2" pat="$3"; shift 3
  env PATH="$T/bin:$PATH" FAKE_PS="$OKPS" FAKE_NETS="ownednet\n" FAKE_ENV="SUPABASE_URL=http://kong:8000\nSECRET_KEY=zzz\n" "$@" \
    bash "$HERE/edge-runtime-check.sh" ownednet > "$T/out" 2>&1; local st=$?
  if [ $st = "$want" ] && grep -qE "$pat" "$T/out" && ! grep -q "$P\|zzz\|boom" "$T/out"; then echo "PASS $label (exit $st)"; pass=$((pass+1)); else echo "FAIL $label (exit $st): $(cat "$T/out")"; fail=$((fail+1)); fi
}
run "E0 accept: one edge runtime, owned net only, no published port" 0 "^PASS edge"
run "E1 refuse: no edge runtime" 1 "exactly one" FAKE_PS="supabase_db_$P\t\n"
run "E2 refuse: two edge runtimes" 1 "exactly one" FAKE_PS="${OKPS}supabase_edge_runtime_zyxwvutsrqponmlkjihg\t\n"
run "E3 refuse: edge runtime publishes a host port" 1 "publishes a host port" FAKE_PS="supabase_edge_runtime_$P\t127.0.0.1:8081->8081/tcp\n"
run "E4 refuse: edge runtime also on another network" 1 "network" FAKE_NETS="ownednet\nbridge\n"
run "E5 refuse: unexpected stack container (studio)" 1 "unexpected stack container" FAKE_PS="${OKPS}supabase_studio_$P\t\n"
run "E6 refuse: SUPABASE_URL points outside the network" 1 "gateway" FAKE_ENV="SUPABASE_URL=https://x.example.com\n"
run "E7 refuse: docker probe fails (stderr withheld)" 1 "stderr withheld" FAKE_FAIL=1
echo "== edge-runtime-check selftest (MOCKED docker): $pass PASS, $fail FAIL"; [ $fail = 0 ]
