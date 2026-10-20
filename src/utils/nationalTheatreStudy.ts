import { defaultVenue, type VenueConfig, type RowOverride } from '../types/venue'

export function createNationalTheatreStudy(): VenueConfig {
  const seatingLevels = [
    { id: 'stalls', name: 'Parterre', elevation: 0 },
    { id: 'balcony1', name: 'Balcony 1', elevation: 3.7 },
    { id: 'balcony2', name: 'Balcony 2', elevation: 6.9 },
    { id: 'gallery1', name: 'Gallery 1', elevation: 10.1 },
    { id: 'gallery2', name: 'Gallery 2', elevation: 13.1 },
  ]
  const rowOverrides: Record<number, RowOverride> = {}
  for (let row = 0; row < 10; row++) rowOverrides[row] = { levelId: 'stalls', elevation: row * .11, seats: 16 + Math.min(row, 6) * 2, offsetY: 1, categoryId: 'stalls' }
  let row = 10
  seatingLevels.slice(1).forEach((level, index) => {
    const count = index < 2 ? 4 : 3
    for (let i = 0; i < count; i++, row++) rowOverrides[row] = {
      levelId: level.id, elevation: i * (index < 2 ? .24 : .38), seats: 42 + i * 2,
      arcRadius: 10.6 + i * .85 + index * .35, arcDegrees: 155,
      offsetY: -1.8, categoryId: level.id,
    }
  })
  return { ...defaultVenue, name: 'National Theatre Prague · estimated study', venueType: 'theatre',
    rows: row, seatsPerRow: 28, geometry: 'straight', sectors: 1, rake: .11, stageWidth: 11.5,
    seatSpacing: .55, rowSpacing: .82, rowOverrides, seatingLevels,
    studyNotice: 'ND-inspired study. Dimensions, levels, seat counts and labels are estimated; not an official seating plan or verified view. Side boxes and detailed ornament are not reconstructed.',
    categories: seatingLevels.map((level, i) => ({ id: level.id, name: level.name, color: ['#a63746', '#ba4959', '#ca6670', '#d68a89', '#e2b0a0'][i] })),
    obstacles: [],
  }
}
