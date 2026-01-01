import { useZoneStore } from '../store/zoneStore';

export default function ZustandTest() {
  
  // STEP 3.1: Get data from store
  const zoneCount = useZoneStore((state) => state.zoneCount);
  
  // STEP 3.2: Get functions from store
  const incrementZones = useZoneStore((state) => state.incrementZones);
  const decrementZones = useZoneStore((state) => state.decrementZones);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Zustand Test Page</h1>

      <div className="bg-slate-800 p-6 rounded-lg">
        <h2 className="text-xl mb-4">Zone Counter</h2>
        
        <div className="text-6xl font-bold mb-6 text-center">
          {zoneCount}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={incrementZones}
            className="px-6 py-3 bg-green-600 rounded-lg font-bold hover:bg-green-700"
          >
            ➕ ADD ZONE
          </button>

          <button
            onClick={decrementZones}
            className="px-6 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-700"
          >
            ➖ REMOVE ZONE
          </button>
        </div>
      </div>
    </div>
  );
}
