import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultVenue, type SeatRef, type VenueConfig } from '../types/venue'

type VenueState = {
  config: VenueConfig
  selectedSeat: SeatRef | null
  floorplanName: string | null
  setConfig: (patch: Partial<VenueConfig>) => void
  selectSeat: (seat: SeatRef | null) => void
  setFloorplanName: (name: string | null) => void
  reset: () => void
}

export const useVenueStore = create<VenueState>()(
  persist(
    (set) => ({
      config: defaultVenue,
      selectedSeat: null,
      floorplanName: null,
      setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
      selectSeat: (selectedSeat) => set({ selectedSeat }),
      setFloorplanName: (floorplanName) => set({ floorplanName }),
      reset: () => set({ config: defaultVenue, selectedSeat: null, floorplanName: null }),
    }),
    { name: 'venuetwin-project' },
  ),
)
