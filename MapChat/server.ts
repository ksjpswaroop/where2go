import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Local Database File for Reviews and Ratings
const REVIEWS_FILE = path.join(process.cwd(), "reviews.json");

interface LocalReview {
  id: string;
  locationName: string;
  rating: number;
  comment: string;
  username: string;
  timestamp: string;
}

// Helper to read reviews
function getLocalReviews(): LocalReview[] {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const data = fs.readFileSync(REVIEWS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading reviews file:", error);
  }
  return [];
}

// Helper to write reviews
function saveLocalReviews(reviews: LocalReview[]) {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing reviews file:", error);
  }
}

// Initialize Gemini Client server-side
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Definition for interactive map function calls
const addMarkersTool: FunctionDeclaration = {
  name: "add_markers",
  description: "Plot one or more location markers on the interactive map. ALWAYS call this when you recommend, list, or mention specific places (like hotels, restaurants, cafes, parks, monuments, businesses) in your response so that the user can see them visually.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      markers: {
        type: Type.ARRAY,
        description: "The list of places to pin on the map.",
        items: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER, description: "Latitude of the place" },
            lng: { type: Type.NUMBER, description: "Longitude of the place" },
            title: { type: Type.STRING, description: "Name of the place" },
            address: { type: Type.STRING, description: "Full formatted address or location" },
            rating: { type: Type.NUMBER, description: "Google Places API Rating of the place (0.0 to 5.0) if known" },
            category: { type: Type.STRING, description: "Type of place (e.g., Cafe, Restaurant, Park, Sight, Hotel, Shop, etc.)" }
          },
          required: ["lat", "lng", "title"]
        }
      },
      zoom: { type: Type.INTEGER, description: "Suggested map zoom level (typically 12 to 16)." },
      focusCenter: { type: Type.BOOLEAN, description: "Whether to auto-adjust the map view to center on these markers. Usually set to true." }
    },
    required: ["markers"]
  }
};

const drawRouteTool: FunctionDeclaration = {
  name: "draw_route",
  description: "Draw a route on the map between an origin and a destination. Use this when the user asks for directions, routes, how to get from one place to another, or travel times. Also provides details about distance and estimated travel times.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: { type: Type.STRING, description: "Starting point (address, city name, place name, or coordinate string)." },
      destination: { type: Type.STRING, description: "Ending point (address, city name, place name, or coordinate string)." },
      travelMode: { 
        type: Type.STRING, 
        description: "Mode of transportation. MUST be DRIVING, WALKING, BICYCLING, or TRANSIT.",
        enum: ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"]
      }
    },
    required: ["origin", "destination", "travelMode"]
  }
};

const setMapViewTool: FunctionDeclaration = {
  name: "set_map_view",
  description: "Update the map's center coordinates and zoom level. Use this when the user asks to pan or view a specific city, country, or location, without adding specific place markers.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      lat: { type: Type.NUMBER, description: "Target latitude" },
      lng: { type: Type.NUMBER, description: "Target longitude" },
      zoom: { type: Type.INTEGER, description: "Target zoom level (e.g. 2 for world, 10 for city, 15 for neighborhood)" }
    },
    required: ["lat", "lng", "zoom"]
  }
};

const clearMapTool: FunctionDeclaration = {
  name: "clear_map",
  description: "Clear all current markers, routes, and custom pins from the map. Use this when the user asks to start fresh, clean the map, or remove previously added pins.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const displayItineraryTool: FunctionDeclaration = {
  name: "display_itinerary",
  description: "Display a beautiful, highly detailed step-by-step local outing itinerary card for the user. ALWAYS call this when a user asks for a plan, an outing, a day out, a weekend schedule, or an itinerary. This triggers the interactive timeline, cost breakdown, backup options, and routing logic in the visual interface.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the outing plan (e.g. 'Golden Gate Park Family Adventure')" },
      description: { type: Type.STRING, description: "Short summary of the overall experience (1-2 sentences)." },
      whyThisPlan: { type: Type.STRING, description: "Grounded, specific explanation of why this plan fits the user's constraints (e.g., weather suitability, budget limit, drive limits, kid-friendliness)." },
      totalCostEstimate: { type: Type.STRING, description: "Estimated total cost range for the whole group (e.g. '$60 - $110')" },
      costBreakdown: {
        type: Type.OBJECT,
        properties: {
          tickets: { type: Type.STRING, description: "Estimated tickets or admission costs (e.g. '$30' or 'Free')" },
          food: { type: Type.STRING, description: "Estimated meals or snacks cost (e.g. '$40')" },
          parking: { type: Type.STRING, description: "Estimated parking or transit cost (e.g. '$10')" },
          other: { type: Type.STRING, description: "Estimated miscellaneous costs (e.g. '$10' or 'None')" }
        },
        required: ["tickets", "food"]
      },
      timeline: {
        type: Type.ARRAY,
        description: "Step-by-step scheduled timeline for the day.",
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING, description: "Scheduled time block (e.g. '1:30 PM - 3:00 PM')" },
            activity: { type: Type.STRING, description: "Action-oriented title of what they will do" },
            duration: { type: Type.STRING, description: "Duration of the stop (e.g. '1.5 hours' or '30 mins')" },
            locationName: { type: Type.STRING, description: "Name of the venue or place" },
            address: { type: Type.STRING, description: "Formatted address of the location" },
            lat: { type: Type.NUMBER, description: "Latitude of this specific stop" },
            lng: { type: Type.NUMBER, description: "Longitude of this specific stop" }
          },
          required: ["time", "activity", "locationName"]
        }
      },
      cheaperAlternative: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Low-cost or free alternative activity nearby" },
          description: { type: Type.STRING, description: "Brief description of the alternative option" },
          cost: { type: Type.STRING, description: "Estimated cost range (e.g. 'Free' or '$15 - $25')" }
        },
        required: ["title", "description", "cost"]
      },
      rainBackup: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Indoor or low-effort fallback option" },
          description: { type: Type.STRING, description: "Brief description of this indoor or easy fallback option" }
        },
        required: ["title", "description"]
      },
      foodNearby: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Recommended cafe, bakery, or family restaurant nearby for a meal/snack" },
          cuisine: { type: Type.STRING, description: "Cuisine/type of place (e.g. 'Bakery & Ice Cream' or 'Casual Pizza')" },
          distance: { type: Type.STRING, description: "Distance or travel time from the primary activity (e.g. '5-min walk' or '2-min drive')" },
          rating: { type: Type.NUMBER, description: "Google rating of this restaurant (0.0 to 5.0)" }
        },
        required: ["title", "cuisine", "distance"]
      },
      bookingLink: { type: Type.STRING, description: "Optional web URL to buy tickets or make reservations" },
      directionsLink: { type: Type.STRING, description: "Optional pre-formed Google Maps URL for driving or walking directions" }
    },
    required: ["title", "description", "whyThisPlan", "totalCostEstimate", "timeline", "cheaperAlternative", "rainBackup", "foodNearby"]
  }
};

// Config endpoint to verify key configuration
app.get("/api/config", (req, res) => {
  res.json({
    hasGeminiKey: !!GEMINI_API_KEY,
  });
});

// Parse unstructured free-form text choices into structured JSON using Gemini LLM
app.post("/api/parse-choices", async (req, res) => {
  const { freeFormText } = req.body;

  if (!freeFormText || typeof freeFormText !== "string") {
    return res.status(400).json({ error: "Missing or invalid freeFormText parameter." });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Gemini API Key is not configured on the server. Please check Settings > Secrets.",
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse the following unstructured free-form user planning preferences and choices into the requested structured JSON format:

"${freeFormText}"`,
      config: {
        systemInstruction: "You are an intelligent parsing agent that extracts user preferences for local outings into standard properties.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            style: {
              type: Type.STRING,
              description: "One of the following exact strings: 'Parks & Playgrounds', 'Museums & Culture', 'Active Adventure', 'Scenic & Relaxing', 'Indoor Entertainment'. Select the most relevant choice.",
            },
            budgetLimit: {
              type: Type.STRING,
              description: "One of the following exact strings: 'Free Outings Only', 'Under $50', 'Under $120', 'Premium / Flexible'. Select the most relevant choice.",
            },
            driveTime: {
              type: Type.STRING,
              description: "One of the following exact strings: '15 minutes', '30 minutes', '45 minutes', '60 minutes+'. Select the most relevant choice.",
            },
            kidAgeGroup: {
              type: Type.STRING,
              description: "One of the following exact strings: 'Toddlers (0-4 years)', 'Kids (5-11 years)', 'Teens (12+ years)', 'No Kids / Adults Only'. Select the most relevant choice.",
            },
            weatherPrep: {
              type: Type.STRING,
              description: "One of the following exact strings: 'Sunshine / Outdoors', 'Rainy / Indoor Friendly', 'Flexible / Any Weather'. Select the most relevant choice.",
            },
            customNotes: {
              type: Type.STRING,
              description: "Extract any key names, extra guidelines, preferences, specific locations, or foods/interests they mentioned.",
            }
          },
          required: ["style", "budgetLimit", "driveTime", "kidAgeGroup", "weatherPrep", "customNotes"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Parse choices error:", error);
    res.status(500).json({ error: error.message || "Failed to parse free-form text preferences." });
  }
});

// Reviews API endpoints
app.get("/api/reviews", (req, res) => {
  const { location } = req.query;
  const reviews = getLocalReviews();
  
  if (location) {
    const locStr = String(location).trim().toLowerCase();
    const filtered = reviews.filter((r) => r.locationName.toLowerCase() === locStr);
    return res.json(filtered);
  }
  
  res.json(reviews);
});

app.post("/api/reviews", (req, res) => {
  const { locationName, rating, comment, username } = req.body;
  
  if (!locationName || !rating || !username) {
    return res.status(400).json({ error: "Missing required fields: locationName, rating, username are required." });
  }
  
  const reviews = getLocalReviews();
  const newReview: LocalReview = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    locationName: String(locationName).trim(),
    rating: Number(rating),
    comment: String(comment || "").trim(),
    username: String(username).trim(),
    timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  
  reviews.push(newReview);
  saveLocalReviews(reviews);
  
  res.status(201).json(newReview);
});

// Dynamic Hidden Gems discovery endpoint using Gemini with Search Grounding
app.post("/api/hidden-gems", async (req, res) => {
  const { lat, lng, cityName } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing required parameters: lat and lng." });
  }

  // Define fallback mock gems if Gemini fails or is not configured
  const getFallbackGems = () => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const mockNames = [
      { name: "Scenic Wildflower Overlook", suffix: "Reserve", detail: "A secret hillside clearing filled with vibrant native wildflowers, offering panoramic valley views." },
      { name: "Whispering Waters Creek Trail", suffix: "Woodlands", detail: "A serene woodland path along a crystal-clear rocky stream, complete with small cascading waterfalls." },
      { name: "Canyon Peak Stone Arch", suffix: "Canyon", detail: "A natural sandstone archway hidden off the main path, perfect for viewing sunset colors." },
      { name: "The Quiet Mossy Grotto", suffix: "Springs", detail: "A cool, shaded rock overhang covered in lush green mosses and delicate ferns, featuring a small natural pool." }
    ];

    const fallbackGems = mockNames.map((item, idx) => {
      // Create slight offsets around user's lat/lng
      const offsetLat = latNum + (idx === 0 ? 0.012 : idx === 1 ? -0.015 : idx === 2 ? 0.008 : -0.011);
      const offsetLng = lngNum + (idx === 0 ? -0.014 : idx === 1 ? 0.011 : idx === 2 ? 0.016 : -0.009);
      const rating = Number((4.6 + Math.random() * 0.3).toFixed(1));
      
      return {
        title: item.name,
        address: `${Math.floor(100 + Math.random() * 900)} Nature Way, Near ${cityName || "here"}`,
        lat: offsetLat,
        lng: offsetLng,
        category: "Hidden Gem",
        rating: rating,
        userRatingAverage: rating,
        userReviewsCount: 3,
        description: item.detail,
        reviews: [
          {
            username: "ExploreEverywhere",
            rating: 5,
            comment: `Unbelievably quiet and pristine. Went around 5:00 PM and had the entire area to myself! A must-visit near ${cityName || "this region"}.`
          },
          {
            username: "NatureLover88",
            rating: 4,
            comment: `Slightly hard to locate at first, but completely worth the search. Pure serenity and gorgeous photo ops.`
          }
        ]
      };
    });

    return fallbackGems;
  };

  if (!GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY. Using realistic local fallbacks.");
    const gems = getFallbackGems();
    // Save their reviews to database so the reviews panel is ready
    const currentReviews = getLocalReviews();
    let updated = false;
    for (const gem of gems) {
      const exists = currentReviews.some(r => r.locationName.toLowerCase() === gem.title.toLowerCase());
      if (!exists && gem.reviews) {
        for (const rev of gem.reviews) {
          currentReviews.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            locationName: gem.title,
            rating: rev.rating,
            comment: rev.comment,
            username: rev.username,
            timestamp: "Just Now"
          });
        }
        updated = true;
      }
    }
    if (updated) saveLocalReviews(currentReviews);
    return res.json({ gems });
  }

  try {
    const prompt = `Search for 3-4 real, lesser-known, highly rated picturesque "Hidden Gems", scenic views, secret spots, or unique local landmarks near the coordinates: latitude ${lat}, longitude ${lng} (located in or around "${cityName || "this region"}").
These must be quiet, non-obvious, local community-pinned gems rather than standard highly crowded major tourist spots (like standard downtown plazas or major airports).

For each hidden gem you find, you MUST return a valid JSON object with the following fields:
- title: The official or popular local name of the place.
- address: The full formatted address or description of how to reach it.
- lat: The exact latitude coordinate (MUST be a number, e.g. ${lat} plus/minus 0.05).
- lng: The exact longitude coordinate (MUST be a number, e.g. ${lng} plus/minus 0.05).
- category: Set to the string "Hidden Gem".
- rating: An estimated Google/local rating (e.g. 4.7, 4.8, 4.9).
- userRatingAverage: Same as rating (must be a number).
- userReviewsCount: Number of local reviews (e.g. 4, 12, etc.).
- description: A short, elegant 1-2 sentence description highlighting why locals love it and its unique vibe.
- reviews: A list of 2-3 realistic local community reviews for this gem. Each review must have:
  - username: Name of reviewer (e.g. "ScenicStroller", "ExplorerSarah").
  - rating: Review score (1-5 integer).
  - comment: A helpful, specific review comment highlighting local tips, when to visit, or what to look for.

Format your response as a strict JSON object containing a "gems" array of these objects:
{
  "gems": [
    {
      "title": "Name",
      "address": "Address",
      "lat": 0.0,
      "lng": 0.0,
      "category": "Hidden Gem",
      "rating": 4.8,
      "userRatingAverage": 4.8,
      "userReviewsCount": 3,
      "description": "Short summary",
      "reviews": [
        {
          "username": "User",
          "rating": 5,
          "comment": "Specific tip"
        }
      ]
    }
  ]
}

Ensure the JSON is strictly compliant. Do NOT return any markdown blocks or outer wrappers outside the raw JSON code!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const text = response.text?.trim() || "";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini hidden gems response. Attempting extraction from markdown blocks...", e);
      // Try to extract JSON from code block if markdown was returned anyway
      const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (match?.[1]) {
        parsed = JSON.parse(match[1].trim());
      } else {
        throw new Error("Could not parse JSON output from Gemini model.");
      }
    }

    const gems = parsed.gems || parsed;
    if (!Array.isArray(gems)) {
      throw new Error("Invalid response format: gems is not an array");
    }

    // Save their reviews to database so the reviews panel is ready
    const currentReviews = getLocalReviews();
    let updated = false;
    for (const gem of gems) {
      // Ensure the coordinate is a valid float number
      gem.lat = Number(gem.lat);
      gem.lng = Number(gem.lng);
      gem.rating = Number(gem.rating || 4.5);
      gem.userRatingAverage = Number(gem.userRatingAverage || gem.rating);
      gem.userReviewsCount = Number(gem.userReviewsCount || 5);

      const exists = currentReviews.some(r => r.locationName.toLowerCase() === gem.title.toLowerCase());
      if (!exists && gem.reviews && Array.isArray(gem.reviews)) {
        for (const rev of gem.reviews) {
          currentReviews.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            locationName: gem.title,
            rating: Number(rev.rating || 5),
            comment: String(rev.comment || "").trim(),
            username: String(rev.username || "Local Explorer").trim(),
            timestamp: "Community Review"
          });
        }
        updated = true;
      }
    }
    if (updated) saveLocalReviews(currentReviews);

    res.json({ gems });
  } catch (error: any) {
    console.error("Error generating hidden gems with Gemini:", error);
    // If Gemini fails, use fallback mock gems so the app stays functional and beautiful!
    const gems = getFallbackGems();
    // Seed fallbacks reviews if needed
    const currentReviews = getLocalReviews();
    let updated = false;
    for (const gem of gems) {
      const exists = currentReviews.some(r => r.locationName.toLowerCase() === gem.title.toLowerCase());
      if (!exists && gem.reviews) {
        for (const rev of gem.reviews) {
          currentReviews.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            locationName: gem.title,
            rating: rev.rating,
            comment: rev.comment,
            username: rev.username,
            timestamp: "Just Now"
          });
        }
        updated = true;
      }
    }
    if (updated) saveLocalReviews(currentReviews);
    res.json({ gems });
  }
});

// Core chatbot API endpoint
app.post("/api/chat", async (req, res) => {
  const { messages, mapCenter, searchMode, profile } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured. Please add your Gemini API Key in the AI Studio Secrets panel.",
    });
  }

  try {
    // Format messages for the Gemini SDK
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Choose tool grounding based on the user's selected search mode
    const tools: any[] = [];
    if (searchMode === "maps") {
      tools.push({ googleMaps: {} });
    } else if (searchMode === "web") {
      tools.push({ googleSearch: {} });
    }

    // Always include our custom map control tools
    tools.push({
      functionDeclarations: [addMarkersTool, drawRouteTool, setMapViewTool, clearMapTool, displayItineraryTool]
    });

    // Configure toolConfig to pass location bias and enable hybrid tool execution
    const toolConfig: any = {
      includeServerSideToolInvocations: true
    };

    if (mapCenter && (searchMode === "maps" || searchMode === "auto")) {
      toolConfig.retrievalConfig = {
        latLng: {
          latitude: mapCenter.lat,
          longitude: mapCenter.lng
        }
      };
    }

    // Compile summary of all local user reviews to inject into system instruction so chatbot knows about them!
    const localReviews = getLocalReviews();
    let reviewsContext = "";
    if (localReviews.length > 0) {
      reviewsContext = "\n\nCRITICAL CONTEXT - LOCAL USER REVIEWS AND RATINGS DEFINED BY USERS:\n";
      // Group reviews by location
      const grouped: Record<string, { ratings: number[]; comments: string[] }> = {};
      for (const r of localReviews) {
        if (!grouped[r.locationName]) {
          grouped[r.locationName] = { ratings: [], comments: [] };
        }
        grouped[r.locationName].ratings.push(r.rating);
        if (r.comment) {
          grouped[r.locationName].comments.push(`- "${r.comment}" (by ${r.username})`);
        }
      }
      
      for (const [locName, data] of Object.entries(grouped)) {
        const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
        reviewsContext += `- Location: "${locName}" has a user average rating of ${avg.toFixed(1)}/5.0 based on ${data.ratings.length} review(s). Detailed comments:\n${data.comments.join("\n") || "  No detailed text comments."}\n`;
      }
    }

    // Build specific user profile constraints and weather-aware rules
    let profileContext = "";
    if (profile) {
      const {
        adultsCount = 2,
        kidsCount = 0,
        kidAgeGroup = "none",
        maxDriveTime = 30,
        maxBudget = 120,
        preferences = [],
        preferSunny = true,
        warnAboutRain = true,
        temperaturePreference = "any",
        avoidHighWind = false,
      } = profile;

      profileContext = `
CRITICAL USER PROFILE CONSTRAINTS & PREFERENCES:
- Party Size: ${adultsCount} Adult(s)${kidsCount > 0 ? ` and ${kidsCount} Kid(s) (Age Group: ${kidAgeGroup})` : ""}.
- Maximum Drive Time: within ${maxDriveTime} minutes from current map center.
- Maximum Budget Cap: $${maxBudget} (For total group).
- Favorite Activity Themes: ${preferences.length > 0 ? preferences.join(", ") : "None specified"}.

WEATHER-SPECIFIC USER PLANNING PREFERENCES:
- Prefer Sunny Days: ${preferSunny ? "YES. Prioritize outdoor views, parks, beaches, or hiking when weather is nice." : "NO. No strong preference for sunny days."}
- Warn About Rain: ${warnAboutRain ? "YES. Proactively alert the user in your text response and the 'Why This Plan' section if any rain, drizzle, or showers are present. Prioritize indoor/sheltered activities and provide a pristine indoor 'Rain Backup' option." : "NO. No specific rain warning required."}
- Temperature Comfort: ${
        temperaturePreference === "warm"
          ? "PREFER WARM WEATHER. User is sensitive to cold. Avoid outdoor activities unless local temperature is warm (above 65°F / 18°C)."
          : temperaturePreference === "cool"
          ? "PREFER COOL WEATHER. User prefers cooler climates. Avoid high-heat open venues."
          : "ANY. No specific temperature preferences."
      }
- Wind Sensitivity: ${avoidHighWind ? "YES. Avoid extremely open breeze-ways, breezy coastlines, or water tours if wind speeds are high. Favor sheltered or indoor locations." : "NO. No specific wind limits."}

Make sure to explain clearly in the 'Why This Plan' section of the itinerary and in your conversational text response how these weather-specific constraints and the group profiles were honored.
`;
    }

    const systemInstruction = `You are Where2Go AI, a highly advanced, constraint-aware local outing planner and decision engine. Your mission is to help households, families, and small groups decide exactly where to go "right now" or "later today" by creating perfect, highly actionable itineraries.

You have access to real-time Google Maps data and Google Search grounding to make highly accurate recommendations.
${profileContext ? `\n${profileContext}\n` : ""}

CRITICAL BEHAVIOR:
1. Whenever the user requests a plan, itinerary, schedule, day out, or weekend outing (or when they submit the structured "Quick Plan Form" parameters), you MUST ALWAYS call the 'display_itinerary' tool with a complete, logically structured outing schema.
2. Under the 'display_itinerary' schema, you MUST provide:
   - A step-by-step TIMELINE with 2-4 logical, sequential stops (e.g., Morning activity, lunch nearby, afternoon stroll) including estimated times, duration, specific venue names, addresses, and coordinates (lat, lng).
   - An estimated total cost range (e.g., "$45 - $80") and a realistic cost breakdown.
   - A "Cheaper Alternative" and a "Rain / Indoor Backup" activity to ensure the family has a low-cost and rain-proof fallback plan.
   - A "Food Nearby" recommendation within short walking or driving distance from the main stop.
   - A grounded, clear "Why This Plan" justification that explicitly references the user's constraints (e.g., "Since it is 72°F and sunny, this outdoor park fits perfectly, keeping travel under 20 mins and within your $100 budget with kid-friendly restrooms").
3. Simultaneously, you MUST call 'add_markers' to plot all recommended venues on the interactive map so the user can see them visually.
4. If the user asks for directions or routing between stops, call 'draw_route'.
5. Hard Constraint Guidance:
   - **Family/Kid Fit**: If they have kids, prioritize parks, interactive museums, playgrounds, family entertainment centers. Ensure activities correspond to requested kid-age profiles (toddlers vs. teens).
   - **Budget Guardrails**: Honor the max budget limit. Suggest free or low-cost alternatives if the primary plan stretches the budget.
   - **Drive-Time Limits**: Restrict options to those within the requested drive-time (e.g., "within 20 minutes" of their current location/map center).
   - **Weather Aware**: Check the current local weather. If rainy, cold, or too hot, prioritize indoor activities and note this in your explanation. If sunny, favor parks and nature.
6. Local User Reviews Integration: If a recommended venue has local reviews, display its rating and mention relevant details. Here is the active list of user reviews on this platform: ${reviewsContext || "None submitted yet."}
7. Always explain the itinerary in a warm, friendly, and structured Markdown text response alongside the tool call. Do not print out raw coordinates in the text; instead, refer to them on the interactive map. The user's current map center is: ${mapCenter ? `${mapCenter.lat}, ${mapCenter.lng}` : "unknown"}.
8. Hidden Gems (User-Pinned Locations): You are aware of specific, highly rated user-pinned "Hidden Gems" that other users have reviewed and loved. When the user is looking for scenic lake overlooks, beautiful parks, hidden secrets, or unique local landmarks (especially in Grapevine, TX or San Francisco, CA), ALWAYS proactively suggest these locations, plot them using 'add_markers', or weave them into displayed itineraries! Emphasize that they are quiet, high-rated, community-sourced "Hidden Gems" rather than standard points of interest:
   - "Vicky Sunset Pointe" at Park Rd, Grapevine, TX 76051 (coordinates: 32.9649, -97.0702). A stunning, peaceful lake view & sunset spot.
   - "Lands End Secret Labyrinth" at Lands End Trail, San Francisco, CA 94121 (coordinates: 37.7880, -122.5115).
   - "Billy Goat Hill Swing" at 2442 30th St, San Francisco, CA 94131 (coordinates: 37.7401, -122.4338).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        tools,
        toolConfig
      }
    });

    // Extract text output
    const text = response.text || "No response received.";

    // Extract grounding chunks if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract custom map function calls
    const functionCalls = response.functionCalls || [];

    res.json({
      text,
      groundingChunks,
      functionCalls
    });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    let userMessage = "An error occurred while communicating with Gemini.";
    if (error.message?.includes("PERMISSION_DENIED") || error.status === 403) {
      userMessage = "Access Denied: Please verify your Gemini API key in the Settings > Secrets panel of AI Studio.";
    } else if (error.message?.includes("API_KEY_INVALID") || error.status === 400) {
      userMessage = "Invalid API Key: Please check your Gemini API key in the Settings > Secrets panel.";
    } else if (error.message?.includes("QUOTA_EXHAUSTED") || error.status === 429) {
      userMessage = "Quota Exhausted: The API key has reached its request limit. Please wait a bit or switch to a billing-enabled key.";
    } else {
      userMessage = error.message || userMessage;
    }

    res.status(500).json({ error: userMessage });
  }
});

// Itinerary summary generation endpoint using Gemini
app.post("/api/itinerary/summary", async (req, res) => {
  const { itinerary } = req.body;

  if (!itinerary) {
    return res.status(400).json({ error: "Missing itinerary data in request body." });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Gemini API Key is not configured on the server. Please check Settings > Secrets.",
    });
  }

  try {
    const prompt = `Provide a friendly, highly concise, structured overview summary of the following outing itinerary:

Title: "${itinerary.title}"
Description: "${itinerary.description}"
Total Cost Estimate: "${itinerary.totalCostEstimate}"
Timeline Stops:
${itinerary.timeline?.map((stop: any) => `- ${stop.time}: ${stop.activity} at ${stop.locationName} (${stop.duration})`).join("\n")}
Cost Breakdown:
- Tickets: ${itinerary.costBreakdown?.tickets}
- Food: ${itinerary.costBreakdown?.food}
- Parking: ${itinerary.costBreakdown?.parking || "N/A"}
- Other: ${itinerary.costBreakdown?.other || "N/A"}

Your summary MUST include:
1. **Total Outing Duration & Time Spent**: Summarize how long the entire outing is expected to last (from the first stop's start time to the last stop's end time, or an estimation of total active time).
2. **Expected Costs Overview**: A clear summary of the total estimated cost and details on where the money will be spent (e.g., tickets vs. food/snacks, noting if anything is free).
3. **Outing Highlights & Tips**: Give 1-2 brief tips or highlights of the plan (such as weather suitability, backups, or general pacing).

Format your response in warm, elegant Markdown with clean headers and visual bullet points, suitable for display in an elegant app card. Keep it highly scannable, engaging, and under 150 words!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a local outing advisor. You generate extremely clear, friendly, and structured summaries of planned itineraries, focusing on time spent and estimated cost breakdowns.",
      },
    });

    const summary = response.text || "No summary could be generated.";
    res.json({ summary });
  } catch (error: any) {
    console.error("Itinerary summary Gemini error:", error);
    res.status(500).json({ error: error.message || "Failed to generate itinerary summary." });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
