import { googleError, googleRequest } from "../_lib";
import { requirePortalUser, requireSameOrigin } from "../../_auth";

const spacePattern = /^spaces\/[A-Za-z0-9_-]+$/u;

function proxy(response: Response) {
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const auth = requirePortalUser(request);
    if (auth.response || !auth.user) return auth.response;
    const source = new URL(request.url);
    const space = source.searchParams.get("space");
    if (!space) {
      const url = new URL("https://chat.googleapis.com/v1/spaces");
      url.searchParams.set("pageSize", "100");
      return proxy(await googleRequest(request, auth.user.id, url.toString()));
    }
    if (!spacePattern.test(space)) return googleError(new Error("Invalid Google Chat space"), 400);
    const url = new URL(`https://chat.googleapis.com/v1/${space}/messages`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("orderBy", "createTime desc");
    return proxy(await googleRequest(request, auth.user.id, url.toString()));
  } catch (error) {
    return googleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const sameOrigin = requireSameOrigin(request);
    if (sameOrigin) return sameOrigin;
    const auth = requirePortalUser(request);
    if (auth.response || !auth.user) return auth.response;
    const body = await request.json() as { space?: string; text?: string; thread?: string };
    const space = body.space || "";
    const message = (body.text || "").trim();
    if (!spacePattern.test(space)) return googleError(new Error("Invalid Google Chat space"), 400);
    if (!message || message.length > 4096) return googleError(new Error("Message must be between 1 and 4,096 characters"), 400);
    const url = new URL(`https://chat.googleapis.com/v1/${space}/messages`);
    const payload: { text: string; thread?: { name: string } } = { text: message };
    if (body.thread?.startsWith(`${space}/threads/`)) payload.thread = { name: body.thread };
    return proxy(await googleRequest(request, auth.user.id, url.toString(), {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  } catch (error) {
    return googleError(error);
  }
}
