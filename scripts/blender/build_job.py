"""Trusted background entry point. Paths come from the local job server, not AI."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_venue import build


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2:
        raise ValueError('Expected blueprint and output paths.')
    blueprint, target = map(Path, args)
    if target.exists():
        raise ValueError('Output already exists.')
    print('VT_PROGRESS:Building architecture', flush=True)
    generated = build(blueprint)
    print('VT_PROGRESS:Finalizing model', flush=True)
    generated.replace(target)


if __name__ == '__main__':
    main()
