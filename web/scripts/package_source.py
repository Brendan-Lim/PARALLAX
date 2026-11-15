"""Archive a clean committed public baseline to a new destination outside the checkout."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ROOT_FILES = {'.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
    'AI_DISCLOSURE.md', 'ARCHITECTURE.md', 'ATTRIBUTION.md', 'DATA_PROVENANCE.md',
    'LICENSE_REVIEW.md', 'LIMITATIONS.md', 'PUBLICATION_INVENTORY.json',
    'PUBLIC_EDITION_VERIFICATION.md', 'QUICKSTART.md', 'REPRODUCIBILITY.md',
    'SCIENTIFIC_FOUNDATION.md', 'SI_METADATA.json'}
DOC_FILES = {
    'ARCHITECTURE.md', 'DEVICE_FORMATS.md', 'BASELINE.json', 'CHALLENGE_ALIGNMENT.md', 'DATA_SOURCES.md',
    'HUMAN_EVALUATION.md', 'IMAGE_ATTRIBUTIONS.json', 'LIMITATIONS.md', 'METHODS.md',
    'REFERENCE_RUBRIC.md', 'SCIENCE.md', 'VALIDATION.md',
    'evaluation/case-A.json', 'evaluation/case-B.json',
    'science/CHALLENGE_RETRIEVAL.json', 'science/RESEARCH_VALUES_FINAL.json',
    'science/RESEARCH_VALUES_V3.json', 'science/CLEMENT2024_TANDEM.json', 'science/SOURCE_LINK_CHECKS_V4.json',
    'science/SOURCE_MANIFEST_V4.json',
    'NASA_DATA.md', 'RELEASE_IDENTITY.md', 'ILLUSTRATION_PROMPTS.md',
    'images/01-landing-page.png', 'images/diagram-signal-quality-before-after.png',
}
WEB_FILES = {'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
             'playwright.config.ts', 'eslint.config.mjs', '.prettierrc.json',
             '.prettierignore', 'index.html'}
WEB_FOLDERS = {'src', 'tests', 'scripts', 'public'}
GENERATED = {'web/public/evaluation.txt', 'web/public/third-party-notices.txt'}
PATTERNS = {
    'workstation-path': rb'/(?:Users|home)/[A-Za-z0-9_.-]+|/private/(?:tmp|var)/',
    'credential': rb'(?<![A-Za-z0-9_-])(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',
    'personal-email': rb'(?<![\w.+-])[\w.+-]{1,80}@(?:gmail|hotmail|yahoo|outlook|protonmail)\.[A-Za-z]+',
}
# Marker checks on scanner source itself must not match the literal signatures it describes.
PATTERNS['participant-table'] = b'|'.join(re.escape(x) for x in [
    b'BEDREST_' + b'FTT_CFT70_', b'GroupName,' + b'Date,Test_Phase',
    b'egress_base,' + b'egress_post'])


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def inspect(name, data):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError(f'Unsafe member: {name}')
    allowed = name in ROOT_FILES
    if name.startswith('docs/'):
        allowed = name[5:] in DOC_FILES
    if name.startswith('web/'):
        suffix = name[4:]
        allowed = suffix in WEB_FILES or suffix.split('/')[0] in WEB_FOLDERS
    if not allowed or name in GENERATED:
        raise ValueError(f'File outside explicit public allowlist: {name}')
    if any(p in {'node_modules', 'test-results', '__pycache__', '.git'} for p in path.parts):
        raise ValueError(f'Generated/private path: {name}')
    limit = 3_000_000 if name == 'docs/images/01-landing-page.png' else 1_000_000
    if len(data) > limit:
        raise ValueError(f'Unexpected large tracked file: {name}')
    if path.suffix == '.webp':
        if not (data.startswith(b'RIFF') and data[8:12] == b'WEBP'):
            raise ValueError(f'Unexpected image format: {name}')
    elif path.suffix == '.png':
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError(f'Unexpected image format: {name}')
    else:
        data.decode('utf8')  # Other public members must be inspectable text.
    for label, pattern in PATTERNS.items():
        if re.search(pattern, data):
            raise ValueError(f'{label} requires review in {name}; matched value withheld')


def tracked_inventory():
    rows = []
    for raw in git('ls-files', '-z').split(b'\0'):
        if not raw:
            continue
        name = raw.decode(); path = ROOT / name
        if path.is_symlink():
            raise ValueError(f'Tracked symlink: {name}')
        data = path.read_bytes(); inspect(name, data)
        rows.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    if not rows:
        raise ValueError('No explicit tracked inputs')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--check', action='store_true', help='Inspect current explicit index file list without packaging')
    args = parser.parse_args()
    rows = tracked_inventory()
    if args.check:
        print(json.dumps({'result': 'pass', 'files': len(rows), 'inventory': rows}, indent=2))
        return
    if args.output is None:
        parser.error('--output is required unless --check is used')
    output = args.output.resolve(); sidecar = output.with_suffix(output.suffix + '.json')
    if output == ROOT or ROOT in output.parents:
        raise ValueError('Choose an output outside the application checkout')
    if output.exists() or sidecar.exists():
        raise ValueError('Refusing to overwrite an archive or its sidecar')
    if git('status', '--porcelain', '--untracked-files=normal').strip():
        raise ValueError('Commit the reviewed baseline and clear untracked source before packaging')
    commit = git('rev-parse', 'HEAD').decode().strip()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidental replacement even if the destination changes during validation.
    with output.open('xb') as stream:
        subprocess.run(['git', '-C', str(ROOT), 'archive', '--format=zip', commit], stdout=stream, check=True)
    expected = {row['path']: row for row in rows}
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        members = [i for i in archive.infolist() if not i.is_dir()]
        assert {i.filename for i in members} == set(expected)
        for member in members:
            data = archive.read(member); inspect(member.filename, data)
            assert hashlib.sha256(data).hexdigest() == expected[member.filename]['sha256']
    record = {'commit': commit, 'files': len(rows), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'archive': output.name, 'inventory': rows,
              'limits': 'Pattern screening complements manual content and rights review; it cannot prove absence of all sensitive content.'}
    with sidecar.open('x') as stream:
        json.dump(record, stream, indent=2); stream.write('\n')
    print(json.dumps({k: record[k] for k in ['commit', 'files', 'sha256', 'archive']}, indent=2))


if __name__ == '__main__':
    main()
