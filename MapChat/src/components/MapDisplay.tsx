import { useEffect, useRef, useState } from "react";
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { 
  Star, 
  X, 
  MessageSquare, 
  Plus, 
  Minus,
  Maximize2,
  Loader2, 
  Send, 
  Check,
  Search,
  Radar,
  Utensils,
  Coffee,
  Trees,
  Landmark,
  Hotel,
  ShoppingBag,
  MapPin,
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Thermometer,
  Wind,
  Cloud,
  RefreshCw
} from "lucide-react";
import { MapMarker, MapRoute, UserReview, FavoriteItem } from "../types";
import { HIDDEN_GEMS } from "./hiddenGemsData";

interface MapDisplayProps {
  markers: MapMarker[];
  route: MapRoute | null;
  onCenterChanged: (center: { lat: number; lng: number }) => void;
  mapCenter: { lat: number; lng: number };
  zoom: number;
  onZoomChanged: (zoom: number) => void;
  selectedMarkerIndex: number | null;
  setSelectedMarkerIndex: (index: number | null) => void;
  favorites: FavoriteItem[];
  onToggleFavorite: (item: FavoriteItem) => void;
}

// Custom Marker Component that pairs with InfoWindow using useAdvancedMarkerRef
function PlaceMarker({
  markerData,
  onSelect,
  isSelected,
}: {
  markerData: MapMarker;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [markerRef] = useAdvancedMarkerRef();

  // Determine marker styles based on category
  const getCategoryTheme = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("hidden gem") || cat.includes("user pin") || cat.includes("gem")) {
      return { background: "#D97706", glyphColor: "#FFFFFF" }; // Gold/Amber
    }
    if (cat.includes("restaurant") || cat.includes("food") || cat.includes("eat")) {
      return { background: "#EF4444", glyphColor: "#FFFFFF" }; // Red
    }
    if (cat.includes("cafe") || cat.includes("coffee") || cat.includes("tea")) {
      return { background: "#B45309", glyphColor: "#FFFFFF" }; // Amber/Brown
    }
    if (cat.includes("park") || cat.includes("nature") || cat.includes("outdoor")) {
      return { background: "#10B981", glyphColor: "#FFFFFF" }; // Emerald
    }
    if (cat.includes("sight") || cat.includes("museum") || cat.includes("monument") || cat.includes("tourist")) {
      return { background: "#8B5CF6", glyphColor: "#FFFFFF" }; // Purple
    }
    if (cat.includes("hotel") || cat.includes("stay") || cat.includes("lodging")) {
      return { background: "#3B82F6", glyphColor: "#FFFFFF" }; // Blue
    }
    if (cat.includes("shop") || cat.includes("store") || cat.includes("mall")) {
      return { background: "#EC4899", glyphColor: "#FFFFFF" }; // Pink
    }
    return { background: "#4B5563", glyphColor: "#FFFFFF" }; // Gray slate
  };

  const getCategoryIcon = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("hidden gem") || cat.includes("user pin") || cat.includes("gem")) {
      return <Star className="w-3.5 h-3.5 text-amber-200 fill-amber-300" />;
    }
    if (cat.includes("restaurant") || cat.includes("food") || cat.includes("eat")) {
      return <Utensils className="w-3.5 h-3.5 text-white" />;
    }
    if (cat.includes("cafe") || cat.includes("coffee") || cat.includes("tea")) {
      return <Coffee className="w-3.5 h-3.5 text-white" />;
    }
    if (cat.includes("park") || cat.includes("nature") || cat.includes("outdoor")) {
      return <Trees className="w-3.5 h-3.5 text-white" />;
    }
    if (cat.includes("sight") || cat.includes("museum") || cat.includes("monument") || cat.includes("tourist")) {
      return <Landmark className="w-3.5 h-3.5 text-white" />;
    }
    if (cat.includes("hotel") || cat.includes("stay") || cat.includes("lodging")) {
      return <Hotel className="w-3.5 h-3.5 text-white" />;
    }
    if (cat.includes("shop") || cat.includes("store") || cat.includes("mall")) {
      return <ShoppingBag className="w-3.5 h-3.5 text-white" />;
    }
    return <MapPin className="w-3.5 h-3.5 text-white" />;
  };

  const theme = getCategoryTheme(markerData.category);
  const icon = getCategoryIcon(markerData.category);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: markerData.lat, lng: markerData.lng }}
      title={markerData.title}
      onClick={() => {
        onSelect();
      }}
    >
      <div 
        className={`relative flex flex-col items-center transition-all duration-300 transform -translate-y-1/2 cursor-pointer ${
          isSelected ? "scale-125 z-[999]" : "hover:scale-115 hover:z-[99]"
        }`}
      >
        {/* Glow backdrop for selected pins */}
        {isSelected && (
          <div 
            className="absolute -inset-1.5 rounded-full opacity-35 blur-xs animate-pulse"
            style={{ backgroundColor: theme.background }}
          />
        )}

        {/* Circular custom icon container */}
        <div 
          className={`relative flex items-center justify-center w-8 h-8 rounded-full shadow-md border-2 transition-all duration-200 ${
            markerData.category?.toLowerCase().includes("hidden gem")
              ? "border-amber-400 ring-2 ring-amber-500/40"
              : "border-white"
          }`}
          style={{ backgroundColor: theme.background }}
        >
          {icon}
        </div>

        {/* Pointy tip triangle */}
        <div 
          className={`w-2.5 h-2.5 -mt-1.5 rotate-45 border-r border-b shadow-[1px_1px_2px_rgba(0,0,0,0.15)] ${
            markerData.category?.toLowerCase().includes("hidden gem")
              ? "border-amber-400"
              : "border-white"
          }`}
          style={{ backgroundColor: theme.background }}
        />
      </div>
    </AdvancedMarker>
  );
}

// Dedicated Component to draw Routes on Map as recommended in gmp skill
function RouteDisplay({ route }: { route: MapRoute | null }) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !route) return;

    // Clear previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: route.origin,
      destination: route.destination,
      travelMode: route.travelMode,
      fields: ["path", "viewport", "distanceMeters", "durationMillis"],
    })
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach((p) => p.setMap(map));
          polylinesRef.current = newPolylines;

          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to draw route:", err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, route]);

  return null;
}

// Inner helper to handle map panning / fit bounds
function MapController({
  markers,
  mapCenter,
  zoom,
  hiddenGems = [],
}: {
  markers: MapMarker[];
  mapCenter: { lat: number; lng: number };
  zoom: number;
  hiddenGems?: MapMarker[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(mapCenter);
  }, [map, mapCenter]);

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoom);
  }, [map, zoom]);

  // Adjust bounds to show all markers & nearby hidden gems if focus is requested
  useEffect(() => {
    if (!map || markers.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));

    // Also include nearby hidden gems in the initial bounds
    const activeCoords = { lat: markers[0].lat, lng: markers[0].lng };
    const nearbyGems = hiddenGems.filter(gem => {
      const latDiff = Math.abs(gem.lat - activeCoords.lat);
      const lngDiff = Math.abs(gem.lng - activeCoords.lng);
      return latDiff < 1.5 && lngDiff < 1.5;
    });

    nearbyGems.forEach(gem => bounds.extend({ lat: gem.lat, lng: gem.lng }));

    // Fit bounds if there's more than 1 marker or if there are nearby gems
    if (markers.length > 1 || nearbyGems.length > 0) {
      map.fitBounds(bounds, {
        top: 80,
        bottom: 80,
        left: 80,
        right: 80,
      });
    } else {
      map.panTo({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(14);
    }
  }, [map, markers, hiddenGems]);

  return null;
}

function getWeatherDetails(code: number, isDay: boolean) {
  const is_day_bool = !!isDay;
  switch (code) {
    case 0:
      return {
        label: is_day_bool ? "Sunny" : "Clear Night",
        icon: is_day_bool ? "Sun" : "Moon",
        color: is_day_bool ? "text-amber-500" : "text-indigo-400",
        bgGradient: "from-amber-500/10 to-orange-500/10",
        border: "border-amber-200/40"
      };
    case 1:
    case 2:
    case 3:
      return {
        label: code === 1 ? "Mainly Clear" : code === 2 ? "Partly Cloudy" : "Overcast",
        icon: is_day_bool ? "CloudSun" : "CloudMoon",
        color: "text-slate-400",
        bgGradient: "from-slate-400/10 to-blue-400/10",
        border: "border-slate-200/40"
      };
    case 45:
    case 48:
      return {
        label: "Foggy",
        icon: "Cloud",
        color: "text-gray-400",
        bgGradient: "from-gray-400/10 to-slate-400/10",
        border: "border-gray-200/40"
      };
    case 51:
    case 53:
    case 55:
    case 80:
    case 81:
    case 82:
      return {
        label: "Drizzle / Showers",
        icon: "CloudDrizzle",
        color: "text-blue-400",
        bgGradient: "from-blue-400/10 to-indigo-400/10",
        border: "border-blue-200/40"
      };
    case 61:
    case 63:
    case 65:
      return {
        label: "Rainy",
        icon: "CloudRain",
        color: "text-blue-500",
        bgGradient: "from-blue-500/10 to-cyan-500/10",
        border: "border-blue-300/40"
      };
    case 56:
    case 57:
    case 66:
    case 67:
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        label: "Snowy",
        icon: "CloudSnow",
        color: "text-sky-300",
        bgGradient: "from-sky-300/10 to-blue-300/10",
        border: "border-sky-200/40"
      };
    case 95:
    case 96:
    case 99:
      return {
        label: "Thunderstorm",
        icon: "CloudLightning",
        color: "text-violet-500",
        bgGradient: "from-violet-500/10 to-fuchsia-500/10",
        border: "border-violet-300/40"
      };
    default:
      return {
        label: "Unknown Weather",
        icon: "Cloud",
        color: "text-slate-400",
        bgGradient: "from-slate-400/10 to-slate-500/10",
        border: "border-slate-200"
      };
  }
}

const renderWeatherIcon = (iconName: string) => {
  switch (iconName) {
    case "Sun":
      return <Sun className="w-5 h-5 text-amber-500 animate-[spin_24s_linear_infinite]" />;
    case "Moon":
      return <Moon className="w-5 h-5 text-indigo-300" />;
    case "CloudSun":
      return <CloudSun className="w-5 h-5 text-sky-400" />;
    case "CloudMoon":
      return <CloudMoon className="w-5 h-5 text-indigo-200" />;
    case "CloudDrizzle":
      return <CloudDrizzle className="w-5 h-5 text-blue-400" />;
    case "CloudRain":
      return <CloudRain className="w-5 h-5 text-blue-500 animate-[bounce_1.5s_infinite]" />;
    case "CloudSnow":
      return <CloudSnow className="w-5 h-5 text-sky-200 animate-pulse" />;
    case "CloudLightning":
      return <CloudLightning className="w-5 h-5 text-violet-500" />;
    default:
      return <Cloud className="w-5 h-5 text-slate-400" />;
  }
};

export default function MapDisplay({
  markers,
  route,
  onCenterChanged,
  mapCenter,
  zoom,
  onZoomChanged,
  selectedMarkerIndex,
  setSelectedMarkerIndex,
  favorites = [],
  onToggleFavorite,
}: MapDisplayProps) {
  const map = useMap();
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  
  // Weather layer states
  const [showWeather, setShowWeather] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  
  // Review form states
  const [commentInput, setCommentInput] = useState("");
  const [ratingInput, setRatingInput] = useState(5);
  const [usernameInput, setUsernameInput] = useState("Guest Traveler");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Hidden Gems Layer States
  const [hiddenGems, setHiddenGems] = useState<MapMarker[]>(HIDDEN_GEMS);
  const [isSearchingGems, setIsSearchingGems] = useState(false);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedGemIndex, setSelectedGemIndex] = useState<number | null>(null);
  const [showHiddenGems, setShowHiddenGems] = useState(true);

  // Clear gem selection if a standard marker is selected
  useEffect(() => {
    if (selectedMarkerIndex !== null) {
      setSelectedGemIndex(null);
    }
  }, [selectedMarkerIndex]);

  const selectedMarker = selectedMarkerIndex !== null 
    ? markers[selectedMarkerIndex] 
    : (selectedGemIndex !== null ? hiddenGems[selectedGemIndex] : null);

  // Dynamic search for hidden gems
  const searchHiddenGems = async (lat: number, lng: number, force = false) => {
    if (isSearchingGems) return;
    setIsSearchingGems(true);
    try {
      const response = await fetch("/api/hidden-gems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (!response.ok) throw new Error("Could not fetch hidden gems.");
      const data = await response.json();
      if (data.gems && Array.isArray(data.gems)) {
        setHiddenGems((prev) => {
          const merged = [...prev];
          data.gems.forEach((newGem: any) => {
            const exists = merged.some(
              (g) =>
                g.title.toLowerCase() === newGem.title.toLowerCase() ||
                (Math.abs(g.lat - newGem.lat) < 0.001 && Math.abs(g.lng - newGem.lng) < 0.001)
            );
            if (!exists) {
              merged.push(newGem);
            }
          });
          return merged;
        });
        setLastSearchedCenter({ lat, lng });
      }
    } catch (err) {
      console.error("Failed to search hidden gems dynamically:", err);
    } finally {
      setIsSearchingGems(false);
    }
  };

  // Automatically search when center changes significantly
  useEffect(() => {
    if (!mapCenter) return;

    let shouldSearch = false;
    if (!lastSearchedCenter) {
      shouldSearch = true;
    } else {
      const latDiff = Math.abs(mapCenter.lat - lastSearchedCenter.lat);
      const lngDiff = Math.abs(mapCenter.lng - lastSearchedCenter.lng);
      // Trigger automatically if user moved more than roughly 8-10km (0.08 degrees)
      if (latDiff > 0.08 || lngDiff > 0.08) {
        shouldSearch = true;
      }
    }

    if (shouldSearch) {
      const timer = setTimeout(() => {
        searchHiddenGems(mapCenter.lat, mapCenter.lng);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [mapCenter.lat, mapCenter.lng, lastSearchedCenter]);

  const handleFitAll = () => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let extendedAny = false;

    // Extend standard markers
    if (markers.length > 0) {
      markers.forEach((m) => {
        bounds.extend({ lat: m.lat, lng: m.lng });
        extendedAny = true;
      });
    }

    // Include nearby hidden gems in the active region
    const activeCoords = markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : mapCenter;
    const nearbyGems = hiddenGems.filter(gem => {
      const latDiff = Math.abs(gem.lat - activeCoords.lat);
      const lngDiff = Math.abs(gem.lng - activeCoords.lng);
      return latDiff < 1.5 && lngDiff < 1.5;
    });

    if (showHiddenGems && nearbyGems.length > 0) {
      nearbyGems.forEach(gem => {
        bounds.extend({ lat: gem.lat, lng: gem.lng });
        extendedAny = true;
      });
    }

    if (extendedAny) {
      map.fitBounds(bounds, {
        top: 80,
        bottom: 80,
        left: 80,
        right: 80,
      });
    }
  };

  const getAmbientWeatherGlow = () => {
    if (!showWeather || !weatherData) return "";
    const code = weatherData.weathercode;
    // Sunny/Clear
    if (code === 0) {
      return "shadow-[inset_0_0_40px_rgba(245,158,11,0.08)] pointer-events-none absolute inset-0 z-[5] rounded-none border border-amber-500/10";
    }
    // Cloudy/Overcast/Fog
    if ([1, 2, 3, 45, 48].includes(code)) {
      return "shadow-[inset_0_0_40px_rgba(148,163,184,0.08)] pointer-events-none absolute inset-0 z-[5] rounded-none border border-slate-400/5";
    }
    // Rainy/Drizzle
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
      return "shadow-[inset_0_0_40px_rgba(59,130,246,0.1)] pointer-events-none absolute inset-0 z-[5] rounded-none border border-blue-500/10";
    }
    // Snowy
    if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(code)) {
      return "shadow-[inset_0_0_40px_rgba(125,211,252,0.12)] pointer-events-none absolute inset-0 z-[5] rounded-none border border-sky-300/10 animate-pulse";
    }
    // Thunderstorm
    if ([95, 96, 99].includes(code)) {
      return "shadow-[inset_0_0_50px_rgba(139,92,246,0.12)] pointer-events-none absolute inset-0 z-[5] rounded-none border border-purple-500/10";
    }
    return "";
  };

  // Fetch reviews whenever selected marker changes
  useEffect(() => {
    if (!selectedMarker) {
      setUserReviews([]);
      return;
    }

    setIsLoadingReviews(true);
    setJustSubmitted(false);
    setCommentInput("");

    fetch(`/api/reviews?location=${encodeURIComponent(selectedMarker.title)}`)
      .then((res) => res.json())
      .then((data) => {
        setUserReviews(data);
      })
      .catch((err) => {
        console.error("Error loading reviews:", err);
      })
      .finally(() => {
        setIsLoadingReviews(false);
      });
  }, [selectedMarkerIndex, selectedMarker?.title]);

  // Fetch weather data when weather layer is active and map center changes
  useEffect(() => {
    if (!showWeather) {
      setWeatherData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingWeather(true);
    setWeatherError(null);

    const lat = mapCenter.lat;
    const lng = mapCenter.lng;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Weather service offline");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data && data.current_weather) {
            setWeatherData(data.current_weather);
          } else {
            throw new Error("Invalid weather response");
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Weather load error:", err);
          setWeatherError("Weather service unavailable");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWeather(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [showWeather, mapCenter.lat, mapCenter.lng]);

  const handleRefreshWeather = () => {
    if (!showWeather) return;
    setIsLoadingWeather(true);
    setWeatherError(null);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${mapCenter.lat}&longitude=${mapCenter.lng}&current_weather=true`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Weather service offline");
        return res.json();
      })
      .then((data) => {
        if (data && data.current_weather) {
          setWeatherData(data.current_weather);
        } else {
          throw new Error("Invalid weather data");
        }
      })
      .catch((err) => {
        console.error("Failed to load weather:", err);
        setWeatherError("Weather service unavailable");
      })
      .finally(() => {
        setIsLoadingWeather(false);
      });
  };

  const handleCameraIdle = (e: any) => {
    const map = e.map;
    if (map) {
      const center = map.getCenter();
      if (center) {
        onCenterChanged({ lat: center.lat(), lng: center.lng() });
      }
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined && currentZoom !== zoom) {
        onZoomChanged(currentZoom);
      }
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarker || isSubmittingReview) return;

    setIsSubmittingReview(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: selectedMarker.title,
          rating: ratingInput,
          comment: commentInput.trim(),
          username: usernameInput.trim() || "Anonymous",
        }),
      });

      if (!response.ok) throw new Error("Could not submit review");

      const newReview = await response.json();
      setUserReviews((prev) => [newReview, ...prev]);
      setJustSubmitted(true);
      setCommentInput("");
    } catch (err) {
      console.error("Failed to submit review:", err);
      alert("Failed to submit review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Calculate dynamic average
  const getAverageRating = () => {
    if (!selectedMarker) return 0;
    const baseRating = selectedMarker.rating || 0;
    
    if (userReviews.length === 0) return baseRating;

    const userSum = userReviews.reduce((sum, r) => sum + r.rating, 0);
    const totalCount = userReviews.length + (baseRating > 0 ? 1 : 0);
    const totalSum = userSum + baseRating;
    return totalSum / totalCount;
  };

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row">
      {/* Map Content Area */}
      <div className="flex-1 h-full relative">
        {showWeather && weatherData && (
          <div className={getAmbientWeatherGlow()} />
        )}
        <Map
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }} // Default: San Francisco
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
          onIdle={handleCameraIdle}
          clickableIcons={true}
        >
          {/* Render markers */}
          {markers.map((marker, idx) => (
            <PlaceMarker
              key={`${marker.title}-${idx}`}
              markerData={marker}
              isSelected={selectedMarkerIndex === idx}
              onSelect={() => setSelectedMarkerIndex(idx)}
            />
          ))}

          {/* Render Hidden Gems */}
          {showHiddenGems && hiddenGems.map((gem, idx) => (
            <PlaceMarker
              key={`gem-${gem.title}-${idx}`}
              markerData={gem}
              isSelected={selectedGemIndex === idx}
              onSelect={() => {
                setSelectedGemIndex(idx);
                setSelectedMarkerIndex(null); // Clear standard marker selection
              }}
            />
          ))}

          {/* Dynamic routing overlay */}
          <RouteDisplay route={route} />

          {/* View adjustments */}
          <MapController markers={markers} mapCenter={mapCenter} zoom={zoom} hiddenGems={hiddenGems} />

          {/* Visual weather overlay marker directly at mapCenter */}
          {showWeather && weatherData && (
            <AdvancedMarker
              position={mapCenter}
              zIndex={500}
            >
              <div 
                onClick={handleRefreshWeather}
                className="flex items-center gap-2 bg-white/95 hover:bg-white backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-blue-100/80 cursor-pointer -translate-y-1/2 transform scale-100 hover:scale-105 active:scale-95 transition-all duration-200 select-none group pointer-events-auto"
                title="Current Local Weather - Click to Refresh"
              >
                {/* Glowing status ring */}
                <div className="absolute -inset-1 rounded-2xl bg-blue-500/10 opacity-75 blur-xs group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                {/* Weather icon wrapper */}
                <div className="relative p-1.5 bg-blue-50/80 rounded-xl group-hover:bg-blue-50 transition-colors pointer-events-none">
                  {renderWeatherIcon(getWeatherDetails(weatherData.weathercode, weatherData.is_day).icon)}
                </div>
                
                {/* Weather temperature & status text */}
                <div className="relative flex flex-col pr-1 pointer-events-none">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-black text-slate-800 tracking-tight">
                      {useFahrenheit ? Math.round((weatherData.temperature * 9/5) + 32) : Math.round(weatherData.temperature)}
                    </span>
                    <span className="text-[10px] font-black text-blue-600">
                      {useFahrenheit ? "°F" : "°C"}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold leading-none mt-0.5 whitespace-nowrap">
                    {getWeatherDetails(weatherData.weathercode, weatherData.is_day).label}
                  </span>
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>

        {/* Real-time Weather & Hidden Gems Widgets */}
        <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
          {/* Control Toggles Row */}
          <div className="flex flex-wrap gap-2">
            {/* Weather Toggle Button */}
            <button
              onClick={() => setShowWeather(!showWeather)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md border transition-all duration-300 pointer-events-auto select-none ${
                showWeather
                  ? "bg-slate-900 border-slate-800 text-white shadow-blue-500/10 hover:bg-slate-850"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
            >
              {showWeather ? (
                <Sun className="w-4 h-4 text-amber-400 animate-[spin_12s_linear_infinite]" />
              ) : (
                <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />
              )}
              <span>{showWeather ? "Disable Weather" : "Enable Weather"}</span>
            </button>

            {/* Hidden Gems Toggle Button */}
            <button
              onClick={() => {
                setShowHiddenGems(!showHiddenGems);
                if (showHiddenGems) {
                  setSelectedGemIndex(null);
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md border transition-all duration-300 pointer-events-auto select-none ${
                showHiddenGems
                  ? "text-white shadow-amber-500/10"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
              style={showHiddenGems ? { backgroundColor: "#D97706", borderColor: "#B45309" } : {}}
            >
              <Star className={`w-4 h-4 ${showHiddenGems ? "fill-amber-300 text-amber-100 animate-pulse" : "text-amber-500"}`} />
              <span>{showHiddenGems ? "Hide Hidden Gems" : "Show Hidden Gems"}</span>
            </button>

            {/* Dynamic Scan Hidden Gems Button */}
            <button
              onClick={() => searchHiddenGems(mapCenter.lat, mapCenter.lng, true)}
              disabled={isSearchingGems}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md border border-amber-200/65 transition-all duration-300 pointer-events-auto select-none ${
                isSearchingGems
                  ? "bg-amber-100 text-amber-800 animate-pulse cursor-not-allowed"
                  : "bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-800"
              }`}
              title="Manually trigger search for community-curated hidden gems in the current map view area"
            >
              {isSearchingGems ? (
                <Radar className="w-4 h-4 text-amber-600 animate-[spin_3s_linear_infinite]" />
              ) : (
                <Search className="w-4 h-4 text-amber-600" />
              )}
              <span>{isSearchingGems ? "Scanning Area..." : "Scan Area for Gems"}</span>
            </button>
          </div>

          {/* Floating Weather Info Card */}
          {showWeather && (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-2xl p-4 w-64 text-slate-800 animate-slide-in flex flex-col gap-3 pointer-events-auto select-none">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-mono">
                  Live Local Weather
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRefreshWeather}
                    disabled={isLoadingWeather}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    title="Refresh weather"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => setShowWeather(false)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              {isLoadingWeather && !weatherData ? (
                <div className="flex flex-col items-center justify-center py-4 gap-2">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-500 font-medium">Fetching weather...</span>
                </div>
              ) : weatherError ? (
                <div className="text-center py-3 flex flex-col gap-2">
                  <span className="text-xs text-red-500 font-semibold">{weatherError}</span>
                  <button
                    onClick={handleRefreshWeather}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1 px-2.5 rounded-lg transition-colors self-center"
                  >
                    Try Again
                  </button>
                </div>
              ) : weatherData ? (() => {
                const details = getWeatherDetails(weatherData.weathercode, weatherData.is_day);
                const tempC = weatherData.temperature;
                const tempF = (tempC * 9/5) + 32;
                
                return (
                  <div className="space-y-3">
                    {/* Condition & Temperature */}
                    <div className="flex items-center justify-between bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white rounded-lg shadow-xs border border-slate-100">
                          {renderWeatherIcon(details.icon)}
                        </div>
                        <div>
                          <span className={`text-xs font-extrabold block ${details.color}`}>
                            {details.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Condition
                          </span>
                        </div>
                      </div>

                      {/* Temp and Unit Selector */}
                      <div className="flex items-baseline gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-xs">
                        <span className="text-base font-extrabold text-slate-800">
                          {useFahrenheit ? Math.round(tempF) : Math.round(tempC)}
                        </span>
                        <button
                          onClick={() => setUseFahrenheit(!useFahrenheit)}
                          className="text-[10px] font-extrabold text-blue-600 hover:text-blue-850 transition-colors"
                          title="Switch unit"
                        >
                          {useFahrenheit ? "°F" : "°C"}
                        </button>
                      </div>
                    </div>

                    {/* Additional Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/30 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-mono font-bold leading-none mb-0.5">Wind</span>
                          <span className="font-bold text-slate-750 leading-none">{weatherData.windspeed} km/h</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-mono font-bold leading-none mb-0.5">Feel</span>
                          <span className="font-bold text-slate-750 leading-none">
                            {useFahrenheit ? `${Math.round(tempF)}°F` : `${Math.round(tempC)}°C`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Coordinates disclaimer */}
                    <div className="text-[9px] text-slate-400 text-center leading-normal font-medium italic">
                      Tracking center: {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}
                    </div>
                  </div>
                );
              })() : null}
            </div>
          )}
        </div>

        {/* Interactive Map & Zoom Controls Panel */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Zoom & View Actions Control Bar */}
          <div className="flex gap-1.5 bg-white/95 backdrop-blur-md shadow-lg rounded-2xl p-1.5 border border-slate-200/80">
            {/* Zoom In Button */}
            <button
              onClick={() => onZoomChanged(Math.min(zoom + 1, 21))}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/40 text-slate-700 hover:text-slate-950 rounded-xl transition-all active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
              title="Zoom In"
            >
              <Plus className="w-4 h-4 font-bold" />
            </button>

            {/* Zoom Out Button */}
            <button
              onClick={() => onZoomChanged(Math.max(zoom - 1, 1))}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/40 text-slate-700 hover:text-slate-950 rounded-xl transition-all active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4 font-bold" />
            </button>

            {/* Fit All View Button */}
            <button
              onClick={handleFitAll}
              className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-violet-500/10 transition-all active:scale-90 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-extrabold select-none shrink-0"
              title="Fit map to show all itinerary stops and nearby gems"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Fit Area</span>
            </button>
          </div>

          {/* Mini Metadata Overlay Card */}
          <div className="bg-white/95 backdrop-blur-md shadow-md rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 flex flex-col gap-1 border border-slate-200/60 select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
              <span className="font-medium text-slate-700">Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</span>
            </div>
            <div className="text-slate-400 font-medium text-[11px]">
              Zoom Level: <span className="text-slate-600 font-bold">{zoom}</span> | Active Stops: <span className="text-slate-600 font-bold">{markers.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Details & Reviews Sliding Side Panel */}
      {selectedMarker && (() => {
        const markerId = `${selectedMarker.title.replace(/\s+/g, "_")}_${selectedMarker.lat.toFixed(4)}_${selectedMarker.lng.toFixed(4)}`;
        const isFavorite = favorites.some(fav => fav.id === markerId);
        return (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[360px] bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col animate-slide-in">
            {/* Panel Header */}
            <div className={`p-4 text-white flex items-center justify-between shrink-0 ${
              selectedMarker.category?.toLowerCase().includes("hidden gem")
                ? "bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border-b border-amber-500/20"
                : "bg-slate-900"
            }`}>
              <div>
                <span className={`text-[10px] uppercase tracking-widest font-extrabold font-mono flex items-center gap-1 ${
                  selectedMarker.category?.toLowerCase().includes("hidden gem")
                    ? "text-amber-400 animate-pulse"
                    : "text-blue-400"
                }`}>
                  {selectedMarker.category?.toLowerCase().includes("hidden gem") ? "💎 Hidden Gem (User Pin)" : (selectedMarker.category || "Location details")}
                </span>
                <h2 className="text-sm font-bold truncate max-w-[200px] text-white">
                  {selectedMarker.title}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onToggleFavorite({
                      id: markerId,
                      title: selectedMarker.title,
                      address: selectedMarker.address,
                      category: selectedMarker.category || "Place",
                      lat: selectedMarker.lat,
                      lng: selectedMarker.lng
                    });
                  }}
                  className={`p-1.5 rounded-lg transition-all ${
                    isFavorite 
                      ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title={isFavorite ? "Remove from favorites" : "Save to favorites"}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    setSelectedMarkerIndex(null);
                    setSelectedGemIndex(null);
                  }}
                  className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Address, Base Rating & Save Action */}
              <div className="space-y-3">
                {selectedMarker.address && (
                  <div className="text-xs text-slate-500 leading-normal bg-slate-50 border border-slate-100 rounded-xl p-3 font-semibold">
                    <span className="block text-[10px] text-slate-400 uppercase font-mono font-bold mb-0.5">Address</span>
                    {selectedMarker.address}
                  </div>
                )}

                {/* Dynamic Ratings Summary Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-indigo-400 uppercase font-mono font-bold mb-0.5">Community Score</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-800">
                        {getAverageRating() > 0 ? getAverageRating().toFixed(1) : "N/A"}
                      </span>
                      <span className="text-xs text-slate-400">/ 5.0</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= Math.round(getAverageRating())
                              ? "fill-amber-500 text-amber-500"
                              : "text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right border-l border-indigo-100 pl-4">
                    <div className="text-xs font-bold text-slate-700">
                      {userReviews.length} user reviews
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {selectedMarker.rating ? "Includes Google Places score" : "Exclusively community-rated"}
                    </div>
                  </div>
                </div>

                {/* Favorite Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleFavorite({
                      id: markerId,
                      title: selectedMarker.title,
                      address: selectedMarker.address,
                      category: selectedMarker.category || "Place",
                      lat: selectedMarker.lat,
                      lng: selectedMarker.lng
                    });
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border shadow-3xs cursor-pointer ${
                    isFavorite
                      ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-white text-white" : "text-amber-500"}`} />
                  <span>{isFavorite ? "Saved to Favorites" : "Save to My Favorites"}</span>
                </button>
              </div>

            {/* Write a review section */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Write a Review</span>
              </h3>

              {justSubmitted ? (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div>Review submitted successfully!</div>
                    <button
                      onClick={() => setJustSubmitted(false)}
                      className="text-emerald-600 underline font-bold mt-1 text-[11px] block hover:text-emerald-800"
                    >
                      Write another review
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Traveler"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:outline-none rounded-lg text-xs font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Rating</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingInput(star)}
                          className="p-0.5 focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= ratingInput
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Comment</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Share your experience here..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:outline-none rounded-lg text-xs font-semibold text-slate-800 leading-normal resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview || !commentInput.trim()}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingReview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Post Review</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Existing user reviews list */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Guest Reviews ({userReviews.length})</span>
              </h3>

              {isLoadingReviews ? (
                <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium font-mono">Loading local reviews...</span>
                </div>
              ) : userReviews.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-slate-250 bg-slate-50/40 rounded-xl">
                  <span className="text-slate-400 text-xs font-semibold leading-normal">
                    No community reviews yet. Be the first to add one!
                  </span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {userReviews.map((review) => (
                    <div key={review.id} className="bg-white border border-slate-150 p-3 rounded-xl shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-800 block leading-tight">
                            {review.username}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono font-semibold">
                            {review.timestamp}
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-2.5 h-2.5 ${
                                star <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
}
