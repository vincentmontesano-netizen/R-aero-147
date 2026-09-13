#!/usr/bin/env python3
"""Cold backup/restore of the bundled PostgreSQL + storage named volumes."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
from datetime import datetime, timezone

os.umask(0o077)
PATHS = {'database': '/var/lib/postgresql/data', 'storage': '/app/storage'}


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, stderr=subprocess.PIPE, **kwargs)


def inspect(kind, name):
    return json.loads(docker(kind, 'inspect', name, stdout=subprocess.PIPE).stdout)[0]


def helper(image, volume, command, writable=False, **kwargs):
    return docker('run', '--rm', '-i', '--network', 'none', '--mount',
                  f'type=volume,src={volume},dst=/source' + ('' if writable else ',readonly'),
                  '--entrypoint', command[0], image, *command[1:], **kwargs)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def validate_archive(path):
    # No links, device nodes or paths escaping the destination volume.
    with tarfile.open(path, 'r:gz') as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or not (member.isdir() or member.isfile()):
                raise ValueError('Archive contains unsupported paths or file types')


def assert_quiet(container, volumes, finished_at):
    state = inspect('container', container)['State']
    if state['Status'] != 'exited' or state['FinishedAt'] != finished_at:
        raise ValueError('Source container must remain stopped throughout backup')
    running = docker('ps', '-q', stdout=subprocess.PIPE).stdout.decode().split()
    for other in running:
        if any(m.get('Name') in volumes and m.get('RW') for m in inspect('container', other)['Mounts']):
            raise ValueError('Another running container can write a source volume')


def backup(args):
    source = inspect('container', args.container)
    volumes = {}
    for key, path in PATHS.items():
        mount = next((m for m in source['Mounts'] if m['Destination'] == path), None)
        if not mount or mount['Type'] != 'volume':
            raise ValueError('Backup requires the two standard named volume mounts')
        volumes[key] = mount['Name']
    finished_at = source['State']['FinishedAt']
    assert_quiet(args.container, volumes.values(), finished_at)
    image = source['Image']
    version = helper(image, volumes['database'], ['cat', '/source/PG_VERSION'], stdout=subprocess.PIPE).stdout.decode().strip()
    if not re.fullmatch(r'\d+', version):
        raise ValueError('Invalid PostgreSQL version')
    control = helper(image, volumes['database'], [f'/usr/lib/postgresql/{version}/bin/pg_controldata', '/source'], stdout=subprocess.PIPE).stdout.decode()
    if not re.search(r'Database cluster state:\s+shut down\s*$', control, re.M):
        raise ValueError('PostgreSQL must have shut down cleanly before backup')
    destination = Path(args.directory).resolve()
    destination.mkdir(mode=0o700)  # Never overwrite an existing backup.
    manifest = {'format': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'image': image, 'postgresVersion': version, 'files': {}}
    for key, volume in volumes.items():
        assert_quiet(args.container, volumes.values(), finished_at)
        path = destination / f'{key}.tar.gz'
        with path.open('xb') as output:
            helper(image, volume, ['tar', '-czpf', '-', '-C', '/source', '.'], stdout=output)
        validate_archive(path)
        manifest['files'][path.name] = digest(path)
    assert_quiet(args.container, volumes.values(), finished_at)
    # Only this final manifest marks a complete backup; failures leave an incomplete directory.
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Backup complete: {destination}')


def restore(args):
    directory = Path(args.directory).resolve()
    manifest = json.loads((directory / 'manifest.json').read_text())
    expected = {'database.tar.gz', 'storage.tar.gz'}
    if manifest.get('format') != 1 or set(manifest.get('files', {})) != expected:
        raise ValueError('Unsupported backup manifest')
    image = manifest['image']
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('Backup must identify its exact image')
    inspect('image', image)  # Require the same local image; never pull a mutable tag.
    for name in expected:
        path = directory / name
        if digest(path) != manifest['files'][name]:
            raise ValueError('Backup checksum mismatch')
        validate_archive(path)
    volumes = {'database': args.database_volume, 'storage': args.storage_volume}
    if len(set(volumes.values())) != 2 or any(not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]+', v) for v in volumes.values()):
        raise ValueError('Use two distinct valid new volume names')
    existing = docker('volume', 'ls', '-q', stdout=subprocess.PIPE).stdout.decode().splitlines()
    if any(v in existing for v in volumes.values()):
        raise ValueError('Restore refuses existing volumes, even empty ones')
    # Operator must reserve these names: Docker has no atomic create-if-absent volume API.
    for key, volume in volumes.items():
        docker('volume', 'create', volume, stdout=subprocess.PIPE)
        with (directory / f'{key}.tar.gz').open('rb') as source:
            helper(image, volume, ['tar', '-xzpf', '-', '-C', '/source'], writable=True, stdin=source, stdout=subprocess.PIPE)
    print('Restore complete into new volumes; source volumes were not modified.')
    print(f'Image required: {image}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='action', required=True)
    save = commands.add_parser('backup')
    save.add_argument('container'); save.add_argument('directory')
    recover = commands.add_parser('restore')
    recover.add_argument('directory'); recover.add_argument('database_volume'); recover.add_argument('storage_volume')
    args = parser.parse_args()
    try:
        (backup if args.action == 'backup' else restore)(args)
    except (ValueError, OSError, KeyError, tarfile.TarError, subprocess.CalledProcessError) as error:
        # Docker diagnostics can include operational data; don't dump captured stderr.
        reason = str(error) if isinstance(error, ValueError) else type(error).__name__
        parser.exit(1, f'Operation failed: {reason}. No completed backup/restore should be assumed.\n')
