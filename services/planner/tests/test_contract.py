import json
from copy import deepcopy
import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError
from venuetwin_planner.contract import VenueDocument, missing_inputs
from conftest import ROOT


def test_schema_drift_and_cross_language_fixture(draft):
    schema = json.loads((ROOT / 'contracts/venue-production-v1.schema.json').read_text())
    expected = VenueDocument.model_json_schema()
    expected.update({'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': 'urn:venuetwin:production:1.0.0'})
    assert schema == expected
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(draft)
    VenueDocument.model_validate(draft)


@pytest.mark.parametrize('field,value', [('version', '2.0.0'), ('revision', True), ('revision', '1'), ('units', 'feet'), ('axes', 'z-up'), ('command', 'execute')])
def test_reject_invalid_envelope(draft, field, value):
    draft[field] = value
    with pytest.raises(ValidationError):
        VenueDocument.model_validate(draft)


@pytest.mark.parametrize('value', [True, '2', float('nan'), float('inf'), 501])
def test_reject_invalid_coordinates(draft, value):
    draft['seats'][0]['position_m'][0] = value
    with pytest.raises(ValidationError):
        VenueDocument.model_validate(draft)


@pytest.mark.parametrize('mutation', ['extra', 'duplicate', 'level', 'source', 'zero_size', 'missing', 'uncertainty', 'oversize'])
def test_semantic_rejections(draft, mutation):
    if mutation == 'extra': draft['seats'][0]['execute'] = 'anything'
    if mutation == 'duplicate': draft['seats'].append(deepcopy(draft['seats'][0]))
    if mutation == 'level': draft['seats'][0]['level_id'] = 'absent'
    if mutation == 'source': draft['seats'][0]['evidence']['source_ids'] = ['absent']
    if mutation == 'zero_size': draft['structures'][0]['size_m'][0] = 0
    if mutation == 'missing': del draft['seats'][0]['eye_position_m']
    if mutation == 'uncertainty': draft['seats'][0]['evidence']['status'] = 'measured'
    if mutation == 'oversize': draft['seats'] = draft['seats'] * 1001
    with pytest.raises(ValidationError):
        VenueDocument.model_validate(draft)


def test_requirements_are_stable_and_do_not_mutate(draft):
    venue = VenueDocument.model_validate(draft)
    before = venue.model_dump()
    first = missing_inputs(venue)
    assert first == missing_inputs(venue)
    assert [(r.path, r.code) for r in first] == sorted((r.path, r.code) for r in first)
    assert '/stage_target_m' in [r.path for r in first]
    assert '/seats/legacy-r0-s0/eye_position_m' in [r.path for r in first]
    assert venue.model_dump() == before
    venue.seats.reverse()
    venue.structures.reverse()
    assert missing_inputs(venue) == first


def test_complete_inputs_are_ready_for_review_only(complete):
    assert missing_inputs(VenueDocument.model_validate(complete)) == []


def test_legacy_concept_cannot_be_promoted_to_measurement(complete):
    complete['sources'][0]['kind'] = 'legacy-concept'
    with pytest.raises(ValidationError):
        VenueDocument.model_validate(complete)
