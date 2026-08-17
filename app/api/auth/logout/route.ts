import { clearPortalSessionCookie } from "../../../portal-session";
import { requestOrigin, secureRequest } from "../../_request";

export async function GET(request: Request) {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL("/", requestOrigin(request)).toString(),
      "set-cookie": clearPortalSessionCookie(secureRequest(request)),
    },
  });
}
