import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

export function getGeminiClient() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    "";
  return new GoogleGenAI({ apiKey });
}

export function getGeminiModel(): string {
  return process.env.GOOGLE_AI_MODEL || process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

/** Gemini 3+ required when mixing built-in tools (Maps/Search) with function calling. */
export function getGeminiModelForChat(searchMode: string): string {
  const configured = process.env.GOOGLE_AI_MODEL || process.env.GEMINI_MODEL;
  if (configured) return configured;
  if (searchMode === "maps" || searchMode === "web") {
    return "gemini-3-flash-preview";
  }
  return "gemini-2.5-flash";
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

export const addMarkersTool: FunctionDeclaration = {
  name: "add_markers",
  description:
    "Plot one or more location markers on the interactive map. ALWAYS call this when you recommend specific places.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      markers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            title: { type: Type.STRING },
            address: { type: Type.STRING },
            rating: { type: Type.NUMBER },
            category: { type: Type.STRING },
          },
          required: ["lat", "lng", "title"],
        },
      },
      zoom: { type: Type.INTEGER },
      focusCenter: { type: Type.BOOLEAN },
    },
    required: ["markers"],
  },
};

export const drawRouteTool: FunctionDeclaration = {
  name: "draw_route",
  description: "Draw a route on the map between an origin and a destination.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: { type: Type.STRING },
      destination: { type: Type.STRING },
      travelMode: {
        type: Type.STRING,
        enum: ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"],
      },
    },
    required: ["origin", "destination", "travelMode"],
  },
};

export const setMapViewTool: FunctionDeclaration = {
  name: "set_map_view",
  description: "Update the map center coordinates and zoom level.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      lat: { type: Type.NUMBER },
      lng: { type: Type.NUMBER },
      zoom: { type: Type.INTEGER },
    },
    required: ["lat", "lng", "zoom"],
  },
};

export const clearMapTool: FunctionDeclaration = {
  name: "clear_map",
  description: "Clear all current markers and routes from the map.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const generatePlanTool: FunctionDeclaration = {
  name: "generate_plan",
  description:
    "Generate a real provider-backed outing plan using the Where2Go recommendation engine. Call this when the user requests a plan, itinerary, schedule, or day out.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      queryText: {
        type: Type.STRING,
        description: "Natural language description of the desired outing.",
      },
    },
    required: ["queryText"],
  },
};
