import { ItineraryData } from "../components/ActiveItinerary";
import { MapMarker, MapRoute, FavoriteItem } from "../types";

export interface CachedMapState {
  key: string;
  mapCenter: { lat: number; lng: number };
  zoom: number;
  activeMarkers: MapMarker[];
  activeRoute: MapRoute | null;
  hiddenGems?: MapMarker[];
  activeItinerary?: ItineraryData | null;
}

export interface SavedItineraryRecord {
  id: string;
  title: string;
  savedAt: number;
  itinerary: ItineraryData;
}

// Initialize Database
export function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("Where2GoOfflineDB", 2);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("itineraries")) {
        db.createObjectStore("itineraries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("mapState")) {
        db.createObjectStore("mapState", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("favorites")) {
        db.createObjectStore("favorites", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

// Itinerary Operations
export async function saveItineraryToDB(id: string, title: string, itinerary: ItineraryData): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("itineraries", "readwrite");
    const store = tx.objectStore("itineraries");
    const record: SavedItineraryRecord = {
      id,
      title,
      savedAt: Date.now(),
      itinerary,
    };
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSavedItinerariesFromDB(): Promise<SavedItineraryRecord[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("itineraries", "readonly");
    const store = tx.objectStore("itineraries");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItineraryFromDB(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("itineraries", "readwrite");
    const store = tx.objectStore("itineraries");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Map State Cache Operations
export async function saveMapStateToDB(state: CachedMapState): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mapState", "readwrite");
    const store = tx.objectStore("mapState");
    const request = store.put(state);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMapStateFromDB(): Promise<CachedMapState | null> {
  try {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("mapState", "readonly");
      const store = tx.objectStore("mapState");
      const request = store.get("current_state");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB getMapStateFromDB failed:", err);
    return null;
  }
}

// Favorite Operations
export async function saveFavoriteToDB(fav: FavoriteItem): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("favorites", "readwrite");
    const store = tx.objectStore("favorites");
    const request = store.put(fav);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFavoriteFromDB(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("favorites", "readwrite");
    const store = tx.objectStore("favorites");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getFavoritesFromDB(): Promise<FavoriteItem[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("favorites", "readonly");
    const store = tx.objectStore("favorites");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
