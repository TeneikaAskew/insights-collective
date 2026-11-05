# ABOUTME: Writes expected-seed.txt, the exact SEED projection witness.sql must print right after the seed, from carrier.sql.in
# ABOUTME: and seed.sql. Run by hand when the seed changes; the selftest then checks the committed file matches this derivation.
import re, sys, os
F = os.path.join(os.path.dirname(__file__), '..')
src = open(os.path.join(F, 'carrier.sql.in')).read() + open(os.path.join(F, 'seed.sql')).read()
out = []
for m in re.finditer(r"\('(7150a000-[^']+)', '([^']+)', '([^']*)', 'data-science', 'beginner', (true|false), '([^']+)'\)", src):
    desc = 'ASSOC' if m.group(3) == 'rr-association:__NONCE__' else m.group(3)
    out.append(f"SEED course {m.group(1)} {m.group(2)} {desc} published={m.group(4)} instructor={m.group(5)}")
for m in re.finditer(r"\('(7150a000-[^']+)', '(7150a000-[^']+)', '([^']+)', (\d+), (true|false)\)", src):
    out.append(f"SEED module {m.group(1)} course={m.group(2)} {m.group(3)} position={m.group(4)} published={m.group(5)}")
for m in re.finditer(r"\('(7150a000-[^']+)', '(7150a000-[^']+)', '(7150a000-[^']+)', '(page)', '([^']+)', (\d+), (true|false)\)", src):
    out.append(f"SEED item {m.group(1)} course={m.group(2)} module={m.group(3)} {m.group(4)} {m.group(5)} position={m.group(6)} published={m.group(7)}")
for m in re.finditer(r"\('(7150a000-[^']+)', '([^']+@fixture\.invalid)', null,", src):
    out.append(f"SEED user {m.group(1)} {m.group(2)} password=false")
for m in re.finditer(r"\('(7150a000-0000-4000-8000-000000000(?:20\d|f01))', '([A-Za-z]+)', '([A-Za-z]+)'\)", src):
    out.append(f"SEED profile {m.group(1)} {m.group(2)} {m.group(3)}")
legacy = dict(re.findall(r"\('(7150a000-[^']+)'::uuid, (\d+)\)", src))
for m in re.finditer(r"\('(7150a000-0000-4000-8000-0000000003\d\d)', '([^']+)', '(7150a000-[^']+)', now\(\) - interval '(\d+) days'\)", src):
    out.append(f"SEED enrollment {m.group(1)} user={m.group(2)} course={m.group(3)} age_days={m.group(4)} completion_status={legacy[m.group(1)]}")
for m in re.finditer(r"\('(7150a000-0000-4000-8000-0000000004\d\d)', '([^']+)', '(7150a000-[^']+)', '(\w+)'\)", src):
    out.append(f"SEED progression {m.group(1)} user={m.group(2)} item={m.group(3)} {m.group(4)}")
out = sorted(set(out), key=lambda s: s.encode())
sys.stdout.write('\n'.join(out) + '\n')
