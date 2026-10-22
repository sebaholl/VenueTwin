import json
import socket
from copy import deepcopy
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def denied(*args, **kwargs):
        raise AssertionError('Network calls are forbidden in planner tests')
    monkeypatch.setattr(socket.socket, 'connect', denied)
    monkeypatch.setattr(socket, 'create_connection', denied)


@pytest.fixture
def draft():
    return json.loads((ROOT / 'contracts/fixtures/legacy-draft.json').read_text())


@pytest.fixture
def complete(draft):
    value = deepcopy(draft)
    value['sources'][0]['kind'] = 'survey'
    value['sources'][0]['description'] = 'Synthetic test evidence only, not a real survey.'
    evidence = {'status': 'measured', 'source_ids': ['legacy-config'], 'uncertainty_m': 0.01}
    for group in ('levels', 'seats', 'structures'):
        for item in value[group]:
            item['evidence'] = deepcopy(evidence)
    for seat in value['seats']:
        seat['eye_position_m'] = [seat['position_m'][0], 1.15, seat['position_m'][2]]
    value['structures'][0]['kind'] = 'shell'
    value['stage_target_m'] = [0, 2, -3]
    value['stage_target_evidence'] = deepcopy(evidence)
    value['coverage'] = {key: deepcopy(evidence) for key in value['coverage']}
    return value
