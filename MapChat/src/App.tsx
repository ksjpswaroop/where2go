import { useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Compass, AlertCircle, MapPin, MessageSquare, Users, Calendar, Sliders, WifiOff, Wifi, Bookmark, Trash2 } from "lucide-react";
import ChatInterface from "./components/ChatInterface";
import MapDisplay from "./components/MapDisplay";
import { Message, MapMarker, MapRoute, FavoriteItem } from "./types";
import FamilyProfile, { ProfileData } from "./components/FamilyProfile";
import ActiveItinerary, { ItineraryData } from "./components/ActiveItinerary";
import Logo from "./components/Logo";
import { 
  saveItineraryToDB, 
  getSavedItinerariesFromDB, 
  deleteItineraryFromDB, 
  saveMapStateToDB, 
  getMapStateFromDB, 
  SavedItineraryRecord 
} from "./lib/offlineDb";

// Setup API Key extraction from multiple sources as requested in gmp skill guidelines
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && API_KEY.trim() !== "";

function SplashKeyScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans selection:bg-blue-500">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700/50 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center select-none">
        <div className="w-20 h-20 bg-white rounded-3xl p-3 shadow-lg shadow-blue-500/10 mb-6 flex items-center justify-center">
          <Logo className="w-16 h-16" />
        </div>
        
        <h2 className="text-xl font-extrabold tracking-tight text-white mb-2">
          Where2Go Setup Requirement
        </h2>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          This hyperlocal decision engine requires a valid Google Maps API Key to load interactive timelines, map routing, and geocoding.
        </p>

        <div className="w-full text-left bg-slate-850/60 border border-slate-700/30 rounded-xl p-4 mb-6 space-y-4">
          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Step 1: Get Key</div>
            <a
              href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-300 underline hover:text-white font-medium inline-block mt-1"
            >
              Get a Maps API Key from Google Cloud →
            </a>
          </div>

          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Step 2: Add to Secrets</div>
            <ul className="list-disc pl-4 text-xs text-slate-300 mt-1 space-y-1.5 font-medium">
              <li>Open <strong className="text-white">Settings</strong> (⚙️ gear icon, top-right corner)</li>
              <li>Select <strong className="text-white">Secrets</strong></li>
              <li>Type <code className="bg-slate-700 px-1 py-0.5 rounded text-blue-300">GOOGLE_MAPS_PLATFORM_KEY</code>, hit Enter</li>
              <li>Paste your API key, hit Enter</li>
            </ul>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-normal">
          The application will automatically rebuild and refresh once your API key is configured.
        </p>
      </div>
    </div>
  );
}

function MainAppLayout() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMarkers, setActiveMarkers] = useState<MapMarker[]>([]);
  const [activeRoute, setActiveRoute] = useState<MapRoute | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.7749,
    lng: -122.4194, // San Francisco default
  });
  const [zoom, setZoom] = useState<number>(12);
  const [searchMode, setSearchMode] = useState<"maps" | "web" | "none">("maps");
  const [isSending, setIsSending] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const [activeItinerary, setActiveItinerary] = useState<ItineraryData | null>(null);

  // Offline / Network Connection state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [savedItineraries, setSavedItineraries] = useState<SavedItineraryRecord[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial load of saved itineraries from IndexedDB
    getSavedItinerariesFromDB().then((records) => {
      setSavedItineraries(records);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Restore cached map state on startup
  useEffect(() => {
    getMapStateFromDB().then((cachedState) => {
      if (cachedState) {
        if (cachedState.mapCenter) setMapCenter(cachedState.mapCenter);
        if (cachedState.zoom) setZoom(cachedState.zoom);
        if (cachedState.activeMarkers) setActiveMarkers(cachedState.activeMarkers);
        if (cachedState.activeRoute) setActiveRoute(cachedState.activeRoute);
        if (cachedState.activeItinerary) {
          setActiveItinerary(cachedState.activeItinerary);
          setActiveTab("itinerary");
          setActiveMobileTab("itinerary");
        }
      }
    });
  }, []);

  // Cache current map state to IndexedDB whenever it changes
  useEffect(() => {
    const stateToCache = {
      key: "current_state",
      mapCenter,
      zoom,
      activeMarkers,
      activeRoute,
      activeItinerary,
    };
    saveMapStateToDB(stateToCache).catch((err) => {
      console.error("Failed to cache map state offline:", err);
    });
  }, [mapCenter, zoom, activeMarkers, activeRoute, activeItinerary]);

  
  // Tab layout state
  const [activeTab, setActiveTab] = useState<"chat" | "itinerary">("chat");
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "itinerary" | "map">("chat");
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null);

  // Favorites state with local storage persistence
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    const saved = localStorage.getItem("where2go_favorites");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse saved favorites:", err);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("where2go_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const handleToggleFavorite = (item: FavoriteItem) => {
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === item.id);
      if (exists) {
        return prev.filter((fav) => fav.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleRemoveFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const handleViewFavoriteOnMap = (lat: number, lng: number, title: string) => {
    // Set map center and zoom in
    setMapCenter({ lat, lng });
    setZoom(15);
    
    // Add item as a marker if it is not already present
    const markerId = `${title.replace(/\s+/g, "_")}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const markerExists = activeMarkers.some(m => `${m.title.replace(/\s+/g, "_")}_${m.lat.toFixed(4)}_${m.lng.toFixed(4)}` === markerId);
    
    if (!markerExists) {
      // Find original category/address from favorites if it exists
      const originalFav = favorites.find(f => f.id === markerId);
      const newMarker: MapMarker = {
        title: title,
        lat: lat,
        lng: lng,
        category: originalFav?.category || "Favorite",
        address: originalFav?.address || "",
        rating: 5.0
      };
      setActiveMarkers(prev => {
        const updated = [...prev, newMarker];
        // Select this newly added marker
        setTimeout(() => {
          setSelectedMarkerIndex(updated.length - 1);
        }, 50);
        return updated;
      });
    } else {
      const existingIdx = activeMarkers.findIndex(m => `${m.title.replace(/\s+/g, "_")}_${m.lat.toFixed(4)}_${m.lng.toFixed(4)}` === markerId);
      if (existingIdx !== -1) {
        setSelectedMarkerIndex(existingIdx);
      }
    }
    
    // Switch view tabs
    setActiveMobileTab("map");
    // Close profile settings modal
    setIsProfileOpen(false);
  };

  // Custom Where2Go App States

  const handleSaveItinerary = async (itineraryData: ItineraryData) => {
    const id = itineraryData.title.replace(/\s+/g, "_").toLowerCase();
    const exists = savedItineraries.some((item) => item.id === id);
    if (exists) {
      await deleteItineraryFromDB(id);
    } else {
      await saveItineraryToDB(id, itineraryData.title, itineraryData);
    }
    const updated = await getSavedItinerariesFromDB();
    setSavedItineraries(updated);
  };

  const handleDeleteItinerary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent loading it when clicking delete
    await deleteItineraryFromDB(id);
    const updated = await getSavedItinerariesFromDB();
    setSavedItineraries(updated);
  };

  const isActiveItinerarySaved = activeItinerary 
    ? savedItineraries.some((item) => item.id === activeItinerary.title.replace(/\s+/g, "_").toLowerCase())
    : false;

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasNewItineraryAlert, setHasNewItineraryAlert] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>(() => {
    const saved = localStorage.getItem("where2go_profile");
    const defaultProfile: ProfileData = {
      adultsCount: 2,
      kidsCount: 2,
      kidAgeGroup: "kid",
      maxDriveTime: 30,
      maxBudget: 120,
      preferences: ["Parks", "Playgrounds", "Museums", "Outdoors"],
      preferSunny: true,
      warnAboutRain: true,
      temperaturePreference: "any",
      avoidHighWind: false,
    };
    if (saved) {
      try {
        return { ...defaultProfile, ...JSON.parse(saved) };
      } catch (err) {
        console.error("Failed to parse saved family profile:", err);
      }
    }
    return defaultProfile;
  });

  // Check if server is configured with Gemini API Key
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setHasGeminiKey(!!data.hasGeminiKey);
      })
      .catch((err) => {
        console.error("Config check failed:", err);
        setHasGeminiKey(false);
      });
  }, []);

  // Use geolocation to set default user position if permitted
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation permission denied or failed:", error);
        }
      );
    }
  }, []);

  const handleSendMessage = async (text: string, selectedMode: "maps" | "web" | "none") => {
    if (!text.trim() || isSending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mapCenter,
          searchMode: selectedMode,
          profile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server returned an error");
      }

      const data = await response.json();

      let turnMarkers: MapMarker[] = [];
      let turnRoute: MapRoute | null = null;

      // Handle function calls returned by the Gemini AI to control Where2Go layouts
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          if (call.name === "add_markers") {
            const { markers, zoom: suggestedZoom, focusCenter } = call.args;
            turnMarkers = [...turnMarkers, ...markers];

            if (markers.length > 0 && focusCenter) {
              setMapCenter({ lat: markers[0].lat, lng: markers[0].lng });
            }
            if (suggestedZoom) {
              setZoom(suggestedZoom);
            }
          } else if (call.name === "draw_route") {
            const { origin, destination, travelMode } = call.args;
            turnRoute = { origin, destination, travelMode };
          } else if (call.name === "set_map_view") {
            const { lat, lng, zoom: suggestedZoom } = call.args;
            setMapCenter({ lat, lng });
            if (suggestedZoom) {
              setZoom(suggestedZoom);
            }
          } else if (call.name === "clear_map") {
            setActiveMarkers([]);
            setActiveRoute(null);
            setSelectedMarkerIndex(null);
          } else if (call.name === "display_itinerary") {
            const itineraryData = call.args as ItineraryData;
            setActiveItinerary(itineraryData);
            
            // Highlight itinerary tab
            setActiveTab("itinerary");
            setHasNewItineraryAlert(true);
            
            // Auto plot timeline stops on the map
            if (itineraryData.timeline && itineraryData.timeline.length > 0) {
              const timelineMarkers = itineraryData.timeline
                .filter((stop) => stop.lat && stop.lng)
                .map((stop) => ({
                  lat: stop.lat!,
                  lng: stop.lng!,
                  title: stop.locationName,
                  address: stop.address || "",
                  category: "Itinerary Stop",
                }));
              
              if (timelineMarkers.length > 0) {
                turnMarkers = [...turnMarkers, ...timelineMarkers];
                setMapCenter({ lat: timelineMarkers[0].lat, lng: timelineMarkers[0].lng });
                setZoom(13);
              }
            }
          }
        }
      }

      // Update global active markers and route overlays
      if (turnMarkers.length > 0) {
        setActiveMarkers(turnMarkers);
        setSelectedMarkerIndex(null); // Reset selected marker for new set
      }
      if (turnRoute) {
        setActiveRoute(turnRoute);
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "model",
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        groundingChunks: data.groundingChunks,
        markers: turnMarkers,
        route: turnRoute || undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If an itinerary was generated, make sure mobile view shifts appropriately
      if (activeItinerary || turnMarkers.length > 0 || turnRoute) {
        if (data.functionCalls?.some((c: any) => c.name === "display_itinerary")) {
          setActiveMobileTab("itinerary");
        } else if (activeMobileTab === "chat") {
          setActiveMobileTab("map");
        }
      }

    } catch (err: any) {
      console.error("Chat Error:", err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "model",
        content: `⚠️ **Error:** ${err.message || "Could not connect to the assistant server."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveMarkers([]);
    setActiveRoute(null);
    setSelectedMarkerIndex(null);
    setActiveItinerary(null);
    setHasNewItineraryAlert(false);
  };

  const handleGeocodeSearch = (query: string) => {
    if (!window.google) {
      console.error("Google Maps library is not fully loaded yet.");
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const targetCoords = { lat: loc.lat(), lng: loc.lng() };
        
        setMapCenter(targetCoords);
        setZoom(13);

        const newSearchMarker: MapMarker = {
          lat: loc.lat(),
          lng: loc.lng(),
          title: `Search: ${query}`,
          address: results[0].formatted_address,
          category: "Search Result",
        };

        setActiveMarkers([newSearchMarker]);
        setActiveRoute(null);
        setSelectedMarkerIndex(0); // Select the newly searched place!

        // Notify user in chat
        const infoMsg: Message = {
          id: crypto.randomUUID(),
          role: "model",
          content: `📍 Panned map to **${query}** (${results[0].formatted_address}). Let me know what you would like to find here!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isMapAction: true,
        };
        setMessages((prev) => [...prev, infoMsg]);
      } else {
        alert(`Could not find location: "${query}"`);
      }
    });
  };

  const handleSelectMarkerFromChat = (idx: number) => {
    if (activeMarkers[idx]) {
      const marker = activeMarkers[idx];
      setMapCenter({ lat: marker.lat, lng: marker.lng });
      setZoom(15);
      setSelectedMarkerIndex(idx);
      
      // Toggle to map view on mobile
      if (activeMobileTab === "chat" || activeMobileTab === "itinerary") {
        setActiveMobileTab("map");
      }
    }
  };

  const handleSelectStopFromItinerary = (coords: { lat: number; lng: number }, label: string) => {
    setMapCenter(coords);
    setZoom(15);
    
    // Find matching marker or append temporary one
    const existsIdx = activeMarkers.findIndex(m => Math.abs(m.lat - coords.lat) < 0.0001);
    if (existsIdx !== -1) {
      setSelectedMarkerIndex(existsIdx);
    } else {
      const tempMarker: MapMarker = {
        lat: coords.lat,
        lng: coords.lng,
        title: label,
        category: "Selected Stop"
      };
      setActiveMarkers(prev => [...prev, tempMarker]);
      setSelectedMarkerIndex(activeMarkers.length);
    }

    if (activeMobileTab !== "map") {
      setActiveMobileTab("map");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-slate-100 select-none">
      {/* Offline Status Banner */}
      {isOffline && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs md:text-sm font-bold flex items-center justify-between gap-3 shadow-md z-50 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              Offline Mode Active: Showing cached maps, saved itineraries, and favorites from your local IndexedDB database.
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-rose-700/60 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono">
            Local DB State
          </div>
        </div>
      )}

      {/* Configuration Status Banner */}
      {hasGeminiKey === false && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs md:text-sm font-semibold flex items-center justify-between gap-3 shadow-md z-50 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              Gemini API Key Missing: Outing plans and recommendations will not work until you configure your key.
            </span>
          </div>
          <a
            href="https://ai.google.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white shrink-0 text-xs font-bold font-mono uppercase bg-amber-600 px-2 py-0.5 rounded"
          >
            Add Secrets &gt; GEMINI_API_KEY
          </a>
        </div>
      )}

      {/* Main Core Window */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Left Side / Sidebar Tabs Controls - Hidden on mobile if map is active */}
        <div
          className={`w-full md:w-[440px] lg:w-[480px] h-full shrink-0 z-10 transition-all flex flex-col relative bg-white border-r border-slate-200 ${
            activeMobileTab === "chat" || activeMobileTab === "itinerary" ? "block" : "hidden md:flex"
          }`}
        >
          {/* Subheader Dual Tab Switches (Desktop view & Mobile adaptive) */}
          <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-bold p-1 shrink-0">
            <button
              onClick={() => {
                setActiveTab("chat");
                setActiveMobileTab("chat");
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                activeTab === "chat" && (activeMobileTab === "chat" || activeMobileTab === "map" || !activeMobileTab)
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Conversational Chat</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("itinerary");
                setActiveMobileTab("itinerary");
                setHasNewItineraryAlert(false);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all relative ${
                activeTab === "itinerary" || activeMobileTab === "itinerary"
                  ? "bg-white text-emerald-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Outing Itinerary</span>
              {hasNewItineraryAlert && (
                <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-ping" />
              )}
            </button>
          </div>

          {/* Tab Panes Container */}
          <div className="flex-1 min-h-0 relative">
            {/* Conversations Thread Tab */}
            <div className={`h-full ${activeTab === "chat" && activeMobileTab === "chat" ? "block" : "hidden md:block"}`}>
              <ChatInterface
                messages={messages}
                isSending={isSending}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                mapCenter={mapCenter}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                onGeocodeSearch={handleGeocodeSearch}
                onSelectMarker={handleSelectMarkerFromChat}
                activeMarkers={activeMarkers}
                onOpenProfile={() => setIsProfileOpen(true)}
              />
            </div>

            {/* Structured Itinerary Display Tab */}
            <div className={`h-full ${activeTab === "itinerary" || activeMobileTab === "itinerary" ? "block" : "hidden"}`}>
              {activeItinerary ? (
                <ActiveItinerary
                  itinerary={activeItinerary}
                  userMaxBudget={profile.maxBudget}
                  onSelectStop={handleSelectStopFromItinerary}
                  onDrawRoute={(orig, dest) => {
                    setActiveRoute({ origin: orig, destination: dest, travelMode: "DRIVING" });
                    setActiveMobileTab("map");
                  }}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  onSaveItinerary={handleSaveItinerary}
                  isSaved={isActiveItinerarySaved}
                  onClose={() => {
                    setActiveItinerary(null);
                    setActiveMarkers([]);
                    setActiveRoute(null);
                  }}
                />
              ) : (
                <div className="h-full flex flex-col justify-start overflow-y-auto p-5 space-y-6">
                  <div className="flex flex-col items-center justify-center text-center p-4 space-y-4">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="max-w-xs">
                      <h3 className="font-extrabold text-slate-800 text-sm">No active itinerary yet</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Configure your Group Profile, then use the Quick Plan Form or chat to tell me what you want to do. I will compile a complete schedule board for you!
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab("chat");
                          setActiveMobileTab("chat");
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Start Outing Query
                      </button>
                    </div>
                  </div>

                  {/* Saved Itineraries Section */}
                  <div className="space-y-3 pt-4 border-t border-slate-200/60">
                    <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                      <span>Saved Offline Plans ({savedItineraries.length})</span>
                    </div>

                    {savedItineraries.length > 0 ? (
                      <div className="space-y-2.5">
                        {savedItineraries.map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => {
                              setActiveItinerary(rec.itinerary);
                              // Trigger auto plot of timeline stops
                              if (rec.itinerary.timeline && rec.itinerary.timeline.length > 0) {
                                const timelineMarkers = rec.itinerary.timeline
                                  .filter((stop) => stop.lat && stop.lng)
                                  .map((stop) => ({
                                    lat: stop.lat!,
                                    lng: stop.lng!,
                                    title: stop.locationName,
                                    address: stop.address || "",
                                    category: "Itinerary Stop",
                                  }));
                                if (timelineMarkers.length > 0) {
                                  setActiveMarkers(timelineMarkers);
                                  setMapCenter({ lat: timelineMarkers[0].lat, lng: timelineMarkers[0].lng });
                                  setZoom(13);
                                }
                              }
                            }}
                            className="bg-white border border-slate-200 hover:border-emerald-200 rounded-xl p-3.5 text-left cursor-pointer transition-all hover:shadow-xs group flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <h4 className="font-extrabold text-xs text-slate-700 group-hover:text-emerald-700 transition-colors truncate">
                                {rec.itinerary.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
                                {rec.itinerary.description}
                              </p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 font-mono pt-1">
                                <span>{rec.itinerary.totalCostEstimate}</span>
                                <span>•</span>
                                <span>{rec.itinerary.timeline.length} stops</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteItinerary(rec.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                              title="Delete saved plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400 font-medium leading-relaxed bg-white/50">
                        You don't have any saved plans yet. When an itinerary is active, click the bookmark icon to access it offline anytime.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Family Profile modal inside Left sidebar context */}
            {isProfileOpen && (
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 p-4 flex items-center justify-center">
                <div className="w-full max-w-sm">
                  <FamilyProfile
                    onSave={(data) => {
                      setProfile(data);
                      setIsProfileOpen(false);
                    }}
                    onClose={() => setIsProfileOpen(false)}
                    favorites={favorites}
                    onRemoveFavorite={handleRemoveFavorite}
                    onViewFavoriteOnMap={handleViewFavoriteOnMap}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side / Map - Hidden on mobile if chat/itinerary active */}
        <div
          className={`flex-1 h-full relative ${
            activeMobileTab === "map" ? "block" : "hidden md:block"
          }`}
        >
          <MapDisplay
            markers={activeMarkers}
            route={activeRoute}
            onCenterChanged={setMapCenter}
            mapCenter={mapCenter}
            zoom={zoom}
            onZoomChanged={setZoom}
            selectedMarkerIndex={selectedMarkerIndex}
            setSelectedMarkerIndex={setSelectedMarkerIndex}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      </div>

      {/* Mobile Sticky Tab bar at Bottom */}
      <div className="md:hidden h-14 bg-white border-t border-slate-200 grid grid-cols-3 shadow-inner shrink-0 z-20 select-none">
        <button
          onClick={() => {
            setActiveMobileTab("chat");
            setActiveTab("chat");
          }}
          className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
            activeMobileTab === "chat" ? "text-blue-600 bg-blue-50/40" : "text-slate-500"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => {
            setActiveMobileTab("itinerary");
            setActiveTab("itinerary");
            setHasNewItineraryAlert(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors relative ${
            activeMobileTab === "itinerary" ? "text-emerald-600 bg-emerald-50/40" : "text-slate-500"
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>Itinerary</span>
          {hasNewItineraryAlert && (
            <span className="absolute top-2.5 right-10 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveMobileTab("map")}
          className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
            activeMobileTab === "map" ? "text-blue-600 bg-blue-50/40" : "text-slate-500"
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span>Map</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  if (!hasValidKey) {
    return <SplashKeyScreen />;
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <MainAppLayout />
    </APIProvider>
  );
}
