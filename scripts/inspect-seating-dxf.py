"""Extract auditable chair-feature candidates from a locally supplied DXF.

This is a measurement aid, not a seat/eye survey. Input and output stay local.
Requires ezdxf (`python3 -m pip install ezdxf`).
"""

import argparse
import hashlib
import json
import math
from pathlib import Path


def candidates(lines, feature_width_mm=400, tolerance_mm=1, bounds_mm=None):
    """Return unique midpoints of near-horizontal, specified-width CAD lines."""
    found = set()
    for start, end in lines:
        x1, y1 = start[0], start[1]
        x2, y2 = end[0], end[1]
        if not all(map(math.isfinite, (x1, y1, x2, y2))):
            continue
        if abs(y2 - y1) > tolerance_mm or abs(abs(x2 - x1) - feature_width_mm) > tolerance_mm:
            continue
        x, y = (x1 + x2) / 2, (y1 + y2) / 2
        if bounds_mm and not (bounds_mm[0] <= x <= bounds_mm[2] and bounds_mm[1] <= y <= bounds_mm[3]):
            continue
        found.add((round(x, 3), round(y, 3)))
    return sorted(found, key=lambda point: (-point[1], point[0]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dxf', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--feature-width-mm', type=float, default=400)
    parser.add_argument('--tolerance-mm', type=float, default=1)
    parser.add_argument('--bounds-mm', type=float, nargs=4, metavar=('MIN_X', 'MIN_Y', 'MAX_X', 'MAX_Y'))
    args = parser.parse_args()
    if args.feature_width_mm <= 0 or args.tolerance_mm <= 0:
        parser.error('Feature width and tolerance must be positive')
    if args.bounds_mm and (args.bounds_mm[0] >= args.bounds_mm[2] or args.bounds_mm[1] >= args.bounds_mm[3]):
        parser.error('Bounds must have increasing X and Y')
    try:
        import ezdxf
    except ImportError as exc:
        parser.error('Install the optional local dependency: python3 -m pip install ezdxf')
        raise exc
    drawing = ezdxf.readfile(args.dxf)
    units = drawing.header.get('$INSUNITS')
    if units != 4:
        parser.error(f'DXF $INSUNITS is {units}; expected 4 (millimetres)')
    entities = drawing.modelspace()
    non_lines = sum(entity.dxftype() != 'LINE' for entity in entities)
    points = candidates(((entity.dxf.start, entity.dxf.end) for entity in entities if entity.dxftype() == 'LINE'),
                        args.feature_width_mm, args.tolerance_mm, args.bounds_mm)
    result = {
        'format': 'venuetwin-cad-feature-study', 'version': 1,
        'source_sha256': hashlib.sha256(args.dxf.read_bytes()).hexdigest(),
        'source_units': 'mm', 'feature': 'horizontal-line-midpoint',
        'feature_width_mm': args.feature_width_mm, 'tolerance_mm': args.tolerance_mm,
        'bounds_mm': args.bounds_mm, 'candidate_count': len(points),
        'non_line_entity_count': non_lines,
        'candidates_xy_mm': points,
        'warning': 'CAD line midpoints are unverified chair features, not seat centres, seat IDs, eye positions, or a 1:1 certification.'
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(f"{len(points)} CAD feature candidates saved to {args.output}")


if __name__ == '__main__':
    main()
