import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  MapPin, 
  Globe, 
  Sparkles, 
  Compass, 
  Navigation, 
  RotateCcw, 
  Search, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Users,
  Sliders,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  CloudSun,
  FileJson,
  Check,
  Mic,
  MicOff
} from "lucide-react";
import { Message, MapMarker, MapRoute } from "../types";
import Logo from "./Logo";

interface ChatInterfaceProps {
  messages: Message[];
  isSending: boolean;
  onSendMessage: (text: string, mode: "maps" | "web" | "none") => void;
  onClearChat: () => void;
  mapCenter: { lat: number; lng: number };
  searchMode: "maps" | "web" | "none";
  setSearchMode: (mode: "maps" | "web" | "none") => void;
  onGeocodeSearch: (query: string) => void;
  onSelectMarker: (index: number) => void;
  activeMarkers: MapMarker[];
  onOpenProfile: () => void;
}

const QUICK_PROMPTS = [
  { text: "Family-friendly afternoon within 25 mins under $100", icon: "👨‍👩‍👧‍👦", mode: "maps" as const },
  { text: "Find a quiet park and nearby ice cream for toddlers", icon: "🍦", mode: "maps" as const },
  { text: "Rainy day indoor museum outing with a snack stop", icon: "🏛️", mode: "maps" as const },
  { text: "Scenic hiking trail with under $40 cost nearby", icon: "🌲", mode: "maps" as const },
];

export default function ChatInterface({
  messages,
  isSending,
  onSendMessage,
  onClearChat,
  mapCenter,
  searchMode,
  setSearchMode,
  onGeocodeSearch,
  onSelectMarker,
  activeMarkers,
  onOpenProfile,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const [mapSearchText, setMapSearchText] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Quick Outing Planner Form State
  const [mood, setMood] = useState("Parks & Playgrounds");
  const [costLevel, setCostLevel] = useState("Under $120");
  const [driveTime, setDriveTime] = useState("30 minutes");
  const [kidAgeGroup, setKidAgeGroup] = useState("Kids (5-11)");
  const [weatherPrep, setWeatherPrep] = useState("Sunshine / Outdoors");

  // Freeform Outing Planner State
  const [isFreeformOpen, setIsFreeformOpen] = useState(false);
  const [freeformText, setFreeformText] = useState("");
  const [jsonString, setJsonString] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParseFreeform = async () => {
    if (!freeformText.trim() || isParsing) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const response = await fetch("/api/parse-choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeFormText: freeformText.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse choices into JSON.");
      }
      const data = await response.json();
      setJsonString(JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error("Parse error:", err);
      setParseError(err.message || "An error occurred during JSON parsing.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateFreeformPlan = () => {
    if (isSending) return;
    try {
      const parsed = JSON.parse(jsonString);
      setIsFreeformOpen(false);
      const constructedPrompt = `Plan a custom Where2Go outing matching these parsed JSON constraints:
- Outing Style: ${parsed.style || "Scenic & Relaxing"}
- Budget Guardrail: ${parsed.budgetLimit || "Under $120"}
- Travel Limit (Drive Time): ${parsed.driveTime || "30 minutes"}
- Kid Age Profile: ${parsed.kidAgeGroup || "No Kids / Adults Only"}
- Weather Prep: ${parsed.weatherPrep || "Flexible / Any Weather"}
- Additional Custom Guidelines: ${parsed.customNotes || ""}
Please search real-time data, plot the timeline on the map, and output a structured display itinerary.`;
      onSendMessage(constructedPrompt, "maps");
    } catch (err) {
      setParseError("Cannot generate plan: The current text is not valid JSON.");
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech API Voice Input States
  const [isListening, setIsListening] = useState(false);
  const [browserSupportsSpeech, setBrowserSupportsSpeech] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        setBrowserSupportsSpeech(true);
        const rec = new SpeechRecognitionAPI();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText((prev) => prev ? `${prev} ${transcript}` : transcript);
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error", event);
          if (event.error !== "no-speech") {
            setSpeechError(`Voice input error: ${event.error}`);
          }
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error("Failed to start speech recognition", err);
        setSpeechError("Microphone permission denied or source in use.");
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    onSendMessage(inputText.trim(), searchMode);
    setInputText("");
  };

  const handleQuickPromptClick = (text: string, mode: "maps" | "web" | "none") => {
    if (isSending) return;
    setSearchMode(mode);
    onSendMessage(text, mode);
  };

  const handleMapSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchText.trim()) return;
    onGeocodeSearch(mapSearchText.trim());
    setMapSearchText("");
  };

  const handleGenerateQuickPlan = () => {
    if (isSending) return;
    setIsFormOpen(false);
    const constructedPrompt = `Plan a custom Where2Go outing matching these constraints:
- Outing Style: ${mood}
- Budget Guardrail: ${costLevel}
- Travel Limit (Drive Time): ${driveTime}
- Kid Age Profile: ${kidAgeGroup}
- Weather Prep: ${weatherPrep}
Please search real-time data, plot the timeline on the map, and output a structured display itinerary.`;
    onSendMessage(constructedPrompt, "maps");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 select-none">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="w-8 h-8" />
            <div>
              <h1 className="font-extrabold text-base text-slate-800 tracking-tight leading-none flex items-center gap-1">
                Where2Go
              </h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                Local Decision Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenProfile}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
              title="Configure Family / Group Settings"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Group Profile</span>
            </button>
            <button
              onClick={onClearChat}
              className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Map Search / Geocoding Box */}
        <form onSubmit={handleMapSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            placeholder="Search map location (e.g. San Francisco)..."
            value={mapSearchText}
            onChange={(e) => setMapSearchText(e.target.value)}
            className="w-full pl-8 pr-16 py-1.5 bg-slate-100 border border-transparent rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <button
            type="submit"
            className="absolute right-1 px-2.5 py-1 bg-slate-200 hover:bg-blue-600 hover:text-white rounded text-[10px] font-bold text-slate-700 transition-colors"
          >
            Go
          </button>
        </form>

        {/* Quick Plan Outing Collapsible Form */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50">
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="w-full px-3 py-2 bg-white flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all border-b border-slate-100"
          >
            <span className="flex items-center gap-1.5 text-blue-600">
              <Sliders className="w-3.5 h-3.5" />
              <span>Quick Plan Request Form</span>
            </span>
            {isFormOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {isFormOpen && (
            <div className="p-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Outing Style</label>
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Parks & Playgrounds">Parks & Playgrounds</option>
                    <option value="Museums & Culture">Museums & Culture</option>
                    <option value="Active Adventure">Active Adventure</option>
                    <option value="Scenic & Relaxing">Scenic & Relaxing</option>
                    <option value="Indoor Entertainment">Indoor Entertainment</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-0.5">
                    <DollarSign className="w-3 h-3 text-emerald-500" /> Budget Limit
                  </label>
                  <select
                    value={costLevel}
                    onChange={(e) => setCostLevel(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Free Outings Only">Free / Zero Cost</option>
                    <option value="Under $50">Under $50</option>
                    <option value="Under $120">Under $120</option>
                    <option value="Premium / Flexible">Flexible / Premium</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-0.5">
                    <Clock className="w-3 h-3 text-blue-500" /> Drive Time
                  </label>
                  <select
                    value={driveTime}
                    onChange={(e) => setDriveTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="15 minutes">15 mins</option>
                    <option value="30 minutes">30 mins</option>
                    <option value="45 minutes">45 mins</option>
                    <option value="60 minutes+">60 mins+</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-0.5">
                    <CloudSun className="w-3 h-3 text-amber-500" /> Weather Prep
                  </label>
                  <select
                    value={weatherPrep}
                    onChange={(e) => setWeatherPrep(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Sunshine / Outdoors">Outdoors Sunshine</option>
                    <option value="Rainy / Indoor Friendly">Rainy / Indoors</option>
                    <option value="Flexible / Any Weather">Flexible / Any</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Kid Age Profile</label>
                <select
                  value={kidAgeGroup}
                  onChange={(e) => setKidAgeGroup(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="Toddlers (0-4 years)">Toddlers (0-4)</option>
                  <option value="Kids (5-11 years)">Kids (5-11)</option>
                  <option value="Teens (12+ years)">Teens (12+)</option>
                  <option value="No Kids / Adults Only">No Kids / Adults Only</option>
                </select>
              </div>

              <button
                onClick={handleGenerateQuickPlan}
                disabled={isSending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm hover:shadow-blue-500/10 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Decision Plan ✨</span>
              </button>
            </div>
          )}
        </div>

        {/* Freeform AI Planner & JSON Parser */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50">
          <button
            onClick={() => setIsFreeformOpen(!isFreeformOpen)}
            className="w-full px-3 py-2 bg-white flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all border-b border-slate-100"
          >
            <span className="flex items-center gap-1.5 text-purple-600">
              <FileJson className="w-3.5 h-3.5" />
              <span>Freeform Choice Parser & Planner</span>
            </span>
            {isFreeformOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {isFreeformOpen && (
            <div className="p-3 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Enter Choices & Preferences (Free-form Text)
                </label>
                <textarea
                  value={freeformText}
                  onChange={(e) => setFreeformText(e.target.value)}
                  placeholder="Describe your perfect outing in plain language, e.g., 'A rainy day museum trip with toddlers, under $50 budget, then a pizza spot near the museum...'"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 text-xs resize-none"
                />
              </div>

              {/* Clickable Examples */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                  Quick Templates & Examples
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    {
                      label: "🌲 Outdoors / Teens",
                      text: "A sunny outdoor adventure hike with 2 teenagers, within a 30-minute drive. Completely free, then a cheap smoothie stop nearby."
                    },
                    {
                      label: "🏛️ Rainy Day / Toddlers",
                      text: "We have active toddlers and want an educational indoor museum for under $50 on a rainy day, with a quick snack stop afterwards."
                    },
                    {
                      label: "☕ Coffee & Walk / Adults",
                      text: "Cozy morning coffee at a cute bakery, then a scenic beach stroll. Adults only, within 15 minutes of here, budget under $120."
                    }
                  ].map((ex, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFreeformText(ex.text)}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 rounded-full text-[10px] font-semibold text-slate-600 transition-all text-left"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleParseFreeform}
                disabled={isParsing || !freeformText.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm hover:shadow-purple-500/10 transition-all disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing & Structuring...</span>
                  </>
                ) : (
                  <>
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Convert to JSON ⚙️</span>
                  </>
                )}
              </button>

              {parseError && (
                <div className="p-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[11px] font-medium leading-relaxed">
                  {parseError}
                </div>
              )}

              {jsonString && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      Parsed Structured JSON (Editable)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> Valid JSON
                    </span>
                  </div>
                  <textarea
                    value={jsonString}
                    onChange={(e) => setJsonString(e.target.value)}
                    rows={8}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateFreeformPlan}
                    disabled={isSending || !jsonString.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm hover:shadow-blue-500/10 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Decision Plan ✨</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grounding Mode Toggle */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold">
          <button
            onClick={() => setSearchMode("maps")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              searchMode === "maps"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Maps Search</span>
          </button>
          <button
            onClick={() => setSearchMode("web")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              searchMode === "web"
                ? "bg-white text-emerald-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Search</span>
          </button>
          <button
            onClick={() => setSearchMode("none")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              searchMode === "none"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Knowledge</span>
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Compass className="w-6 h-6" />
            </div>
            <div className="max-w-xs">
              <h2 className="font-extrabold text-slate-800 text-base tracking-tight mb-1">Welcome to Where2Go!</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask questions about spots, sights, and routes. I'll search real-time data and pin them on the interactive map!
              </p>
            </div>

            {/* Quickstart Prompts */}
            <div className="w-full max-w-sm pt-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-left pl-1">
                Try asking me:
              </div>
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPromptClick(prompt.text, prompt.mode)}
                  className="w-full text-left p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all shadow-2xs flex items-start gap-2.5 text-xs font-semibold text-slate-700"
                >
                  <span className="text-sm">{prompt.icon}</span>
                  <span className="leading-tight">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl shadow-2xs ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                  }`}
                >
                  {/* Markdown text response */}
                  <div className={`prose prose-sm max-w-none break-words ${isUser ? "text-white" : "text-slate-800"}`}>
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed text-xs md:text-[13px]" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 text-xs md:text-[13px] space-y-0.5" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 text-xs md:text-[13px] space-y-0.5" {...props} />,
                        li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="font-bold text-sm mb-1 mt-2 first:mt-0" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="font-bold text-xs mb-1 mt-2 first:mt-0" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="font-semibold text-xs mb-1 mt-2" {...props} />,
                        strong: ({ node, ...props }) => (
                          <strong 
                            className={`font-bold ${isUser ? "text-white font-extrabold" : "text-slate-900"}`} 
                            {...props} 
                          />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className={`hover:underline font-semibold inline-flex items-center gap-0.5 ${
                              isUser ? "text-blue-100 hover:text-white" : "text-blue-600 hover:text-blue-800"
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Render Route detail indicator if drawn */}
                  {msg.route && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-xs text-blue-800 flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold">Route plotted!</div>
                        <div className="text-blue-600 text-[11px] font-medium mt-0.5">
                          From: {typeof msg.route.origin === "string" ? msg.route.origin : "Map Location"} <br />
                          To: {typeof msg.route.destination === "string" ? msg.route.destination : "Map Location"}
                        </div>
                        <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded">
                          {msg.route.travelMode}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Render Markers plotted indicators if added */}
                  {msg.markers && msg.markers.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>Pinned locations ({msg.markers.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.markers.map((marker, mIdx) => (
                          <button
                            key={mIdx}
                            onClick={() => {
                              // Find index of this marker in the main active markers list
                              const globalIdx = activeMarkers.findIndex(
                                (am) => am.lat === marker.lat && am.lng === marker.lng
                              );
                              if (globalIdx !== -1) {
                                onSelectMarker(globalIdx);
                              }
                            }}
                            className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-full transition-all flex items-center gap-1 font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="truncate max-w-[120px]">{marker.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Google Maps Grounding Citations */}
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                        References:
                      </div>
                      <div className="space-y-1">
                        {msg.groundingChunks.map((chunk, cIdx) => {
                          if (chunk.maps) {
                            return (
                              <a
                                key={cIdx}
                                href={chunk.maps.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between text-[11px] text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-150 transition-colors"
                              >
                                <span className="flex items-center gap-1 font-semibold truncate max-w-[85%]">
                                  🗺️ {chunk.maps.title}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                              </a>
                            );
                          }
                          if (chunk.web) {
                            return (
                              <a
                                key={cIdx}
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between text-[11px] text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-150 transition-colors"
                              >
                                <span className="flex items-center gap-1 font-semibold truncate max-w-[85%]">
                                  🌐 {chunk.web.title}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                              </a>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] p-4 rounded-2xl bg-white border border-slate-200 rounded-bl-none flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-500 animate-pulse">
                {searchMode === "maps"
                  ? "Searching Google Maps..."
                  : searchMode === "web"
                  ? "Grounding with Web Search..."
                  : "Thinking..."}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Speech Status Indicator Banner */}
      {(isListening || speechError) && (
        <div className={`px-4 py-2 border-t flex items-center justify-between text-xs transition-all ${
          speechError 
            ? "bg-red-50 border-red-200 text-red-600" 
            : "bg-blue-50 border-blue-200 text-blue-700 animate-pulse"
        }`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${speechError ? "bg-red-400" : "bg-blue-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${speechError ? "bg-red-500" : "bg-blue-500"}`}></span>
            </span>
            <span className="font-bold">
              {speechError ? speechError : "Listening... Speak clearly into your microphone."}
            </span>
          </div>
          {speechError && (
            <button 
              type="button" 
              onClick={() => setSpeechError(null)}
              className="text-[10px] font-black text-red-500 hover:text-red-700 underline uppercase font-mono cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200 flex gap-2 items-center">
        {browserSupportsSpeech && (
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-all shadow-sm active:scale-95 shrink-0 select-none cursor-pointer border ${
              isListening
                ? "bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
            }`}
            title={isListening ? "Listening... click to stop" : "Record voice input (Web Speech API)"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        <input
          type="text"
          placeholder={
            searchMode === "maps"
              ? "Ask about spots, routes, restaurants..."
              : searchMode === "web"
              ? "Ask anything using Google Search..."
              : "Ask standard AI questions..."
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isSending}
          className="flex-1 px-3.5 py-2.5 bg-slate-100 border border-transparent rounded-xl text-xs md:text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:active:scale-100 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
