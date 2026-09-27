export const dynamic = "force-dynamic";

const API = process.env.FIXR_API_URL ?? "http://127.0.0.1:8000";

/** The upload route only accepts POST, so a 405 to a GET means the backend is up. */
export async function GET() {
  try {
    const res = await fetch(`${API}/api/v0/repositories`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return Response.json({ online: res.status === 405 });
  } catch {
    return Response.json({ online: false });
  }
}
