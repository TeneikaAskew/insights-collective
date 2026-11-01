#!/usr/bin/env bash
# ABOUTME: Selftest for hermetic-dist.mjs: positive derivation on a real product build, then fixed-code negative controls.
# Usage: hermetic-dist-selftest.sh <product dist built from the pinned head>. Writes only under a fresh mktemp dir.
set -u
T="$(cd "$(dirname "$0")/.." && pwd)/hermetic-dist.mjs"; DIST="${1:?product dist}"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
pass=0; fail=0; ok() { echo "PASS $*"; pass=$((pass+1)); }; no() { echo "FAIL $*"; fail=$((fail+1)); }
expect() { local label="$1" want="$2"; shift 2; "$@" >"$W/out" 2>&1; local st=$?
  [ "$st" = "$want" ] && ok "$label (exit $st: $(head -1 "$W/out" | cut -c1-110))" || no "$label exit $st, wanted $want: $(head -1 "$W/out" | cut -c1-110)"; }
cp -r "$DIST" "$W/product"
expect "P1 make on the product build" 0 node "$T" make "$W/product" "$W/served"
expect "P2 verify the derivation" 0 node "$T" verify "$W/product" "$W/served"
d=$(diff "$W/product/index.html" "$W/served/index.html" | grep -c '^[<>]'); [ "$d" = 1 ] && ok "P3 index.html differs by exactly one removed line" || no "P3 index diff lines $d"
n=$(cd "$W/product" && find . -type f ! -name index.html | while read -r f; do cmp -s "$f" "$W/served/$f" || echo "$f"; done | wc -l); [ "$n" = 0 ] && ok "P4 every non-index file byte-identical" || no "P4 $n files differ"
expect "N1 served dir exists" 13 node "$T" make "$W/product" "$W/served"
cp -r "$W/served" "$W/already"; rm "$W/already/HERMETIC-PROVENANCE.json"
expect "N2 input already lacks the line (count 0)" 11 node "$T" make "$W/already" "$W/o2"
cp -r "$W/product" "$W/dup"; sed -i 's|\(.*gptengineer.js.*\)|\1\n\1|' "$W/dup/index.html"
expect "N3 line duplicated" 11 node "$T" make "$W/dup" "$W/o3"
cp -r "$W/product" "$W/variant"; sed -i 's|gptengineer.js" type="module"|gptengineer.js?v=2" type="module"|' "$W/variant/index.html"
expect "N4 variant CDN tag (not the exact declared line)" 11 node "$T" make "$W/variant" "$W/o4"
cp -r "$W/product" "$W/extra"; sed -i 's|</head>|<link rel="stylesheet" href="https://fonts.example.test/x.css"></head>|' "$W/extra/index.html"
expect "N5 residual foreign stylesheet" 12 node "$T" make "$W/extra" "$W/o5"
cp -r "$W/product" "$W/proto"; sed -i 's|</body>|<img src="//cdn.example.test/p.png"></body>|' "$W/proto/index.html"
expect "N6 residual protocol-relative image" 12 node "$T" make "$W/proto" "$W/o6"
cp -r "$W/served" "$W/t1"; a=$(cd "$W/t1/assets" && ls *.js | head -1); printf '\n' >> "$W/t1/assets/$a"
expect "N7 one asset byte appended in served copy" 15 node "$T" verify "$W/product" "$W/t1"
cp -r "$W/served" "$W/t2"; echo x > "$W/t2/assets/extra.js"
expect "N8 extra file in served copy" 14 node "$T" verify "$W/product" "$W/t2"
cp -r "$W/served" "$W/t3"; sed -i 's|<div id="root"></div>|<div id="root" data-x="1"></div>|' "$W/t3/index.html"
expect "N9 other index.html edit" 16 node "$T" verify "$W/product" "$W/t3"
cp -r "$W/served" "$W/t4"; sed -i 's|NOT production bytes|production bytes|' "$W/t4/HERMETIC-PROVENANCE.json"
expect "N10 provenance label relabelled as production" 17 node "$T" verify "$W/product" "$W/t4"
cp -r "$W/served" "$W/t5"; rm "$W/t5/HERMETIC-PROVENANCE.json"
expect "N11 provenance missing" 17 node "$T" verify "$W/product" "$W/t5"
expect "N12 verify against the product build itself (unmodified bytes are not the served contract)" 17 node "$T" verify "$W/product" "$W/product"
echo "== hermetic-dist selftest (files only, no network): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
