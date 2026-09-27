#!/usr/bin/env python3
"""Raise the Photo Atlas version by 0.1: photoatlas_vX.Y.html becomes photoatlas_vX.(Y+1).html.

Renames the page with git mv (so its history follows), and updates VERSION inside it, the
redirect in index.html and the file name in README.md and CLAUDE.md. Once per release.

    python3 tools/bump.py            bump
    python3 tools/bump.py --dry-run  only show what would change
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    dry = '--dry-run' in sys.argv[1:]
    pages = sorted(ROOT.glob('photoatlas_v*.html'))
    if len(pages) != 1:
        sys.exit(f'expected exactly one photoatlas_v*.html, found {len(pages)}')
    old = pages[0]
    m = re.fullmatch(r'photoatlas_v(\d+)\.(\d)\.html', old.name)
    if not m:
        sys.exit(f'unexpected file name {old.name}')
    major, minor = int(m[1]), int(m[2]) + 1
    if minor == 10:
        major, minor = major + 1, 0
    was, now = f'{m[1]}.{m[2]}', f'{major}.{minor}'
    new = ROOT / f'photoatlas_v{now}.html'

    page = old.read_text(encoding='utf-8')
    marker = f"const VERSION = '{was}';"
    if page.count(marker) != 1:
        sys.exit(f'{old.name} should contain {marker} exactly once')
    changes = [(old, page.replace(marker, f"const VERSION = '{now}';"))]
    for name in ('index.html', 'README.md', 'CLAUDE.md'):
        path = ROOT / name
        if path.exists():
            text = path.read_text(encoding='utf-8')
            if old.name in text:
                changes.append((path, text.replace(old.name, new.name)))

    print(f'{old.name} -> {new.name}')
    for path, _ in changes:
        print('  updates', path.relative_to(ROOT))
    if dry:
        return
    for path, text in changes:
        path.write_text(text, encoding='utf-8')
    subprocess.run(['git', 'mv', old.name, new.name], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
