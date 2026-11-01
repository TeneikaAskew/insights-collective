#!/usr/bin/env bash
# ABOUTME: FAKE-only selftest for stack-net.mjs: a fake `docker` and `ss` on PATH (state in a temp dir) prove every refuse
# ABOUTME: path (old engine, bad name, existing or foreign network, option drift, extra membership, non-loopback listeners).
# No real Docker, network or daemon is touched. Each case also checks the fake's call log where it matters.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; mkdir "$T/bin" "$T/nets"
cat > "$T/bin/docker" <<'FAKE'
#!/usr/bin/env bash
S="$FAKE_STATE"; echo "docker $*" >> "$S/calls.log"
case "$1 ${2:-}" in
  "version --format") cat "$S/version"; exit 0 ;;
  "network inspect") [ -f "$S/nets/$3" ] && { cat "$S/nets/$3"; exit 0; } || { echo "no such network" >&2; exit 1; } ;;
  "network create")
    name="${@: -1}"; [ -f "$S/nets/$name" ] && exit 1
    label=$(sed -n 's/.*--label ic.t09.owner=\([^ ]*\).*/\1/p' <<<"$*")
    opt='{"com.docker.network.bridge.host_binding_ipv4":"127.0.0.1"}'; [ -f "$S/drift" ] && opt='{"com.docker.network.bridge.host_binding_ipv4":"127.0.0.1","com.docker.network.bridge.enable_ip_masquerade":"false"}'
    printf '{"Name":"%s","Driver":"bridge","Options":%s,"Labels":{"ic.t09.owner":"%s"},"Containers":%s}\n' "$name" "$opt" "$label" "$(cat "$S/members" 2>/dev/null || echo '{}')" > "$S/nets/$name"; exit 0 ;;
  "network rm") [ -f "$S/sticky" ] || rm -f "$S/nets/$3"; exit 0 ;;
  "ps --format") cat "$S/ps"; exit 0 ;;
  "inspect "*) cat "$S/cnet.$2"; exit 0 ;;
esac
echo "unexpected docker $*" >&2; exit 9
FAKE
printf '#!/usr/bin/env bash\ncat "$FAKE_STATE/ss"\n' > "$T/bin/ss"; chmod 700 "$T/bin/docker" "$T/bin/ss"
export FAKE_STATE="$T" PATH="$T/bin:$PATH"
N=ic-t09-old-net-41317521050-1; O=41317521050-1-old; pass=0; fail=0
reset() { rm -rf "$T/nets" "$T/drift" "$T/sticky" "$T/members" "$T/calls.log"; mkdir "$T/nets"; echo 28.1.1 > "$T/version"; }
expect() { # label want-exit cmd...
  local label="$1" want="$2"; shift 2; out=$(node "$HERE/stack-net.mjs" "$@" 2>&1); st=$?
  if [ $st -eq "$want" ]; then echo "PASS $label (exit $st) :: ${out##*$'\n'}"; pass=$((pass + 1)); else echo "FAIL $label: exit $st, want $want :: $out"; fail=$((fail + 1)); fi
}
creates() { cat "$T/calls.log" 2>/dev/null | grep -c 'network create'; }
reset; expect N1-create-ok 0 create $N $O
grep -q -- "-o com.docker.network.bridge.host_binding_ipv4=127.0.0.1" "$T/calls.log" && grep -q -- "--driver bridge" "$T/calls.log" && { echo "PASS N1b create argv carries exactly the documented option"; pass=$((pass+1)); } || { echo "FAIL N1b argv"; fail=$((fail+1)); }
reset; echo 27.5.1 > "$T/version"; expect N2-engine-27-refused 2 create $N $O; [ "$(creates)" = 0 ] && { echo "PASS N2b nothing created on old engine"; pass=$((pass+1)); } || { echo "FAIL N2b"; fail=$((fail+1)); }
reset; echo 'garbage' > "$T/version"; expect N3-unparseable-version 1 create $N $O
reset; expect N4-bad-name 2 create ic-other-net $O
reset; expect N4b-name-without-run-id 2 create ic-t09-old-net $O
reset; expect N5-bad-owner 2 create $N 'x y'
reset; node "$HERE/stack-net.mjs" create $N other-owner >/dev/null; : > "$T/calls.log"; expect N6-existing-not-adopted 2 create $N $O; [ "$(creates)" = 0 ] && { echo "PASS N6b no second create"; pass=$((pass+1)); } || { echo "FAIL N6b"; fail=$((fail+1)); }
reset; touch "$T/drift"; expect N7-option-drift 1 create $N $O
# verify: membership
reset; printf 'supabase_db_x\nsupabase_kong_x\nother\n' > "$T/ps"; echo '{"a":{},"b":{}}' > "$T/members"; node "$HERE/stack-net.mjs" create $N $O >/dev/null
echo "{\"$N\":{}}" > "$T/cnet.supabase_db_x"; echo "{\"$N\":{}}" > "$T/cnet.supabase_kong_x"; expect N8-verify-ok 0 verify $N $O
echo "{\"$N\":{},\"bridge\":{}}" > "$T/cnet.supabase_kong_x"; expect N9-extra-network 1 verify $N $O
echo "{\"supabase_network_x\":{}}" > "$T/cnet.supabase_kong_x"; expect N10-wrong-network 1 verify $N $O
echo "{\"$N\":{}}" > "$T/cnet.supabase_kong_x"; expect N11-foreign-owner 1 verify $N someone-else
printf 'other\n' > "$T/ps"; expect N12-no-stack 1 verify $N $O
# remove
reset; node "$HERE/stack-net.mjs" create $N $O >/dev/null; expect N13-remove-owned 0 remove $N $O; [ ! -f "$T/nets/$N" ] && { echo "PASS N13b absent after remove"; pass=$((pass+1)); } || { echo "FAIL N13b"; fail=$((fail+1)); }
reset; node "$HERE/stack-net.mjs" create $N other-owner >/dev/null; expect N14-foreign-left-untouched 2 remove $N $O; [ -f "$T/nets/$N" ] && ! grep -q 'network rm' "$T/calls.log" && { echo "PASS N14b foreign network not removed"; pass=$((pass+1)); } || { echo "FAIL N14b"; fail=$((fail+1)); }
reset; node "$HERE/stack-net.mjs" create $N $O >/dev/null; touch "$T/sticky"; expect N15-rm-not-effective 1 remove $N $O
reset; expect N16-remove-absent-ok 0 remove $N $O
# listeners (effective host sockets)
printf 'LISTEN 0 4096 127.0.0.1:54321 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:54324 0.0.0.0:*\n' > "$T/ss"; expect N17-listeners-loopback 0 listeners
printf 'LISTEN 0 4096 0.0.0.0:54321 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*\n' > "$T/ss"; expect N18-ipv4-any 1 listeners
printf 'LISTEN 0 4096 127.0.0.1:54321 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*\nLISTEN 0 4096 [::]:54322 [::]:*\n' > "$T/ss"; expect N19-ipv6-any 1 listeners
printf 'LISTEN 0 4096 127.0.0.1:54321 0.0.0.0:*\nLISTEN 0 4096 10.1.0.4:54324 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*\n' > "$T/ss"; expect N20-host-ip 1 listeners
printf 'LISTEN 0 4096 127.0.0.1:5432 0.0.0.0:*\n' > "$T/ss"; expect N21-vacuous-refused 1 listeners
echo "== stack-net selftest (FAKE docker/ss only): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
