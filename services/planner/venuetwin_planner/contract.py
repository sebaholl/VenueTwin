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
Unit = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
UV = Annotated[list[Unit], Field(min_length=2, max_length=2)]


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
    vertical_fov_deg: Annotated[float, Field(ge=10, le=120, allow_inf_nan=False)] | None = None
    camera_source_id: Identifier | None = None

    @model_validator(mode='after')
    def camera_calibration(self):
        if (self.vertical_fov_deg is None) != (self.camera_source_id is None):
            raise ValueError('Calibrated FOV requires a photo source and vice versa')
        return self


class StructureMesh(StrictModel):
    """Local Y-up triangle mesh; structure position/yaw place it in the venue."""
    vertices_m: Annotated[list[Vector], Field(min_length=4, max_length=4096)]
    triangles: Annotated[list[list[Annotated[int, Field(strict=True, ge=0)]]], Field(min_length=4, max_length=8192)]
    triangle_uv: Annotated[list[list[UV]], Field(max_length=8192)] | None = None

    @model_validator(mode='after')
    def valid_triangles(self):
        if len({tuple(vertex) for vertex in self.vertices_m}) != len(self.vertices_m):
            raise ValueError('Duplicate mesh vertex')
        for triangle in self.triangles:
            if len(triangle) != 3 or len(set(triangle)) != 3 or max(triangle) >= len(self.vertices_m):
                raise ValueError('Mesh triangles require three distinct, existing vertices')
            a, b, c = (self.vertices_m[i] for i in triangle)
            u = [b[i] - a[i] for i in range(3)]
            v = [c[i] - a[i] for i in range(3)]
            cross = (u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0])
            if sum(x*x for x in cross) < 1e-12:
                raise ValueError('Degenerate mesh triangle')
        if len({tuple(sorted(face)) for face in self.triangles}) != len(self.triangles):
            raise ValueError('Duplicate mesh triangle')
        if self.triangle_uv is not None and (len(self.triangle_uv) != len(self.triangles) or any(len(face) != 3 for face in self.triangle_uv)):
            raise ValueError('Mesh UVs require three corners per triangle')
        return self


class SurfaceMaterial(StrictModel):
    id: Identifier
    name: Text
    base_color_linear: Annotated[list[Unit], Field(min_length=3, max_length=3)]
    roughness: Unit
    metallic: Unit
    base_color_texture_source_id: Identifier | None = None
    evidence: Evidence


class Structure(StrictModel):
    id: Identifier
    kind: Literal['shell', 'stage', 'obstruction', 'deck', 'other']
    position_m: Vector  # Box centre
    size_m: Size
    yaw_rad: Angle
    evidence: Evidence
    mesh: StructureMesh | None = None
    material_id: Identifier | None = None

    @model_validator(mode='after')
    def mesh_bounds(self):
        if self.mesh is not None:
            for axis in range(3):
                values = [vertex[axis] for vertex in self.mesh.vertices_m]
                half = self.size_m[axis] / 2
                if abs(min(values) + half) > 1e-4 or abs(max(values) - half) > 1e-4:
                    raise ValueError('Mesh local bounds must match structure size and centre')
        return self


class Coverage(StrictModel):
    scale: Evidence
    seat_inventory: Evidence
    occluders: Evidence  # Explicitly measured absence can be valid.
    materials: Evidence
    lighting: Evidence


class VenueDocument(StrictModel):
    format: Literal['venuetwin-production']
    version: Literal['1.0.0', '1.1.0', '1.2.0', '1.3.0']
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
    materials: Annotated[list[SurfaceMaterial], Field(max_length=100)] = []
    stage_target_m: Vector | None
    stage_target_evidence: Evidence
    coverage: Coverage

    @model_validator(mode='after')
    def references(self):
        if self.version == '1.0.0' and any(structure.mesh is not None for structure in self.structures):
            raise ValueError('Measured meshes require production contract 1.1.0')
        if self.version not in ('1.2.0', '1.3.0') and (self.materials or any(structure.material_id is not None for structure in self.structures)):
            raise ValueError('Surface materials require production contract 1.2.0')
        if self.version != '1.3.0' and (any(material.base_color_texture_source_id is not None for material in self.materials) or any(structure.mesh is not None and structure.mesh.triangle_uv is not None for structure in self.structures)):
            raise ValueError('Photo textures and UVs require production contract 1.3.0')
        for name in ('sources', 'levels', 'seats', 'structures'):
            values = getattr(self, name)
            if len({item.id for item in values}) != len(values):
                raise ValueError(f'Duplicate {name} ID')
        levels = {item.id for item in self.levels}
        sources = {item.id for item in self.sources}
        materials = {item.id for item in self.materials}
        if len(materials) != len(self.materials):
            raise ValueError('Duplicate material ID')
        if any(item.material_id is not None and item.material_id not in materials for item in self.structures):
            raise ValueError('Unknown structure material')
        labels = [(s.level_id, s.row_label, s.label) for s in self.seats]
        if len(set(labels)) != len(labels):
            raise ValueError('Duplicate seat label within a level and row')
        if any(s.level_id not in levels for s in self.seats):
            raise ValueError('Unknown seat level')
        evidence = [x.evidence for x in [*self.levels, *self.seats, *self.structures, *self.materials]]
        evidence.append(self.stage_target_evidence)
        evidence += [getattr(self.coverage, k) for k in type(self.coverage).model_fields]
        if any(source not in sources for item in evidence for source in item.source_ids):
            raise ValueError('Unknown evidence source')
        photo_sources = {s.id for s in self.sources if s.kind == 'photo'}
        if any(material.base_color_texture_source_id is not None and
               (material.base_color_texture_source_id not in photo_sources or material.base_color_texture_source_id not in material.evidence.source_ids)
               for material in self.materials):
            raise ValueError('Texture requires its own photo source in material evidence')
        textured = {material.id for material in self.materials if material.base_color_texture_source_id is not None}
        if any(structure.material_id in textured and (structure.mesh is None or structure.mesh.triangle_uv is None) for structure in self.structures):
            raise ValueError('Textured structure requires measured mesh triangle UVs')
        if any(material.evidence.status == 'documented' and not photo_sources.intersection(material.evidence.source_ids) for material in self.materials):
            raise ValueError('Documented surface material requires a photo source')
        if any(seat.camera_source_id is not None and seat.camera_source_id not in photo_sources for seat in self.seats):
            raise ValueError('Camera calibration requires a photo source')
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
    for material in sorted(venue.materials, key=lambda item: item.id):
        if material.evidence.status not in ('documented', 'measured'):
            add(f'/materials/{material.id}/evidence', 'evidence_required', 'Supply a source-linked appearance reference.')
    return sorted(found, key=lambda item: (item.path, item.code))
