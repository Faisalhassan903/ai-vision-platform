// Tracker.ts
export interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
}

export class CentroidTracker {
  private nextID: number = 0;
  private objects: Map<number, { x: number, y: number, unusedFrames: number }> = new Map();
  private maxDistance: number = 50; // Pixels
  private maxDisappeared: number = 15; // Frames to wait before deleting

  update(detections: Detection[]) {
    const currentCentroids = detections
      .filter(d => d.class === 'person')
      .map(d => ({
        x: d.bbox[0] + d.bbox[2] / 2,
        y: d.bbox[1] + d.bbox[3] / 2
      }));

    const newlyCounted: number[] = [];

    // Simple matching logic
    currentCentroids.forEach(centroid => {
      let matchedID = null;
      let minDistance = this.maxDistance;

      for (let [id, data] of this.objects) {
        const dist = Math.sqrt(Math.pow(centroid.x - data.x, 2) + Math.pow(centroid.y - data.y, 2));
        if (dist < minDistance) {
          minDistance = dist;
          matchedID = id;
        }
      }

      if (matchedID !== null) {
        this.objects.set(matchedID, { ...centroid, unusedFrames: 0 });
      } else {
        // NEW PERSON FOUND
        const id = this.nextID++;
        this.objects.set(id, { ...centroid, unusedFrames: 0 });
        newlyCounted.push(id);
      }
    });

    return newlyCounted; // Returns only the IDs of NEW people detected this frame
  }
}