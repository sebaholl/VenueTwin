"""Run from repo root: PYTHONPATH=services/planner python services/planner/export_schema.py"""
import json
from pathlib import Path
from venuetwin_planner.contract import VenueDocument

path = Path(__file__).resolve().parents[2] / 'contracts/venue-production-v1.schema.json'
schema = VenueDocument.model_json_schema()
schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
schema['$id'] = 'urn:venuetwin:production:1.x'
path.write_text(json.dumps(schema, indent=2) + '\n')
