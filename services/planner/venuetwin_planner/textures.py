"""Bounded local PNG inputs for the offline Blender build; never fetch a URL."""
import hashlib
from pathlib import Path
import struct
import zlib

MAX_TEXTURE_BYTES = 4 * 1024 * 1024
MAX_TOTAL_BYTES = 16 * 1024 * 1024
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


def validate_png(data: bytes):
    if not PNG_SIGNATURE == data[:8] or len(data) > MAX_TEXTURE_BYTES:
        raise ValueError('Texture must be a PNG no larger than 4 MiB')
    offset, image_header, image_data, finished = 8, False, [], False
    while offset + 12 <= len(data):
        length = struct.unpack_from('>I', data, offset)[0]
        end = offset + 12 + length
        if end > len(data) or length > MAX_TEXTURE_BYTES:
            raise ValueError('Invalid PNG chunk length')
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack_from('>I', data, offset + 8 + length)[0]
        if zlib.crc32(kind + payload) != crc:
            raise ValueError('Invalid PNG chunk CRC')
        if not image_header:
            if kind != b'IHDR' or length != 13:
                raise ValueError('PNG must start with IHDR')
            width, height, depth, colour, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            if not 1 <= width <= 2048 or not 1 <= height <= 2048 or (depth, colour, compression, filtering, interlace) not in ((8, 2, 0, 0, 0), (8, 6, 0, 0, 0)):
                raise ValueError('Texture must be a non-interlaced 8-bit RGB or RGBA PNG up to 2048 px')
            image_header = True
        elif kind == b'IDAT':
            image_data.append(payload)
        elif kind == b'IEND':
            if length != 0 or not image_data or end != len(data):
                raise ValueError('Invalid PNG ending')
            finished = True
            break
        elif kind[0] & 0x20 == 0:
            raise ValueError('Unsupported critical PNG chunk')
        offset = end
    if not finished:
        raise ValueError('PNG is incomplete')
    expected = height * (1 + width * (3 if colour == 2 else 4))
    decoder = zlib.decompressobj()
    pixels = decoder.decompress(b''.join(image_data), expected + 1)
    if len(pixels) != expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError('PNG pixel data is invalid or oversized')


def load_textures(venue, assets: Path | None) -> dict[str, bytes]:
    used = {structure.material_id for structure in venue.structures}
    by_id = {source.id: source for source in venue.sources}
    sources = {by_id[material.base_color_texture_source_id].sha256
               for material in venue.materials if material.id in used and material.base_color_texture_source_id is not None}
    if not sources:
        return {}
    if assets is None or not assets.is_dir():
        raise ValueError('Textured materials require --assets with local PNG files')
    result = {}
    total = 0
    for sha in sorted(sources):
        path = assets / f'{sha}.png'
        if path.is_symlink() or not path.is_file() or path.resolve().parent != assets.resolve():
            raise ValueError(f'Missing local texture asset: {sha}.png')
        with path.open('rb') as stream:
            data = stream.read(MAX_TEXTURE_BYTES + 1)
        validate_png(data)
        if hashlib.sha256(data).hexdigest() != sha:
            raise ValueError(f'Texture hash differs: {sha}.png')
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise ValueError('Texture assets exceed 16 MiB total')
        result[sha] = data
    return result
