import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  requestId?: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        details,
      },
    },
    { status },
  );
}

export function errorFromUnknown(error: unknown, fallback = "Unexpected server error.") {
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "Request did not match the API schema.", 422, error.flatten());
  }

  return jsonError(
    "SERVER_ERROR",
    error instanceof Error ? error.message : fallback,
    500,
  );
}
