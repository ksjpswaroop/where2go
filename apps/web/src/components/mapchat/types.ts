export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
  };
  web?: {
    uri: string;
    title: string;
  };
}

export interface UserReview {
  id: string;
  locationName: string;
  rating: number;
  comment: string;
  username: string;
  timestamp: string;
}

export interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  rating?: number;
  placeId?: string;
  category?: string;
  userRatingAverage?: number;
  userReviewsCount?: number;
}

export interface MapRoute {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  groundingChunks?: GroundingChunk[];
  markers?: MapMarker[];
  route?: MapRoute;
  isMapAction?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export interface FavoriteItem {
  id: string;
  title: string;
  address?: string;
  category?: string;
  lat: number;
  lng: number;
}
