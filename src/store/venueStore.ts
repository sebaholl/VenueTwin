import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultVenue, type SeatRef, type VenueConfig } from '../types/venue'

const historyLimit = 50

type VenueState = {
  projectId: string
  config: VenueConfig
  selectedSeat: SeatRef | null
  floorplanName: string | null
  past: VenueConfig[]
  future: VenueConfig[]
  transactionStart: VenueConfig | null
  setConfig: (patch: Partial<VenueConfig>) => void
  beginEdit: () => void
  commitEdit: () => void
  undo: () => void
  redo: () => void
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
      past: [],
      future: [],
      transactionStart: null,
      setConfig: (patch) => set((state) => {
        const config = { ...state.config, ...patch }
        if (state.transactionStart) return { config }
        return { config, past: [...state.past, state.config].slice(-historyLimit), future: [] }
      }),
      beginEdit: () => set((state) => state.transactionStart ? state : { transactionStart: state.config }),
      commitEdit: () => set((state) => {
        if (!state.transactionStart) return state
        const changed = JSON.stringify(state.transactionStart) !== JSON.stringify(state.config)
        return {
          transactionStart: null,
          past: changed ? [...state.past, state.transactionStart].slice(-historyLimit) : state.past,
          future: changed ? [] : state.future,
        }
      }),
      undo: () => set((state) => {
        const previous = state.past.at(-1)
        if (!previous) return state
        return { config: previous, past: state.past.slice(0, -1), future: [state.config, ...state.future], transactionStart: null, selectedSeat: null }
      }),
      redo: () => set((state) => {
        const next = state.future[0]
        if (!next) return state
        return { config: next, past: [...state.past, state.config].slice(-historyLimit), future: state.future.slice(1), transactionStart: null, selectedSeat: null }
      }),
      loadProject: (projectId, config) => set({ projectId, config, selectedSeat: null, floorplanName: null, past: [], future: [], transactionStart: null }),
      selectSeat: (selectedSeat) => set({ selectedSeat }),
      setFloorplanName: (floorplanName) => set({ floorplanName }),
      reset: () => set({ projectId: crypto.randomUUID(), config: defaultVenue, selectedSeat: null, floorplanName: null, past: [], future: [], transactionStart: null }),
    }),
    {
      name: 'venuetwin-project',
      partialize: (state) => ({ projectId: state.projectId, config: state.config, floorplanName: state.floorplanName }),
    },
  ),
)
