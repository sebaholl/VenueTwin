"""Canonical production contract. Never coerce, infer or repair geometry."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_.:-]+$')]
Text = Annotated[str, Field(min_length=1, max_length=500, pattern=r"\S")]
Coordinate = Annotated[float, Field(ge=-500, le=500, allow_inf_nan=False)]
Positive = Annotated[float, Field(gt=0, le=500, allow_inf_nan=False)]
Angle = Annotated[float, Field(ge=-6.283185307179586, le=6.283185307179586, allow_inf_nan=False)]
Vector = Annotated[list[Coordinate], Field(min_length=3, max_length=3)]
Size = Annotated[list[Positive], Field(min_length=3, max_length=3)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)


class Source(StrictModel):
    id: Identifier
    kind: Literal['survey', 'drawing', 'photo', 'legacy-concept']
    sha256: Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]
    description: Text


class Evidence(StrictModel):
    status: Literal['measured', 'documented', 'inferred', 'unknown']
    source_ids: Annotated[list[Identifier], Field(max_length=20)]
    uncertainty_m: Positive | None

    @model_validator(mode='after')
    def measured_evidence(self):
        if self.status in ('measured', 'documented') and not self.source_ids:
            raise ValueError('Measured/documented evidence requires a source')
        if self.status == 'measured' and self.uncertainty_m is None:
            raise ValueError('Measured evidence requires uncertainty_m')
        if len(set(self.source_ids)) != len(self.source_ids):
            raise ValueError('Duplicate evidence source')
        return self


class Level(StrictModel):
    id: Identifier
    name: Text
    elevation_m: Coordinate
    evidence: Evidence


class Seat(StrictModel):
    id: Identifier
    label: Text
    level_id: Identifier
    row_label: Text
    position_m: Vector  # Seat anchor, not eye or floor. Y is explicitly the anchor height.
    yaw_rad: Angle
    eye_position_m: Vector | None  # No eye-height default.
    evidence: Evidence


class Structure(StrictModel):
    id: Identifier
    kind: Literal['shell', 'stage', 'obstruction', 'deck', 'other']
    position_m: Vector  # Box centre
    size_m: Size
    yaw_rad: Angle
    evidence: Evidence


class Coverage(StrictModel):
    scale: Evidence
    seat_inventory: Evidence
    occluders: Evidence  # Explicitly measured absence can be valid.
    materials: Evidence
    lighting: Evidence


class VenueDocument(StrictModel):
    format: Literal['venuetwin-production']
    version: Literal['1.0.0']
    venue_id: Identifier
    revision: Annotated[int, Field(ge=1, le=9007199254740991)]
    name: Text
    units: Literal['metres']
    axes: Literal['right-handed-y-up']
    origin: Text
    sources: Annotated[list[Source], Field(max_length=100)]
    levels: Annotated[list[Level], Field(max_length=30)]
    seats: Annotated[list[Seat], Field(max_length=2000)]
    structures: Annotated[list[Structure], Field(max_length=2000)]
    stage_target_m: Vector | None
    stage_target_evidence: Evidence
    coverage: Coverage

    @model_validator(mode='after')
    def references(self):
        for name in ('sources', 'levels', 'seats', 'structures'):
            values = getattr(self, name)
            if len({item.id for item in values}) != len(values):
                raise ValueError(f'Duplicate {name} ID')
        levels = {item.id for item in self.levels}
        sources = {item.id for item in self.sources}
        labels = [(s.level_id, s.row_label, s.label) for s in self.seats]
        if len(set(labels)) != len(labels):
            raise ValueError('Duplicate seat label within a level and row')
        if any(s.level_id not in levels for s in self.seats):
            raise ValueError('Unknown seat level')
        evidence = [x.evidence for x in [*self.levels, *self.seats, *self.structures]]
        evidence.append(self.stage_target_evidence)
        evidence += [getattr(self.coverage, k) for k in type(self.coverage).model_fields]
        if any(source not in sources for item in evidence for source in item.source_ids):
            raise ValueError('Unknown evidence source')
        measured_sources = {s.id for s in self.sources if s.kind in ('survey', 'drawing')}
        if any(item.status == 'measured' and not measured_sources.intersection(item.source_ids) for item in evidence):
            raise ValueError('Measured evidence requires a survey or dimensioned drawing source')
        return self


class Requirement(StrictModel):
    path: str
    code: Literal['missing', 'measurement_required', 'evidence_required']
    message: str


def missing_inputs(venue: VenueDocument) -> list[Requirement]:
    """Stable sorted requirements; passing these is planning readiness, not certification."""
    found = []

    def add(path, code, message):
        found.append(Requirement(path=path, code=code, message=message))

    def measured(path, evidence):
        if evidence.status != 'measured':
            add(path, 'measurement_required', 'Supply a measured source and uncertainty in metres.')

    if not venue.levels:
        add('/levels', 'missing', 'Supply surveyed seating levels.')
    if not venue.seats:
        add('/seats', 'missing', 'Supply the complete seat inventory with stable IDs.')
    if not any(s.kind == 'shell' for s in venue.structures):
        add('/structures', 'missing', 'Supply measured room shell geometry.')
    if venue.stage_target_m is None:
        add('/stage_target_m', 'missing', 'Supply the measured stage viewing target.')
    measured('/stage_target_evidence', venue.stage_target_evidence)
    for name in ('scale', 'seat_inventory', 'occluders'):
        measured('/coverage/' + name, getattr(venue.coverage, name))
    for name in ('materials', 'lighting'):
        if getattr(venue.coverage, name).status not in ('measured', 'documented'):
            add('/coverage/' + name, 'evidence_required', 'Supply source-linked reference evidence.')
    for name in ('levels', 'seats', 'structures'):
        for item in sorted(getattr(venue, name), key=lambda x: x.id):
            measured(f'/{name}/{item.id}/evidence', item.evidence)
            if isinstance(item, Seat) and item.eye_position_m is None:
                add(f'/seats/{item.id}/eye_position_m', 'missing', 'Supply a measured seated-eye position.')
    return sorted(found, key=lambda item: (item.path, item.code))
