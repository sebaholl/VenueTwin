import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultVenue, type SeatRef, type VenueConfig } from '../types/venue'

type VenueState = {
  projectId: string
  config: VenueConfig
  selectedSeat: SeatRef | null
  floorplanName: string | null
  setConfig: (patch: Partial<VenueConfig>) => void
  loadProject: (projectId: string, config: VenueConfig) => void
  selectSeat: (seat: SeatRef | null) => void
  setFloorplanName: (name: string | null) => void
  reset: () => void
}

export const useVenueStore = create<VenueState>()(
  persist(
    (set) => ({
      projectId: crypto.randomUUID(),
      config: defaultVenue,
      selectedSeat: null,
      floorplanName: null,
      setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
      loadProject: (projectId, config) => set({ projectId, config, selectedSeat: null, floorplanName: null }),
      selectSeat: (selectedSeat) => set({ selectedSeat }),
      setFloorplanName: (floorplanName) => set({ floorplanName }),
      reset: () => set({ projectId: crypto.randomUUID(), config: defaultVenue, selectedSeat: null, floorplanName: null }),
    }),
    { name: 'venuetwin-project' },
  ),
)
