import { requirePortalUser, requireSameOrigin } from "../../_auth";
import { disconnectGoogle, googleConnectionStatus, googleError } from "../_lib";

export async function GET(request: Request) {
  const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
  try {
    return Response.json(await googleConnectionStatus(request, auth.user.id), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return googleError(error);
  }
}

export async function DELETE(request: Request) {
  const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
  const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
  try {
    await disconnectGoogle(auth.user.id);
    return Response.json({ disconnected: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return googleError(error);
  }
}
