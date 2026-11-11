#!/usr/bin/env python3
"""Local qualification only. Default preflight never creates a container.
Reuses the pinned prior composed-schema inputs and transport without modifying them.
No remote database/DSN option, network access, image pull, credentials or CLI migration command.
"""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile, time
parser = argparse.ArgumentParser()
parser.add_argument('--execute', action='store_true')
args = parser.parse_args()
here = pathlib.Path(__file__).resolve().parent
baseline = pathlib.Path('/workspace/course-copy-fidelity')
manifest = baseline / 'docs/design/course-copy-receipt-proposal/composed/inputs.sha256'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(manifest) == 'e97bae94e07a4f4f56536770f7ad838ff44e2f07d5761856edd1718c67f334a3'
assert subprocess.check_output(['git','-C',str(baseline),'rev-parse','HEAD'], text=True).strip() == 'c9cae61c086e4a46a3a3817b86828a347d78b8e9'
entries = {}
for line in manifest.read_text().splitlines():
    digest, name = line.split(None, 1)
    path = pathlib.Path(name)
    assert not path.is_absolute() and '..' not in path.parts
    assert sha(baseline / path) == digest
    entries[name] = digest
for name in ['candidate.sql','test.sql','run.py']:
    entries['policy-test/' + name] = sha(here/name)
env = dict(os.environ)
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:
    env.pop(key, None)
docker = ['docker','--host=unix:///var/run/docker.sock']
def dk(*argv):
    return subprocess.check_output(docker + list(argv), env=env, text=True).strip()
image = 'postgres@sha256:e8a07d2c7579b038938cdba6c539e580e5001caf9ea203d397b5cc83e76bd938'
assert dk('image','inspect',image,'--format','{{.Id}}') == 'sha256:6a35283e53fbe883da6a6ffbce8d3999dc66076cc5c4e2f1d21bdbd9e26bf86f'
print('Pinned inputs and local image verified; no container created.', flush=True)
if not args.execute:
    raise SystemExit(0)
out = pathlib.Path(tempfile.mkdtemp(prefix='module-policy-evidence.', dir='/workspace'))
stage = out / 'inputs'; stage.mkdir()
for name, digest in entries.items():
    src = here / pathlib.Path(name).name if name.startswith('policy-test/') else baseline/name
    dest = stage / name; dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dest)
    assert sha(dest) == digest
(out/'input-hashes.json').write_text(json.dumps(entries, indent=2))
name = 'receipt-composed-snapshot-' + out.name.rsplit('.',1)[1]
assert not dk('ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
cid = None
print('Evidence: '+str(out), flush=True)
def guard():
    data = json.loads(dk('inspect',cid))[0]
    assert data['Id'] == cid and data['Config']['Labels']['course-copy-test'] == 'receipt-composed'
    assert data['HostConfig']['NetworkMode'] == 'none' and not data['HostConfig']['PortBindings']
    assert not data['HostConfig']['Privileged']
    mounts = data['Mounts']
    binds = [m for m in mounts if m['Type']=='bind']
    assert len(binds)==1 and binds[0]['Source']==str(stage) and binds[0]['Destination']==str(stage) and not binds[0]['RW']
    assert '/var/lib/postgresql/data' in data['HostConfig']['Tmpfs']
    return {'id':cid,'network':'none','ports':data['HostConfig']['PortBindings'],'mounts':mounts,'tmpfs':data['HostConfig']['Tmpfs']}
def run_log(argv, filename, run_env=env, timeout=None):
    with (out/filename).open('w') as log:
        subprocess.run(argv, env=run_env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=timeout)
try:
    cid = dk('create','--pull','never','--name',name,'--label','course-copy-test=receipt-composed',
        '--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',
        '--mount',f'type=bind,src={stage},dst={stage},readonly',image)
    assert re.fullmatch('[0-9a-f]{64}',cid)
    (out/'container-id.txt').write_text(cid+'\n')
    (out/'isolation.json').write_text(json.dumps(guard(),indent=2))
    dk('start',cid)
    for attempt in range(30):
        ready = subprocess.run(docker+['exec',cid,'pg_isready','-U','postgres'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if ready.returncode == 0: break
        time.sleep(1)
    else: raise RuntimeError('Owned PostgreSQL did not become ready')
    guard(); dk('exec',cid,'createdb','-U','postgres','receipt_composed')
    transport = stage/'docs/design/course-copy-receipt-proposal/composed'
    run_env = dict(env, COPY_TEST_CONTAINER=name, COPY_TEST_CONTAINER_ID=cid, PATH=str(transport)+':'+env['PATH'], TMPDIR=str(out))
    assert shutil.which('psql',path=run_env['PATH']) == str(transport/'psql')
    dsn = 'postgresql://postgres@127.0.0.1:5432/receipt_composed'
    run_log(['node',str(stage/'scripts/local-db/assert-local-dsn.mjs'),dsn],'dsn-preflight.log',run_env)
    run_log(['bash',str(stage/'scripts/local-db/build-from-snapshot.sh'),dsn,str(stage/'scripts/local-stack/schema')],'replay.log',run_env)
    for i, repair in enumerate((transport/'repairs.list').read_text().splitlines()):
        assert repair in entries and re.fullmatch(r'supabase/migrations/202611[^/]+\.sql',repair)
        run_log([str(transport/'psql'),dsn,'-v','ON_ERROR_STOP=1','-f',str(stage/repair)],f'repair-{i}.log',run_env)
    guard(); run_log([str(transport/'psql'),dsn,'-At','-v','ON_ERROR_STOP=1','-f',str(stage/'policy-test/test.sql')], 'policy-tests.log',run_env,timeout=60)
    for path, digest in entries.items(): assert sha(stage/path)==digest
    (out/'result.json').write_text(json.dumps({'sql_exit':0,'inputs_unchanged':True,'production':False}))
finally:
    if cid:
        guard()
        (out/'cleanup.log').write_text(dk('rm','-fv',cid)+'\n')
    remaining = dk('ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
    assert not remaining, 'Cleanup uncertain: owned container remains'
    with (out/'cleanup.log').open('a') as log: log.write('Owned container absent; tmpfs destroyed.\n')
    print('Cleanup verified; evidence: '+str(out),flush=True)
