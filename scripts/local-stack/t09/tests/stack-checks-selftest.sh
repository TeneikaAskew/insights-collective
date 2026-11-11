#!/usr/bin/env bash
# ABOUTME: Offline selftest for stack-checks.sh. Fake `docker`, `ss`, `find` and `grep` on PATH return fixed output AND
# ABOUTME: chosen exit codes, so every accept path and every failed-probe path is exercised. MOCKED inputs, not a runner.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; RC=0
SC="$HERE/stack-checks.sh"
P=abcdefghijklmnopqrst                      # 20-char stand-in project id (MOCKED)
SECRET=s3cr3t-value-never-printed           # appears in fixtures; must never appear in any output
mkdir "$T/bin"
# Fake docker: the key is the subcommand ("ps", "ps-a", "volume", "network", "inspect-auth", "inspect-catcher").
cat > "$T/bin/docker" <<'SH'
#!/usr/bin/env bash
case "$1" in
  ps) [ "$2" = -a ] && k=ps-a || k=ps ;;
  volume|network) k=$1 ;;
  inspect) case "$4" in supabase_auth_*) k=inspect-auth ;; *) k=inspect-catcher ;; esac ;;
esac
cat "$FAKE/$k.out" 2>/dev/null; [ -f "$FAKE/$k.err" ] && cat "$FAKE/$k.err" >&2
exit "$(cat "$FAKE/$k.rc" 2>/dev/null || echo 0)"
SH
printf '#!/usr/bin/env bash\ncat "$FAKE/ss.out" 2>/dev/null; exit "$(cat "$FAKE/ss.rc" 2>/dev/null || echo 0)"\n' > "$T/bin/ss"
chmod +x "$T/bin/docker" "$T/bin/ss"
reset() { rm -rf "$T/case"; mkdir "$T/case"; }
set_() { printf '%b' "$2" > "$T/case/$1.out"; }   # key, content
rc() { echo "$2" > "$T/case/$1.rc"; }            # key, exit code
expect() { # id, want 0|1, fragment, command...
  local id="$1" want="$2" frag="$3"; shift 3; local out st
  out=$(FAKE="$T/case" PATH="$T/bin:$PATH" "$@" 2>&1); st=$?
  if { { [ "$want" = 0 ] && [ $st -eq 0 ]; } || { [ "$want" = 1 ] && [ $st -ne 0 ]; }; } && grep -qF -- "$frag" <<<"$out" \
     && ! grep -qE "$P|$SECRET|eyJhbGci|postgres:post" <<<"$out"; then echo "PASS $id"
  else echo "FAIL $id (exit $st): $(tail -2 <<<"$out" | tr '\n' ' ')"; RC=1; fi
}
GOOD_PS="supabase_kong_$P\t127.0.0.1:54321->8000/tcp\nsupabase_db_$P\t127.0.0.1:54322->5432/tcp\nsupabase_inbucket_$P\t127.0.0.1:54324->8025/tcp, 1025/tcp\nsupabase_auth_$P\t9999/tcp\n"

# ---- ports ----
reset; set_ ps "$GOOD_PS";                         expect ports-loopback-ok 0 'PASS ports: 4 stack containers' "$SC" ports
set_ ps "${GOOD_PS/127.0.0.1:54322/0.0.0.0:54322}"; expect ports-wildcard-refused 1 "publishes 54322 on '0.0.0.0'" "$SC" ports
set_ ps "${GOOD_PS/127.0.0.1:54322/127.0.0.1:5432}"; expect ports-unexpected-refused 1 'unexpected host port 5432' "$SC" ports
reset;                                              expect ports-empty-success-refused 1 'no stack container is running' "$SC" ports
reset; set_ ps "$GOOD_PS"; rc ps 1;                 expect ports-docker-failure-refused 1 "FAIL probe 'docker ps' exited 1" "$SC" ports

# ---- mail ----
mailcase() { reset; set_ ps "supabase_auth_$P\nsupabase_inbucket_$P\n"
  set_ inspect-auth "GOTRUE_JWT_SECRET=$SECRET\nGOTRUE_SMTP_HOST=supabase_inbucket_$P\nGOTRUE_SMTP_PORT=1025\n"
  set_ inspect-catcher "MP_SMTP_AUTH_ACCEPT_ANY=1\n"; }
mailcase;                                            expect mail-catcher-ok 0 'PASS mail' "$SC" mail
mailcase; set_ inspect-auth "GOTRUE_SMTP_HOST=smtp.example.com\nGOTRUE_SMTP_PORT=1025\n"; expect mail-external-refused 1 "GOTRUE_SMTP_HOST is 'smtp.example.com'" "$SC" mail
mailcase; set_ inspect-auth "GOTRUE_SMTP_HOST=supabase_inbucket_$P\nGOTRUE_SMTP_PORT=587\n"; expect mail-port-refused 1 "GOTRUE_SMTP_PORT is '587'" "$SC" mail
mailcase; set_ inspect-catcher "MP_SMTP_RELAY_HOST=smtp.example.com\n"; expect mail-relay-refused 1 'relay configured' "$SC" mail
mailcase; rc inspect-auth 1;                         expect mail-auth-inspect-failure 1 "FAIL probe 'docker inspect' exited 1" "$SC" mail
mailcase; rc inspect-catcher 1;                      expect mail-catcher-inspect-failure-not-zero-relay 1 "FAIL probe 'docker inspect' exited 1" "$SC" mail
mailcase; set_ inspect-catcher "";                   expect mail-catcher-empty-env-refused 1 'cannot prove there is no relay' "$SC" mail
mailcase; rc ps 1;                                   expect mail-docker-ps-failure 1 "FAIL probe 'docker ps' exited 1" "$SC" mail

# ---- leftovers ----
reset;                                               expect leftovers-clean 0 'PASS leftovers' "$SC" leftovers
for k in ps-a volume network ss; do reset; rc "$k" 1; expect "leftovers-$k-failure-not-zero" 1 'FAIL probe' "$SC" leftovers; done
reset; set_ ps-a "supabase_db_$P\n";                 expect leftovers-container 1 'containers 1' "$SC" leftovers
reset; set_ volume "supabase_db_$P\n";               expect leftovers-volume 1 'volumes 1' "$SC" leftovers
reset; set_ ss "LISTEN 0 4096 127.0.0.1:54322 0.0.0.0:*\n"; expect leftovers-listener 1 'listeners on 54320-54324: 1' "$SC" leftovers

# ---- a failing probe never emits its stderr (review 13:33Z): synthetic secrets on stderr, exit 1, must stay absent ----
MARK=FAKE_REVIEW_MARKER
leak_err() { printf 'password=%s\npostgresql://u:%s@127.0.0.1:1/x\nAuthorization: Bearer %s\n%s\n' "$MARK" "$MARK" "$MARK" "$MARK" > "$T/case/$1.err"; rc "$1" 1; }
for sub in leftovers ports mail; do
  for k in ps ps-a volume network ss inspect-auth inspect-catcher; do
    reset; [ $sub = mail ] && { set_ ps "supabase_auth_$P\nsupabase_inbucket_$P\n"; set_ inspect-auth "GOTRUE_SMTP_HOST=supabase_inbucket_$P\nGOTRUE_SMTP_PORT=1025\n"; set_ inspect-catcher "X=1\n"; }
    [ $sub = ports ] && set_ ps "$GOOD_PS"
    if [ $k = ss ]; then printf '%s\n' "password=$MARK" > "$T/case/ss.err"; rc ss 1; printf '#!/usr/bin/env bash\ncat "$FAKE/ss.err" >&2 2>/dev/null; exit "$(cat "$FAKE/ss.rc" 2>/dev/null || echo 0)"\n' > "$T/bin/ss"; chmod +x "$T/bin/ss"; else leak_err $k; fi
    out=$(FAKE="$T/case" PATH="$T/bin:$PATH" "$SC" $sub 2>&1); st=$?
    if grep -q "probe '" <<<"$out"; then
      [ $st -ne 0 ] && ! grep -q "$MARK" <<<"$out" && grep -q 'stderr withheld' <<<"$out" && echo "PASS probe-stderr-withheld $sub/$k" || { echo "FAIL probe-stderr-withheld $sub/$k (exit $st)"; RC=1; }
    fi
  done
done
printf '#!/usr/bin/env bash\ncat "$FAKE/ss.out" 2>/dev/null; exit "$(cat "$FAKE/ss.rc" 2>/dev/null || echo 0)"\n' > "$T/bin/ss"; chmod +x "$T/bin/ss"

# ---- stage-evidence (real find/grep unless a fake is placed) ----
ev() { rm -rf "$T/w"; mkdir -p "$T/w/ev"; cd "$T/w" || exit 2; echo "abc tested" > ids.txt; echo "PASS one" > ev/r1.txt; echo "PASS two" > ev/r2.txt; }
ev; expect evidence-ok 0 'PASS stage-evidence: 3 file(s) scanned and staged, 0 receipt(s) missing' "$SC" stage-evidence --require-all up ev/r1.txt ev/r2.txt -- ids.txt ev
( cd "$T/w/up" && sha256sum -c --quiet MANIFEST.sha256 ) && [ "$(wc -l < "$T/w/up/MANIFEST.sha256")" = 3 ] && echo "PASS evidence-manifest-verifies (3 entries)" || { echo "FAIL evidence-manifest"; RC=1; }
ev; expect evidence-missing-receipt-listed 0 'receipt MISSING or empty: ev/r3.txt' "$SC" stage-evidence up ev/r1.txt ev/r3.txt -- ids.txt ev
ev; expect evidence-missing-receipt-required 1 '1 expected receipt(s) missing on a successful job' "$SC" stage-evidence --require-all up ev/r3.txt -- ids.txt ev
ev; : > ev/r2.txt; expect evidence-empty-receipt-required 1 'missing on a successful job' "$SC" stage-evidence --require-all up ev/r2.txt -- ids.txt ev
ev; expect evidence-nonexistent-root 1 'root missing or unreadable: nope' "$SC" stage-evidence up -- ids.txt nope
ev; rm -f ev/*; expect evidence-no-files 1 'no files under the roots' "$SC" stage-evidence up -- ev
ev; ln -s /etc/hostname ev/link; expect evidence-symlink-refused 1 'non-regular file(s)' "$SC" stage-evidence up -- ev
ev; mkdir up; expect evidence-dest-exists 1 'destination exists' "$SC" stage-evidence up -- ev
for shape in "jwt|token eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig" "dsn|postgresql://postgres:$SECRET@127.0.0.1:54322/postgres" \
             "https-userinfo|https://u:$SECRET@example.invalid/x" "pgpassword|PGPASSWORD=$SECRET psql" "assignment|password=$SECRET" \
             "bearer|Authorization: Bearer $SECRET" "sb-secret|sb_secret_${SECRET}"; do
  ev; printf '%s\n' "${shape#*|}" > ev/leak.txt
  expect "evidence-${shape%%|*}-refused-not-echoed" 1 'credential-shaped content in: ev/leak.txt' "$SC" stage-evidence up -- ids.txt ev
  [ ! -e "$T/w/up" ] || { echo "FAIL evidence-${shape%%|*}: staged despite a hit"; RC=1; }
done
ev; echo "pw local-only-e2e-password" > ev/pw.txt; expect evidence-run-password-refused 1 'credential-shaped content in: ev/pw.txt' env E2E_TEST_PASSWORD=local-only-e2e-password "$SC" stage-evidence up -- ev
# A failing find or grep is a failed probe, never "no files" or "no hits".
printf '#!/usr/bin/env bash\necho "find: I/O error" >&2; exit 1\n' > "$T/bin/find"; chmod +x "$T/bin/find"
ev; expect evidence-find-error-refused 1 "FAIL probe 'find" "$SC" stage-evidence up -- ev; rm "$T/bin/find"
printf '#!/usr/bin/env bash\nexit 2\n' > "$T/bin/grep"; chmod +x "$T/bin/grep"
ev; out=$(PATH="$T/bin:$PATH" "$SC" stage-evidence up -- ev 2>&1); st=$?; rm "$T/bin/grep"
[ $st -ne 0 ] && grep -qF 'grep failed (2)' <<<"$out" && [ ! -e "$T/w/up" ] && echo "PASS evidence-grep-error-refused" || { echo "FAIL evidence-grep-error (exit $st): $out"; RC=1; }
cd "$T" || exit 2

# ---- redact ----
out=$(printf 'url postgresql://postgres:%s@127.0.0.1:54322/postgres key eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig name supabase_db_%s\n' "$SECRET" "$P" | "$SC" redact)
grep -qE "$SECRET|eyJhbGci|$P" <<<"$out" && { echo "FAIL redact-stream: $out"; RC=1; } || echo "PASS redact-stream ($out)"

echo "== stack-checks selftest (MOCKED docker/ss/find/grep): $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
