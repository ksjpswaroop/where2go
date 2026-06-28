import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getGeminiClient, getGeminiModel, hasGeminiKey } from "@/lib/mapchat/gemini-tools";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_FILE = path.join(process.cwd(), "data", "reviews.json");

type GemReview = { username: string; rating: number; comment: string };

function getLocalReviews() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")) as Array<{
        id: string;
        locationName: string;
        rating: number;
        comment: string;
        username: string;
        timestamp: string;
      }>;
    }
  } catch {
    return [];
  }
  return [];
}

function saveLocalReviews(reviews: ReturnType<typeof getLocalReviews>) {
  const dir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
}

function getFallbackGems(lat: number, lng: number, cityName?: string) {
  const mockNames = [
    { name: "Scenic Wildflower Overlook", detail: "A secret hillside clearing with panoramic valley views." },
    { name: "Whispering Waters Creek Trail", detail: "A serene woodland path along a crystal-clear stream." },
    { name: "Canyon Peak Stone Arch", detail: "A natural sandstone archway hidden off the main path." },
    { name: "The Quiet Mossy Grotto", detail: "A cool, shaded rock overhang with lush green mosses." },
  ];

  return mockNames.map((item, idx) => {
    const offsetLat = lat + (idx === 0 ? 0.012 : idx === 1 ? -0.015 : idx === 2 ? 0.008 : -0.011);
    const offsetLng = lng + (idx === 0 ? -0.014 : idx === 1 ? 0.011 : idx === 2 ? 0.016 : -0.009);
    const rating = Number((4.6 + Math.random() * 0.3).toFixed(1));
    return {
      title: item.name,
      address: `${Math.floor(100 + Math.random() * 900)} Nature Way, Near ${cityName || "here"}`,
      lat: offsetLat,
      lng: offsetLng,
      category: "Hidden Gem",
      rating,
      userRatingAverage: rating,
      userReviewsCount: 3,
      description: item.detail,
      reviews: [
        {
          username: "ExploreEverywhere",
          rating: 5,
          comment: `Quiet and pristine. A must-visit near ${cityName || "this region"}.`,
        },
      ] as GemReview[],
    };
  });
}

function seedReviews(gems: Array<{ title: string; reviews?: GemReview[] }>) {
  const currentReviews = getLocalReviews();
  let updated = false;
  for (const gem of gems) {
    const exists = currentReviews.some(
      (r) => r.locationName.toLowerCase() === gem.title.toLowerCase(),
    );
    if (!exists && gem.reviews) {
      for (const rev of gem.reviews) {
        currentReviews.push({
          id: crypto.randomUUID(),
          locationName: gem.title,
          rating: rev.rating,
          comment: rev.comment,
          username: rev.username,
          timestamp: "Community Review",
        });
      }
      updated = true;
    }
  }
  if (updated) saveLocalReviews(currentReviews);
}

export async function POST(request: Request) {
  const limit = checkRateLimit(rateLimitKey(request, "hidden-gems"), 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const { lat, lng, cityName } = await request.json();

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing required parameters: lat and lng." }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!hasGeminiKey()) {
    const gems = getFallbackGems(latNum, lngNum, cityName);
    seedReviews(gems);
    return NextResponse.json({ gems });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Search for 3-4 real, lesser-known "Hidden Gems" near latitude ${lat}, longitude ${lng} (${cityName || "this region"}).
Return JSON: { "gems": [{ "title", "address", "lat", "lng", "category": "Hidden Gem", "rating", "userRatingAverage", "userReviewsCount", "description", "reviews": [{ "username", "rating", "comment" }] }] }`;

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "{}";
    let parsed: { gems?: unknown[] } = JSON.parse(text);
    if (!parsed.gems && Array.isArray(parsed)) {
      parsed = { gems: parsed as unknown[] };
    }

    const gems = ((parsed.gems || []) as Record<string, unknown>[]).map((gem) => ({
      ...gem,
      title: String(gem.title || "Hidden Gem"),
      lat: Number(gem.lat),
      lng: Number(gem.lng),
      rating: Number(gem.rating || 4.5),
      userRatingAverage: Number(gem.userRatingAverage || gem.rating || 4.5),
      userReviewsCount: Number(gem.userReviewsCount || 5),
      reviews: gem.reviews as GemReview[] | undefined,
    }));

    seedReviews(gems);
    return NextResponse.json({ gems });
  } catch {
    const gems = getFallbackGems(latNum, lngNum, cityName);
    seedReviews(gems);
    return NextResponse.json({ gems });
  }
}
