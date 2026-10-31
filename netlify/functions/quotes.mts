import { neon } from "@neondatabase/serverless"
import type { Config } from "@netlify/functions"

export default async (req: Request) => {
  if (req.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET" } },
    )
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return Response.json({ error: "Database is not configured" }, { status: 500 })
  }

  try {
    const sql = neon(databaseUrl)
    const quotes = await sql`SELECT id, quote_text, attribution FROM quotes ORDER BY id`
    return Response.json(quotes)
  } catch (error) {
    console.error("Failed to load quotes", error)
    return Response.json({ error: "Could not load quotes" }, { status: 500 })
  }
}

export const config: Config = {
  path: "/quotes",
}
