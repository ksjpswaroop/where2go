import type {
  FeedbackRequest,
  PlanResponse,
  Profile,
  ShareRequest,
} from "@where2go/schemas";
import postgres from "postgres";

type PlanRecord = {
  response: PlanResponse;
  visibility: "private" | "public";
  ownerUserId?: string;
  createdAt: string;
};

type ShareRecord = {
  token: string;
  planId: string;
  expiresAt: string;
  includeCost: boolean;
  includeHomeLocation: boolean;
};

type MemoryData = {
  plans: Map<string, PlanRecord>;
  shares: Map<string, ShareRecord>;
  feedback: Map<string, FeedbackRequest & { id: string; planId: string; createdAt: string }>;
  profiles: Map<string, Profile>;
};

type StoreMode = "postgres" | "memory";

const globalStore = globalThis as typeof globalThis & {
  __where2goMemoryStore?: MemoryData;
  __where2goSql?: ReturnType<typeof postgres>;
  __where2goSchemaReady?: Promise<void>;
};

export function storageMode(): StoreMode {
  return process.env.DATABASE_URL ? "postgres" : "memory";
}

export async function savePlan(response: PlanResponse, ownerUserId?: string): Promise<StoreMode> {
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      insert into where2go_plans (id, response, visibility, owner_user_id, created_at)
      values (${response.planId}, ${sql.json(response)}, 'private', ${ownerUserId ?? null}, now())
      on conflict (id) do update set response = excluded.response
    `;
    return "postgres";
  }

  memory().plans.set(response.planId, {
    response,
    visibility: "private",
    ownerUserId,
    createdAt: new Date().toISOString(),
  });
  return "memory";
}

export async function getPlan(planId: string): Promise<PlanRecord | undefined> {
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    const rows = await sql<PlanRecord[]>`
      select
        response,
        visibility,
        owner_user_id as "ownerUserId",
        created_at as "createdAt"
      from where2go_plans
      where id = ${planId}
      limit 1
    `;
    return rows[0];
  }

  return memory().plans.get(planId);
}

export async function saveFeedback(planId: string, payload: FeedbackRequest) {
  const id = makeId("fb");
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      insert into where2go_feedback (id, plan_id, payload, created_at)
      values (${id}, ${planId}, ${sql.json(payload)}, now())
    `;
    return { feedbackId: id, stored: true };
  }

  memory().feedback.set(id, {
    ...payload,
    id,
    planId,
    createdAt: new Date().toISOString(),
  });
  return { feedbackId: id, stored: true };
}

export async function createShare(planId: string, payload: ShareRequest) {
  const token = makeId("share");
  const expiresAt = new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const record: ShareRecord = {
    token,
    planId,
    expiresAt,
    includeCost: payload.includeCost,
    includeHomeLocation: payload.includeHomeLocation,
  };

  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      insert into where2go_share_tokens
        (token, plan_id, expires_at, include_cost, include_home_location)
      values
        (${token}, ${planId}, ${expiresAt}, ${payload.includeCost}, ${payload.includeHomeLocation})
    `;
    await sql`update where2go_plans set visibility = 'public' where id = ${planId}`;
    return record;
  }

  memory().shares.set(token, record);
  const plan = memory().plans.get(planId);
  if (plan) {
    memory().plans.set(planId, { ...plan, visibility: "public" });
  }
  return record;
}

export async function getSharedPlan(token: string) {
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    const rows = await sql<Array<{ response: PlanResponse; share: ShareRecord }>>`
      select
        p.response as response,
        json_build_object(
          'token', s.token,
          'planId', s.plan_id,
          'expiresAt', s.expires_at,
          'includeCost', s.include_cost,
          'includeHomeLocation', s.include_home_location
        ) as share
      from where2go_share_tokens s
      join where2go_plans p on p.id = s.plan_id
      where s.token = ${token}
        and s.expires_at > now()
      limit 1
    `;
    return rows[0];
  }

  const share = memory().shares.get(token);
  if (!share || new Date(share.expiresAt).getTime() < Date.now()) {
    return undefined;
  }
  const plan = memory().plans.get(share.planId);
  return plan ? { response: plan.response, share } : undefined;
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    const rows = await sql<Array<{ payload: Profile }>>`
      select payload
      from where2go_profiles
      where user_id = ${userId}
      limit 1
    `;
    return rows[0]?.payload;
  }
  return memory().profiles.get(userId);
}

export async function saveProfile(userId: string, profile: Profile) {
  const sql = getSql();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      insert into where2go_profiles (user_id, payload, updated_at)
      values (${userId}, ${sql.json(profile)}, now())
      on conflict (user_id) do update set
        payload = excluded.payload,
        updated_at = now()
    `;
    return { stored: true, mode: "postgres" as const };
  }

  memory().profiles.set(userId, profile);
  return { stored: true, mode: "memory" as const };
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  globalStore.__where2goSql ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return globalStore.__where2goSql;
}

async function ensureSchema(sql: ReturnType<typeof postgres>) {
  globalStore.__where2goSchemaReady ??= (async () => {
    await sql`
      create table if not exists where2go_plans (
        id text primary key,
        response jsonb not null,
        visibility text not null default 'private',
        owner_user_id text,
        created_at timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists where2go_share_tokens (
        token text primary key,
        plan_id text not null references where2go_plans(id) on delete cascade,
        expires_at timestamptz not null,
        include_cost boolean not null default true,
        include_home_location boolean not null default false
      )
    `;
    await sql`
      create table if not exists where2go_feedback (
        id text primary key,
        plan_id text not null,
        payload jsonb not null,
        created_at timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists where2go_profiles (
        user_id text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      )
    `;
  })();

  await globalStore.__where2goSchemaReady;
}

function memory() {
  globalStore.__where2goMemoryStore ??= {
    plans: new Map(),
    shares: new Map(),
    feedback: new Map(),
    profiles: new Map(),
  };
  return globalStore.__where2goMemoryStore;
}

function makeId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random.replaceAll("-", "").slice(0, 18)}`;
}
