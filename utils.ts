import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { QueryClassification } from "./types.ts";

export function sanitizeJsonOutput(text: string): QueryClassification | null {
  try {
    let cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON structure found in text:", text);
      return null;
    }

    cleanedText = jsonMatch[0];
    const parsed = JSON.parse(cleanedText);
    if (!isValidQueryClassification(parsed)) {
      console.error("Invalid query classification structure:", parsed);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    console.error("Original text:", text);
    return null;
  }
}

function isValidQueryClassification(obj: any): obj is QueryClassification {
  if (!obj || typeof obj !== "object") return false;
  if (!["sql", "info", "both", "unclear"].includes(obj.classification)) {
    return false;
  }
  if (!isValidQueryDetails(obj.sql_query)) return false;
  if (!isValidQueryDetails(obj.info_query)) return false;

  return true;
}

function isValidQueryDetails(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.detected !== "boolean") return false;
  if (
    typeof obj.confidence !== "number" || obj.confidence < 0 ||
    obj.confidence > 1
  ) return false;
  if (
    obj.extracted_intent !== null && typeof obj.extracted_intent !== "string"
  ) return false;

  return true;
}

export function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getNestedProperty(
  obj: any,
  path: string,
  defaultValue: any = undefined,
): any {
  const keys = path.split(".");
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

export const handleError = (err: unknown, ctx: Context) => {
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    const error = err as { status: number; message: string };
    ctx.response.status = error.status || 500;
    ctx.response.body = {
      error: error.message || "Internal server error",
    };
  } else if (err instanceof Error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: err.message || "Internal server error",
    };
  } else {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
    };
  }
};
