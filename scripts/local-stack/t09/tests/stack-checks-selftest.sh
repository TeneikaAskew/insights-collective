#!/usr/bin/env bash
# ABOUTME: Offline selftest for stack-checks.sh: a fake `docker`/`ss` on PATH feeds fixed outputs, so every accept and refuse
# ABOUTME: path of ports, mail, leftovers and redact-scan is exercised without Docker. MOCKED inputs, not a runner result.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; RC=0
P=abcdefghijklmnopqrst   # 20-char stand-in project id (MOCKED)
mk() { # fake docker driven by files in $T/case
  cat > "$T/docker" <<SH
#!/usr/bin/env bash
case "\$1 \$2" in
  "ps --format") cat "$T/case/ps" ;;
  "ps -a") cat "$T/case/psa" ;;
  "volume ls") cat "$T/case/vol" ;;
  "network ls") cat "$T/case/net" ;;
  "inspect --format") case "\$4" in supabase_auth_*) cat "$T/case/authenv" ;; *) cat "$T/case/catcherenv" ;; esac ;;
esac
SH
  printf '#!/usr/bin/env bash\ncat "%s/case/ss"\n' "$T" > "$T/ss"; chmod +x "$T/docker" "$T/ss"
}
setcase() { rm -rf "$T/case"; mkdir "$T/case"; for f in ps psa vol net authenv catcherenv ss; do : > "$T/case/$f"; done; }
expect() { # id, want 0|1, fragment, command...
  local id="$1" want="$2" frag="$3"; shift 3; local out st
  out=$(PATH="$T:$PATH" "$@" 2>&1); st=$?
  if { [ "$want" = 0 ] && [ $st -eq 0 ]; } || { [ "$want" = 1 ] && [ $st -ne 0 ]; } && grep -q -- "$frag" <<<"$out" && ! grep -q "$P" <<<"$out"; then
    echo "PASS $id"; else echo "FAIL $id (exit $st): $(tail -2 <<<"$out" | tr '\n' ' ')"; RC=1; fi
}
mk
setcase; printf 'supabase_kong_%s\t127.0.0.1:54321->8000/tcp\nsupabase_db_%s\t127.0.0.1:54322->5432/tcp\nsupabase_inbucket_%s\t127.0.0.1:54324->8025/tcp, 1025/tcp\nsupabase_auth_%s\t9999/tcp\n' $P $P $P $P > "$T/case/ps"
expect ports-loopback-ok 0 'PASS ports: 4 stack containers' "$HERE/stack-checks.sh" ports
sed -i "s/127.0.0.1:54322/0.0.0.0:54322/" "$T/case/ps"
expect ports-wildcard-refused 1 "publishes 54322 on '0.0.0.0'" "$HERE/stack-checks.sh" ports
sed -i "s/0.0.0.0:54322/127.0.0.1:5432/" "$T/case/ps"
expect ports-unexpected-refused 1 'unexpected host port 5432' "$HERE/stack-checks.sh" ports
setcase; expect ports-none-refused 1 'no stack containers' "$HERE/stack-checks.sh" ports
setcase; printf 'supabase_auth_%s\nsupabase_inbucket_%s\n' $P $P > "$T/case/ps"
printf 'GOTRUE_JWT_SECRET=do-not-print\nGOTRUE_SMTP_HOST=supabase_inbucket_%s\nGOTRUE_SMTP_PORT=1025\n' $P > "$T/case/authenv"
expect mail-catcher-ok 0 'PASS mail' "$HERE/stack-checks.sh" mail
out=$(PATH="$T:$PATH" "$HERE/stack-checks.sh" mail 2>&1); grep -q do-not-print <<<"$out" && { echo "FAIL mail-prints-other-env"; RC=1; } || echo "PASS mail-prints-no-other-env"
sed -i 's/^GOTRUE_SMTP_HOST=.*/GOTRUE_SMTP_HOST=smtp.example.com/' "$T/case/authenv"
expect mail-external-refused 1 "GOTRUE_SMTP_HOST is 'smtp.example.com'" "$HERE/stack-checks.sh" mail
printf 'GOTRUE_SMTP_HOST=supabase_inbucket_%s\nGOTRUE_SMTP_PORT=587\n' $P > "$T/case/authenv"
expect mail-port-refused 1 "GOTRUE_SMTP_PORT is '587'" "$HERE/stack-checks.sh" mail
printf 'GOTRUE_SMTP_HOST=supabase_inbucket_%s\nGOTRUE_SMTP_PORT=1025\n' $P > "$T/case/authenv"; echo 'MP_SMTP_RELAY_HOST=smtp.example.com' > "$T/case/catcherenv"
expect mail-relay-refused 1 'relay configured' "$HERE/stack-checks.sh" mail
setcase; expect leftovers-clean 0 'PASS leftovers' "$HERE/stack-checks.sh" leftovers
echo "supabase_db_$P" > "$T/case/psa"; expect leftovers-container 1 'containers 1' "$HERE/stack-checks.sh" leftovers
setcase; echo "supabase_db_$P" > "$T/case/vol"; expect leftovers-volume 1 'volumes 1' "$HERE/stack-checks.sh" leftovers
setcase; echo "LISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*" | awk '{print $1" "$2" "$3" "$4" "$5}' > "$T/case/ss"; expect leftovers-listener 1 'listeners on 54320-54324: 1' "$HERE/stack-checks.sh" leftovers
mkdir "$T/ev"; echo "PASS something" > "$T/ev/ok.txt"
expect redact-clean 0 'PASS redact-scan: 1 file' "$HERE/stack-checks.sh" redact-scan "$T/ev"
echo "token eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig" > "$T/ev/jwt.txt"
expect redact-jwt 1 'credential-shaped content in' "$HERE/stack-checks.sh" redact-scan "$T/ev"
rm "$T/ev/jwt.txt"; echo "pw local-only-e2e-password" > "$T/ev/pw.txt"
expect redact-password 1 '1 file(s) carry' env E2E_TEST_PASSWORD=local-only-e2e-password "$HERE/stack-checks.sh" redact-scan "$T/ev"
rm "$T/ev/pw.txt"; echo "Authorization: Bearer abc" > "$T/ev/h.txt"
expect redact-bearer 1 '1 file(s) carry' "$HERE/stack-checks.sh" redact-scan "$T/ev"
echo "== stack-checks selftest (MOCKED docker/ss): $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
