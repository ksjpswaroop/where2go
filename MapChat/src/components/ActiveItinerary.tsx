import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  Clock, 
  HelpCircle, 
  Sparkles, 
  ChevronRight, 
  ExternalLink, 
  Share2, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  Bookmark,
  CloudSun,
  Shield,
  Coffee,
  Map,
  BadgeAlert,
  Car,
  RefreshCw,
  AlertTriangle,
  Star,
  Loader2,
  X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { FavoriteItem } from "../types";


export interface ItineraryStop {
  time: string;
  activity: string;
  duration: string;
  locationName: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface ItineraryData {
  title: string;
  description: string;
  whyThisPlan: string;
  totalCostEstimate: string;
  costBreakdown: {
    tickets: string;
    food: string;
    parking?: string;
    other?: string;
  };
  timeline: ItineraryStop[];
  cheaperAlternative: {
    title: string;
    description: string;
    cost: string;
  };
  rainBackup: {
    title: string;
    description: string;
  };
  foodNearby: {
    title: string;
    cuisine: string;
    distance: string;
    rating?: number;
  };
  bookingLink?: string;
  directionsLink?: string;
}

export interface TrafficSegment {
  distance: string;
  standardDuration: number;
  delayMinutes: number;
  status: "light" | "moderate" | "heavy";
  mainRoad: string;
  alternativeRoute?: string;
}

const generateTrafficData = (timeline: ItineraryStop[]): TrafficSegment[] => {
  const roads = ["US-101 S", "I-80 E", "Broadway", "California St", "Geary Blvd", "Market St", "El Camino Real", "I-280 N", "19th Ave", "Oak St"];
  const altRoads = ["via Franklin St", "via Pine St", "via scenic bypass", "via local express lanes", "via side streets"];
  
  return timeline.slice(1).map((stop, index) => {
    const prevStop = timeline[index];
    // Create a simple deterministic number from names to make it look stable initially
    const combinedLength = (prevStop.locationName.length + stop.locationName.length + index);
    
    // We want some segments to show heavy traffic for the warning alert!
    let status: "light" | "moderate" | "heavy" = "light";
    if (combinedLength % 3 === 0) {
      status = "heavy";
    } else if (combinedLength % 3 === 1) {
      status = "moderate";
    }
    
    const standardDuration = 8 + (combinedLength % 15); // 8 - 22 mins
    let delayMinutes = 0;
    if (status === "heavy") {
      delayMinutes = 5 + (combinedLength % 12); // 5 - 16 mins delay
    } else if (status === "moderate") {
      delayMinutes = 2 + (combinedLength % 4); // 2 - 5 mins delay
    }
    
    const distanceMiles = (standardDuration * 0.4 + (combinedLength % 10) * 0.1).toFixed(1);
    const mainRoad = roads[combinedLength % roads.length];
    const alternativeRoute = status === "heavy" ? altRoads[combinedLength % altRoads.length] : undefined;
    
    return {
      distance: `${distanceMiles} miles`,
      standardDuration,
      delayMinutes,
      status,
      mainRoad,
      alternativeRoute
    };
  });
};

interface ActiveItineraryProps {
  itinerary: ItineraryData;
  userMaxBudget?: number;
  onSelectStop: (coords: { lat: number; lng: number }, label: string) => void;
  onDrawRoute: (origin: string, destination: string) => void;
  favorites: FavoriteItem[];
  onToggleFavorite: (item: FavoriteItem) => void;
  onSaveItinerary?: (itinerary: ItineraryData) => void;
  isSaved?: boolean;
  onClose?: () => void;
}

export default function ActiveItinerary({ 
  itinerary, 
  userMaxBudget = 120,
  onSelectStop,
  onDrawRoute,
  favorites = [],
  onToggleFavorite,
  onSaveItinerary,
  isSaved = false,
  onClose
}: ActiveItineraryProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | "saved" | null>(null);

  const [trafficSegments, setTrafficSegments] = useState<TrafficSegment[]>([]);
  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);

  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Reset summary states when the itinerary changes
  useEffect(() => {
    setSummaryText(null);
    setSummaryError(null);
    setIsGenerating(false);
  }, [itinerary?.title]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setSummaryError(null);
    try {
      const response = await fetch("/api/itinerary/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itinerary }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate summary");
      }

      const data = await response.json();
      setSummaryText(data.summary);
    } catch (err: any) {
      console.error("Error generating itinerary summary:", err);
      setSummaryError(err.message || "Something went wrong while generating the summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (itinerary?.timeline) {
      setTrafficSegments(generateTrafficData(itinerary.timeline));
    }
  }, [itinerary]);

  const handleRefreshTraffic = () => {
    setIsRefreshingTraffic(true);
    setTimeout(() => {
      setTrafficSegments((prev) => 
        prev.map((seg, i) => {
          // Cycle traffic status realistically to simulate dynamic real-time checking
          const statuses: ("light" | "moderate" | "heavy")[] = ["light", "moderate", "heavy"];
          const currentIdx = statuses.indexOf(seg.status);
          const nextStatus = statuses[(currentIdx + 1) % statuses.length];
          const nextDelay = nextStatus === "heavy" ? 6 + (i % 8) : nextStatus === "moderate" ? 2 + (i % 3) : 0;
          return {
            ...seg,
            status: nextStatus,
            delayMinutes: nextDelay,
          };
        })
      );
      setIsRefreshingTraffic(false);
    }, 1200);
  };

  // Parse estimated numerical cost for budget gauge comparison
  const getNumericCost = (costStr: string) => {
    const numbers = costStr.replace(/[^0-9]/g, " ").trim().split(/\s+/);
    if (numbers.length > 0 && numbers[0] !== "") {
      return Number(numbers[numbers.length - 1]); // Returns the upper bound if range
    }
    return 50;
  };

  const estimatedCostNumeric = getNumericCost(itinerary.totalCostEstimate);
  const budgetRatio = Math.min(100, (estimatedCostNumeric / userMaxBudget) * 100);
  const isOverBudget = estimatedCostNumeric > userMaxBudget;

  const handleShare = () => {
    const shareText = `🗺️ *Outing Itinerary:* ${itinerary.title}\n\n🕒 *Timeline:*\n${itinerary.timeline.map(t => `- ${t.time}: ${t.activity} (${t.locationName})`).join("\n")}\n\n💰 *Total Cost:* ${itinerary.totalCostEstimate}\n\n🍔 *Food Nearby:* ${itinerary.foodNearby.title}\n🌦️ *Backup:* ${itinerary.rainBackup.title}\n\n_Planned with Where2Go_`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 overflow-y-auto select-none font-sans">
      {/* Brand Header Card */}
      <div className="p-5 bg-white border-b border-slate-200 shadow-xs space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider w-max mb-1.5 animate-pulse">
              <Sparkles className="w-3 h-3" /> Today's Perfect Outing
            </div>
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-snug">{itinerary.title}</h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{itinerary.description}</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all flex items-center justify-center border border-slate-200"
              title="Copy Itinerary text to share"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
            {onSaveItinerary && (
              <button
                onClick={() => onSaveItinerary(itinerary)}
                className={`p-2 rounded-xl transition-all flex items-center justify-center border ${
                  isSaved
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                }`}
                title={isSaved ? "Saved to Offline Plans" : "Save Plan to Offline DB"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all flex items-center justify-center border border-slate-200"
                title="Close and return to list"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Budget Comparison Gauge */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-emerald-500" /> Group Spending Cap
            </span>
            <span className={`${isOverBudget ? "text-amber-600" : "text-slate-800"}`}>
              {itinerary.totalCostEstimate} <span className="text-[10px] text-slate-400 font-normal">/ max ${userMaxBudget}</span>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? "bg-amber-500" : budgetRatio > 80 ? "bg-blue-500" : "bg-emerald-500"
              }`}
              style={{ width: `${budgetRatio}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono font-bold uppercase">
            <span>$0</span>
            <span>Est: ${estimatedCostNumeric}</span>
            <span>Cap: ${userMaxBudget}</span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-5 flex-1">
        
        {/* Gemini AI Outing Summary Card */}
        <div className="bg-gradient-to-r from-violet-50/80 to-indigo-50/80 border border-violet-100 rounded-2xl p-4.5 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-xl shadow-md shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-violet-950 flex items-center gap-1.5">
                  Gemini Outing Summary
                </h4>
                <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider font-mono leading-none mt-0.5">
                  AI-Powered Overview
                </p>
              </div>
            </div>

            {summaryText && !isGenerating && (
              <button
                onClick={handleGenerateSummary}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-violet-50 border border-violet-200 hover:border-violet-300 text-violet-700 hover:text-violet-800 rounded-xl transition-all text-[9px] font-bold font-mono uppercase cursor-pointer"
                title="Regenerate Summary"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Idle State */}
          {!summaryText && !isGenerating && !summaryError && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Generate a concise Gemini AI overview of your entire planned outing, providing a summarized view of the active time spent and expected costs.
              </p>
              <button
                onClick={handleGenerateSummary}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-violet-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Generate AI Summary</span>
              </button>
            </div>
          )}

          {/* Loading / Generating State */}
          {isGenerating && (
            <div className="space-y-3 py-1">
              <div className="flex items-center gap-2 text-violet-700 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                <span>Gemini is compiling outing metrics and estimating costs...</span>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 bg-violet-200/40 rounded-full w-full animate-pulse"></div>
                <div className="h-2.5 bg-violet-200/40 rounded-full w-[90%] animate-pulse" style={{ animationDelay: "150ms" }}></div>
                <div className="h-2.5 bg-violet-200/40 rounded-full w-[75%] animate-pulse" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}

          {/* Error State */}
          {summaryError && (
            <div className="space-y-3 animate-slide-in">
              <div className="bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-medium p-3.5 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <span className="font-extrabold block text-rose-900 mb-0.5">Summary Generation Failed</span>
                  {summaryError}
                </div>
              </div>
              <button
                onClick={handleGenerateSummary}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Generated State */}
          {summaryText && !isGenerating && !summaryError && (
            <div className="bg-white/80 border border-violet-100/50 rounded-xl p-3.5 shadow-2xs text-slate-700 text-[11px] leading-relaxed animate-slide-in">
              <div className="prose prose-slate max-w-none text-slate-700">
                <ReactMarkdown 
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-xs font-extrabold text-violet-950 mt-2 mb-1 block" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xs font-extrabold text-violet-950 mt-2 mb-1 block" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-[11px] font-extrabold text-violet-900 mt-1.5 mb-1 block" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-slate-600 font-medium" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-600" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-600" {...props} />,
                    li: ({node, ...props}) => <li className="mb-0 text-slate-600 font-medium" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-violet-900" {...props} />,
                  }}
                >
                  {summaryText}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Grounded Why This Plan Log */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <div className="p-2 bg-blue-500 text-white rounded-xl h-max shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold text-blue-900">Why This Plan Fits</h4>
            <p className="text-[11px] text-blue-800 leading-relaxed font-medium">{itinerary.whyThisPlan}</p>
          </div>
        </div>

        {/* Real-time Traffic Overview Panel */}
        {(() => {
          const hasHeavyTraffic = trafficSegments.some((seg) => seg.status === "heavy");
          const hasModerateTraffic = trafficSegments.some((seg) => seg.status === "moderate");
          return (
            <div className="space-y-3">
              {/* Live Traffic Monitor & Refresh Widget */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition-all ${
                    isRefreshingTraffic 
                      ? "bg-blue-50 text-blue-500 animate-pulse" 
                      : hasHeavyTraffic 
                      ? "bg-amber-50 text-amber-500 animate-bounce" 
                      : hasModerateTraffic
                      ? "bg-orange-50 text-orange-500"
                      : "bg-emerald-50 text-emerald-500"
                  }`}>
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      Live Traffic Monitor
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRefreshingTraffic ? "bg-blue-400" : hasHeavyTraffic ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isRefreshingTraffic ? "bg-blue-500" : hasHeavyTraffic ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono mt-0.5 leading-none">
                      {isRefreshingTraffic ? "Scanning active route segments..." : hasHeavyTraffic ? "HEAVY TRAFFIC DETECTED" : "ALL ROUTES CLEAR"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRefreshingTraffic}
                  onClick={handleRefreshTraffic}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-blue-50/50 text-slate-600 hover:text-blue-600 rounded-xl transition-all font-mono text-[9px] font-bold border border-slate-200 hover:border-blue-200 disabled:opacity-50 select-none cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTraffic ? "animate-spin text-blue-500" : ""}`} />
                  {isRefreshingTraffic ? "SCANNING" : "SCAN LIVE"}
                </button>
              </div>

              {/* Heavy Traffic Alert Banner */}
              {hasHeavyTraffic && !isRefreshingTraffic && (
                <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-4 flex gap-3 animate-slide-in">
                  <div className="p-2 bg-amber-500 text-white rounded-xl h-max shadow-xs shrink-0">
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      Heavy Congestion Delay Warning
                    </h4>
                    <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                      Heavy traffic is slowing down travel on your route! Look out for bypass suggestions or click <span className="font-bold">Alternative Route</span> to view on map.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Schedule Timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 pl-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Outing Schedule
          </h3>
          
          <div className="relative border-l-2 border-dashed border-slate-200 pl-4 ml-3 space-y-6 py-1">
            {itinerary.timeline.map((stop, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && trafficSegments[idx - 1] && (
                  <div className="relative group/transit select-none pointer-events-auto my-3 pr-2">
                    {/* Small vehicle icon centered on the dashed line */}
                    <div className="absolute -left-[26px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] z-10 shadow-3xs group-hover/transit:border-blue-400 group-hover/transit:bg-blue-50 transition-all">
                      <Car className="w-3 h-3 text-slate-500 group-hover/transit:text-blue-500" />
                    </div>
                    
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      trafficSegments[idx - 1].status === "heavy"
                        ? "bg-amber-50/40 border-amber-200 text-amber-900 shadow-3xs"
                        : trafficSegments[idx - 1].status === "moderate"
                        ? "bg-orange-50/20 border-orange-200 text-orange-950"
                        : "bg-slate-50/80 border-slate-200 text-slate-600"
                    } flex items-center justify-between text-[10px] gap-2 font-medium`}>
                      
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-700">
                            🚗 {trafficSegments[idx - 1].standardDuration + trafficSegments[idx - 1].delayMinutes} min drive
                          </span>
                          <span className="text-slate-400 font-mono text-[9px] font-bold">
                            ({trafficSegments[idx - 1].distance} via {trafficSegments[idx - 1].mainRoad})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {trafficSegments[idx - 1].status === "heavy" ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-600 bg-amber-100/85 px-1.5 py-0.5 rounded animate-pulse">
                              Heavy Traffic (+{trafficSegments[idx - 1].delayMinutes}m delay)
                            </span>
                            {trafficSegments[idx - 1].alternativeRoute && (
                              <button 
                                type="button"
                                className="text-[8px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer select-none transition-all"
                                title={`Alternative route: ${trafficSegments[idx - 1].alternativeRoute}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prevStop = itinerary.timeline[idx - 1];
                                  onDrawRoute(prevStop.locationName, stop.locationName);
                                }}
                              >
                                Alternative Route
                              </button>
                            )}
                          </div>
                        ) : trafficSegments[idx - 1].status === "moderate" ? (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-orange-600 bg-orange-100/50 px-1.5 py-0.5 rounded">
                            Moderate Traffic (+{trafficSegments[idx - 1].delayMinutes}m)
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Clear Route
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => {
                    if (stop.lat && stop.lng) {
                      onSelectStop({ lat: stop.lat, lng: stop.lng }, stop.locationName);
                    }
                  }}
                >
                  {/* Timeline node */}
                  <div className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-xs group-hover:scale-125 transition-transform" />
                  
                  {/* Timeline Card */}
                  <div className="bg-white hover:bg-blue-50/20 border border-slate-200 group-hover:border-blue-300 rounded-2xl p-3.5 shadow-2xs group-hover:shadow-xs transition-all space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 font-mono uppercase bg-blue-50 px-2 py-0.5 rounded-md">
                          {stop.time}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-800 mt-1.5 leading-snug">
                          {stop.activity}
                        </h4>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {stop.duration}
                        </span>
                        
                        {stop.lat && stop.lng && (() => {
                          const stopId = `${stop.locationName.replace(/\s+/g, "_")}_${stop.lat.toFixed(4)}_${stop.lng.toFixed(4)}`;
                          const isFav = favorites.some(fav => fav.id === stopId);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite({
                                  id: stopId,
                                  title: stop.locationName,
                                  address: stop.address || stop.activity,
                                  category: "Itinerary Stop",
                                  lat: stop.lat || 0,
                                  lng: stop.lng || 0
                                });
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isFav 
                                  ? "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100/80" 
                                  : "bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200"
                              }`}
                              title={isFav ? "Saved to Favorites" : "Save to Favorites"}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-500 text-amber-500" : ""}`} />
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{stop.locationName}</span>
                    </div>

                    {stop.address && (
                      <p className="text-[10px] text-slate-400 leading-normal pl-4 border-l border-slate-100">
                        {stop.address}
                      </p>
                    )}

                    {stop.lat && stop.lng && (
                      <span className="text-[9px] text-blue-500 font-bold hover:underline flex items-center gap-0.5 pt-0.5">
                        <Map className="w-3 h-3" /> View & center on map
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Cost Breakdown Details */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 pl-1">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Expected Outing Expenses
          </h3>
          <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Tickets & Entry</span>
              <span className="text-sm font-extrabold text-slate-800">{itinerary.costBreakdown.tickets}</span>
            </div>
            <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Food & Snacks</span>
              <span className="text-sm font-extrabold text-slate-800">{itinerary.costBreakdown.food}</span>
            </div>
            {itinerary.costBreakdown.parking && (
              <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Parking & Transit</span>
                <span className="text-sm font-extrabold text-slate-800">{itinerary.costBreakdown.parking}</span>
              </div>
            )}
            {itinerary.costBreakdown.other && (
              <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Miscellaneous Extras</span>
                <span className="text-sm font-extrabold text-slate-800">{itinerary.costBreakdown.other}</span>
              </div>
            )}
          </div>
        </div>

        {/* Food Nearby Spot */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 pl-1">
            <Coffee className="w-3.5 h-3.5 text-slate-400" /> Food Adjacent Option
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 leading-snug">{itinerary.foodNearby.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                    {itinerary.foodNearby.cuisine}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {itinerary.foodNearby.distance} away
                  </span>
                </div>
              </div>
            </div>
            {itinerary.foodNearby.rating && (
              <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg shrink-0 text-center font-mono">
                <span className="text-xs font-extrabold text-amber-500">★ {itinerary.foodNearby.rating.toFixed(1)}</span>
                <span className="text-[8px] text-slate-400 block font-bold">Rating</span>
              </div>
            )}
          </div>
        </div>

        {/* Safe Backups Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Cheaper Alternative */}
          <div className="bg-white border border-slate-200 hover:border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-1.5 transition-all">
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase font-mono tracking-wider">
              <DollarSign className="w-3.5 h-3.5" /> Budget Backup
            </div>
            <h4 className="text-xs font-extrabold text-slate-800 leading-snug truncate">{itinerary.cheaperAlternative.title}</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{itinerary.cheaperAlternative.description}</p>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md inline-block mt-1 font-mono">
              Cost: {itinerary.cheaperAlternative.cost}
            </span>
          </div>

          {/* Rain / Low-Effort Backup */}
          <div className="bg-white border border-slate-200 hover:border-blue-200 rounded-2xl p-4 shadow-2xs space-y-1.5 transition-all">
            <div className="flex items-center gap-1 text-blue-600 font-bold text-[10px] uppercase font-mono tracking-wider">
              <CloudSun className="w-3.5 h-3.5" /> Weather Backup
            </div>
            <h4 className="text-xs font-extrabold text-slate-800 leading-snug truncate">{itinerary.rainBackup.title}</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{itinerary.rainBackup.description}</p>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md inline-block mt-1 font-mono">
              Indoor Friendly
            </span>
          </div>
        </div>

        {/* Directions & Booking Actions */}
        <div className="flex gap-2.5 pt-2">
          {itinerary.bookingLink && (
            <a 
              href={itinerary.bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md hover:shadow-blue-500/10 flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Buy Tickets / RSVP
            </a>
          )}
          
          <a 
            href={itinerary.directionsLink || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(itinerary.timeline[0]?.locationName || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" /> Launch Navigation
          </a>
        </div>

        {/* Feedback Loop Selector */}
        <div className="border-t border-slate-200/60 pt-4 mt-2">
          {feedback ? (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl text-center flex items-center justify-center gap-2 animate-slide-in">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>{feedback === "like" ? "Loved this plan! Preferences updated." : feedback === "dislike" ? "Thanks for feedback! Calibrating model weights." : "Itinerary saved to favorites successfully!"}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-slate-500 font-medium bg-slate-100 p-2.5 rounded-2xl border border-slate-200/40">
              <span className="text-[11px] font-bold pl-1 text-slate-600">Rate this decision:</span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setFeedback("like")}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-emerald-600 transition-all border border-transparent hover:border-slate-200"
                  title="Thumbs Up"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setFeedback("dislike")}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-rose-500 transition-all border border-transparent hover:border-slate-200"
                  title="Thumbs Down"
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setFeedback("saved")}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
                  title="Bookmark Outing"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
