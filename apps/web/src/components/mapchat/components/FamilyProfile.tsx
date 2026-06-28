"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, DollarSign, Heart, Save, X, Smile, Sun, CloudRain, Thermometer, Wind, Trash2, Map, Sliders, Star } from "lucide-react";
import { FavoriteItem } from "../types";

export interface ProfileData {
  adultsCount: number;
  kidsCount: number;
  kidAgeGroup: "toddler" | "kid" | "teen" | "none";
  maxDriveTime: number; // in minutes
  maxBudget: number; // in dollars
  preferences: string[];
  // Weather Settings Preferences
  preferSunny: boolean;
  warnAboutRain: boolean;
  temperaturePreference: "any" | "warm" | "cool";
  avoidHighWind: boolean;
}

interface FamilyProfileProps {
  onSave: (data: ProfileData) => void;
  onClose: () => void;
  favorites: FavoriteItem[];
  onRemoveFavorite: (id: string) => void;
  onViewFavoriteOnMap: (lat: number, lng: number, title: string) => void;
}

const DEFAULT_PROFILE: ProfileData = {
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

const PREFERENCE_OPTIONS = [
  "Parks",
  "Playgrounds",
  "Museums",
  "Zoos & Aquariums",
  "Arcades & Play Zones",
  "Libraries",
  "Hiking Trails",
  "Beaches",
  "Ice Cream & Desserts",
  "Casual Dining",
];

export default function FamilyProfile({ 
  onSave, 
  onClose,
  favorites = [],
  onRemoveFavorite,
  onViewFavoriteOnMap
}: FamilyProfileProps) {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"settings" | "favorites">("settings");

  useEffect(() => {
    const saved = localStorage.getItem("where2go_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfile({
          ...DEFAULT_PROFILE,
          ...parsed,
        });
      } catch (err) {
        console.error("Failed to parse saved family profile:", err);
      }
    }
  }, []);

  const handleTogglePreference = (pref: string) => {
    setProfile((prev) => {
      const exists = prev.preferences.includes(pref);
      const updated = exists
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref];
      return { ...prev, preferences: updated };
    });
  };

  const handleSave = () => {
    localStorage.setItem("where2go_profile", JSON.stringify(profile));
    onSave(profile);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-slide-in select-none">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeModalTab === "settings" ? (
            <Sliders className="w-4.5 h-4.5 text-blue-400" />
          ) : (
            <Star className="w-4.5 h-4.5 text-amber-400 fill-amber-400" />
          )}
          <h2 className="font-bold text-sm tracking-tight">
            {activeModalTab === "settings" ? "Family & Group Profile" : "My Saved Favorites"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile & Favorites Tabs Switching Header */}
      <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 text-xs font-bold p-1">
        <button
          type="button"
          onClick={() => setActiveModalTab("settings")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
            activeModalTab === "settings"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Group Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModalTab("favorites")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all relative ${
            activeModalTab === "favorites"
              ? "bg-white text-amber-600 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${activeModalTab === "favorites" ? "fill-amber-500 text-amber-500" : ""}`} />
          <span>My Favorites</span>
          {favorites.length > 0 && (
            <span className="absolute top-1.5 right-6 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-extrabold font-mono scale-90">
              {favorites.length}
            </span>
          )}
        </button>
      </div>

      {/* Form Content */}
      <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto">
        {activeModalTab === "settings" ? (
          <>
            {/* Household Mix */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                Party Size & Composition
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold">Adults</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          adultsCount: Math.max(1, p.adultsCount - 1),
                        }))
                      }
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-slate-800 w-4 text-center">
                      {profile.adultsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({ ...p, adultsCount: p.adultsCount + 1 }))
                      }
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Smile className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold">Kids</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          kidsCount: Math.max(0, p.kidsCount - 1),
                          kidAgeGroup: p.kidsCount - 1 === 0 ? "none" : p.kidAgeGroup,
                        }))
                      }
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-slate-80 w-4 text-center">
                      {profile.kidsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          kidsCount: p.kidsCount + 1,
                          kidAgeGroup: p.kidsCount === 0 ? "kid" : p.kidAgeGroup,
                        }))
                      }
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Kids Age Group */}
            {profile.kidsCount > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                  Kids Age Group
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(["toddler", "kid", "teen"] as const).map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, kidAgeGroup: age }))}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize ${
                        profile.kidAgeGroup === age
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {age === "toddler" ? "Toddlers (0-4)" : age === "kid" ? "Kids (5-11)" : "Teens (12+)"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Travel & Budget Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Max Drive Time
                </label>
                <div className="relative">
                  <select
                    value={profile.maxDriveTime}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, maxDriveTime: Number(e.target.value) }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all appearance-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours+</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-bold">
                    ▼
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Max Budget Cap
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={profile.maxBudget}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, maxBudget: Number(e.target.value) }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                    USD
                  </span>
                </div>
              </div>
            </div>

            {/* Favorite Preferences */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-500" /> Favorite Activity Themes
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_OPTIONS.map((pref) => {
                  const isActive = profile.preferences.includes(pref);
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => handleTogglePreference(pref)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                        isActive
                          ? "bg-blue-50 border-blue-200 text-blue-600 shadow-xs font-bold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pref}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weather-Aware Planning Preferences */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Weather-Aware Planning Preferences
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Prefer Sunny Days Toggle */}
                <button
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, preferSunny: !p.preferSunny }))}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    profile.preferSunny
                      ? "bg-amber-50/50 border-amber-200 text-amber-900 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${profile.preferSunny ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}>
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Prefer Sunny Days</div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Favor outdoor parks & viewpoints when sunny</div>
                  </div>
                </button>

                {/* Warn About Rain Toggle */}
                <button
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, warnAboutRain: !p.warnAboutRain }))}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    profile.warnAboutRain
                      ? "bg-blue-50/50 border-blue-200 text-blue-900 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${profile.warnAboutRain ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                    <CloudRain className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Warn About Rain</div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Alert and provide indoor backups if rain is likely</div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Temperature Comfort Preference */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-red-500" /> Temperature Profile
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg">
                    {(["any", "warm", "cool"] as const).map((temp) => (
                      <button
                        key={temp}
                        type="button"
                        onClick={() => setProfile((p) => ({ ...p, temperaturePreference: temp }))}
                        className={`py-1 rounded-md text-[10px] font-bold transition-all capitalize ${
                          profile.temperaturePreference === temp
                            ? "bg-white text-blue-600 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {temp === "any" ? "Any" : temp === "warm" ? "Warm" : "Cool"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avoid High Wind Toggle */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                    <Wind className="w-3 h-3 text-sky-500" /> Wind Sensitivity
                  </span>
                  <button
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, avoidHighWind: !p.avoidHighWind }))}
                    className={`w-full py-2 px-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                      profile.avoidHighWind
                        ? "bg-sky-50 border-sky-200 text-sky-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[10px] font-bold">Avoid High Winds</span>
                    <div className={`w-6 h-3.5 rounded-full p-0.5 transition-colors duration-200 ${profile.avoidHighWind ? "bg-sky-500" : "bg-slate-200"}`}>
                      <div className={`w-2.5 h-2.5 rounded-full bg-white shadow-xs transform duration-200 ${profile.avoidHighWind ? "translate-x-2.5" : ""}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Saved Favorites tab view */
          <div className="space-y-3.5">
            {favorites.length === 0 ? (
              <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-3 border border-amber-100 animate-pulse">
                  <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">No saved favorites yet</h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed font-medium">
                  Click the star or save icon on map pins or itinerary timeline stops to save your favorite group destinations here!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Saved Locations ({favorites.length})
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-mono">
                    Plan Future Outings
                  </span>
                </div>

                <div className="space-y-2.5">
                  {favorites.map((fav) => (
                    <div 
                      key={fav.id} 
                      className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {fav.category && (
                            <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono mb-1.5 leading-none">
                              {fav.category}
                            </span>
                          )}
                          <h4 className="text-xs font-black text-slate-800 leading-snug">
                            {fav.title}
                          </h4>
                        </div>

                        {/* Remove favorite button */}
                        <button
                          type="button"
                          onClick={() => onRemoveFavorite(fav.id)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-150 hover:border-red-200 transition-colors shrink-0"
                          title="Remove from favorites"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {fav.address && (
                        <p className="text-[10px] text-slate-500 font-medium leading-normal bg-slate-50/55 p-2 rounded-lg border border-slate-100">
                          {fav.address}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-0.5 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-mono font-semibold mr-auto">
                          Lat: {fav.lat.toFixed(4)}, Lng: {fav.lng.toFixed(4)}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => onViewFavoriteOnMap(fav.lat, fav.lng, fav.title)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 border border-blue-100"
                        >
                          <Map className="w-3 h-3" />
                          <span>View on Map</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Save Action / Saved Count */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        {activeModalTab === "settings" ? (
          <>
            <div className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider pl-1">
              Customizes model outputs
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveSuccess}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                saveSuccess
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-blue-500/10 cursor-pointer"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveSuccess ? "Profile Saved!" : "Save Settings"}</span>
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-between px-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider">
              Favorites stored offline
            </span>
            <span className="text-[10px] font-bold text-slate-500 font-mono">
              {favorites.length} saved destinations
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
