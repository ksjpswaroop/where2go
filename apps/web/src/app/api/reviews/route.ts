import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_FILE = path.join(process.cwd(), "data", "reviews.json");

interface LocalReview {
  id: string;
  locationName: string;
  rating: number;
  comment: string;
  username: string;
  timestamp: string;
}

function ensureDataDir() {
  const dir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLocalReviews(): LocalReview[] {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8"));
    }
  } catch (error) {
    console.error("Error reading reviews file:", error);
  }
  return [];
}

function saveLocalReviews(reviews: LocalReview[]) {
  ensureDataDir();
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  const reviews = getLocalReviews();

  if (location) {
    const locStr = location.trim().toLowerCase();
    return NextResponse.json(
      reviews.filter((r) => r.locationName.toLowerCase() === locStr),
    );
  }

  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { locationName, rating, comment, username } = body;

  if (!locationName || !rating || !username) {
    return NextResponse.json(
      { error: "Missing required fields: locationName, rating, username are required." },
      { status: 400 },
    );
  }

  const reviews = getLocalReviews();
  const newReview: LocalReview = {
    id: crypto.randomUUID(),
    locationName: String(locationName).trim(),
    rating: Number(rating),
    comment: String(comment || "").trim(),
    username: String(username).trim(),
    timestamp: new Date().toLocaleString(),
  };

  reviews.push(newReview);
  saveLocalReviews(reviews);

  return NextResponse.json(newReview, { status: 201 });
}
