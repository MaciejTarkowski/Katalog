import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// No Postgres in tests: check the SQL text that creates profiles for new (incl. Google) users.
const SUPABASE = join(__dirname, "../../../../supabase");
const read = (file: string) => readFileSync(join(SUPABASE, file), "utf-8");

function handleNewUser(sql: string): string {
  const match = sql.match(/FUNCTION public\.handle_new_user\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/);
  expect(match).not.toBeNull();
  return match![1];
}

describe("handle_new_user trigger", () => {
  it("takes the name from display_name, then Google's full_name and name", () => {
    const body = handleNewUser(read("schema.sql"));
    expect(body).toMatch(/COALESCE\([\s\S]*'display_name'[\s\S]*'full_name'[\s\S]*'name'[\s\S]*\)/);
  });
});

describe("profiles OAuth migration", () => {
  const file = readdirSync(join(SUPABASE, "migrations")).find((f) => f.includes("profiles_oauth_name"));

  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("updates the trigger the same way as schema.sql", () => {
    expect(handleNewUser(read(`migrations/${file}`))).toBe(handleNewUser(read("schema.sql")));
  });

  it("backfills missing profiles and empty names from auth.users", () => {
    const sql = read(`migrations/${file}`);
    expect(sql).toMatch(/INSERT INTO public\.profiles[\s\S]*FROM auth\.users/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE[\s\S]*display_name IS NULL/);
  });
});

describe("profiles.collection_types", () => {
  const file = readdirSync(join(SUPABASE, "migrations")).find((f) => f.includes("profiles_collection_types"));
  const column = /collection_types TEXT\[\][\s\S]*CHECK[\s\S]*'book'[\s\S]*'music'[\s\S]*'game'[\s\S]*'comic'/;

  it("is a nullable text array of known categories in schema.sql (NULL = not chosen yet)", () => {
    const sql = read("schema.sql");
    expect(sql).toMatch(column);
    expect(sql).not.toMatch(/collection_types TEXT\[\][^,\n]*NOT NULL/);
  });

  it("has a migration adding the same column", () => {
    expect(file).toBeDefined();
    expect(read(`migrations/${file}`)).toMatch(/ALTER TABLE public\.profiles[\s\S]*ADD COLUMN IF NOT EXISTS/);
    expect(read(`migrations/${file}`)).toMatch(column);
  });
});
