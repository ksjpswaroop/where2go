"use client";

import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { isClerkEnabled } from "@/components/auth-provider";
import { ModeSwitcher } from "./mode-switcher";

export function SoloTravelDashboard() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-y-auto p-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--muted-foreground)]">Where2Go · Solo Travel</p>
        <h1 className="text-2xl font-semibold">Stay safe while you explore</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage safety timers, emergency contacts, and trip check-ins. Open the mobile app for
          native SOS and battery-aware alerts.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <SoloCard
          title="Safety timers"
          body="Arm a countdown before outings. Contacts are alerted if you miss check-in (Plus)."
          href="#timers"
        />
        <SoloCard
          title="Emergency contacts"
          body="Send a safety package SMS with battery %, location, and next planned stop."
          href="#contacts"
        />
        <SoloCard
          title="Hotel safety scanner"
          body="AI scores for neighborhood and solo-traveler fit before you check in (Plus)."
          href="#scanner"
        />
        <SoloCard
          title="Explore near your trip"
          body="Generate safe outing plans anchored to your active destination."
          href="#explore"
        />
      </div>

      <section id="explore" className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="mb-2 font-semibold">Trip-aware planning</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Switch to Family Day mode for full MapChat planning, or use the mobile Explore tab with
          your active trip destination.
        </p>
      </section>

      {isClerkEnabled ? (
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
            >
              Sign in to sync safety data
            </button>
          </SignInButton>
        </SignedOut>
      ) : null}

      {isClerkEnabled ? (
        <SignedIn>
          <UpgradeSection />
        </SignedIn>
      ) : null}
    </div>
  );
}

function SoloCard({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{body}</p>
    </Link>
  );
}

function UpgradeSection() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  async function checkout(tier: "plus" | "pro") {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: { message?: string } };
      if (data.url) window.location.href = data.url;
      else alert(data.error?.message ?? "Checkout unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] p-4">
      <h2 className="font-semibold">Where2Go Plus</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Unlock server-side escalation, hotel scanner, itinerary-linked timers, and unlimited plans.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void checkout("plus")}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Upgrade to Plus
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void checkout("pro")}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        >
          Pro
        </button>
      </div>
    </section>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="relative flex shrink-0 items-center border-b border-slate-200/80 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Image
            src="/where2go-logo.png"
            alt="Where2Go"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-slate-900">Where2Go</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2">
          <ModeSwitcher />
        </div>
        <div className="ml-auto">
          {isClerkEnabled ? (
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
