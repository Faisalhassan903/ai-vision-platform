import { create } from 'zustand';
   

//////////////////////////////////define the data sahpe 
interface ZoneStoreState {
  zoneCount: number;           // How many zones exist?
  incrementZones: () => void;  // Function to add 1
  decrementZones: () => void;  // Function to subtract 1
}

// STEP 2.2: Create the store
export const useZoneStore = create<ZoneStoreState>((set) => ({
  // Initial state
  zoneCount: 0,

  // Actions (functions that modify state)
  incrementZones: () => set((state) => ({ 
    zoneCount: state.zoneCount + 1 
  })),

  decrementZones: () => set((state) => ({ 
    zoneCount: state.zoneCount - 1 
  })),


  
}));


//port {create} from 'zustand';








