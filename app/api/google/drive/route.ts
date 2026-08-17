import { getGoogleConfig, googleError, googleRequest } from "../_lib";
import { requirePortalUser } from "../../_auth";

export async function GET(request: Request) {
  try {
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const source = new URL(request.url); const config = await getGoogleConfig(request);
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("pageSize", "100"); url.searchParams.set("orderBy", "modifiedTime desc"); url.searchParams.set("q", "trashed = false");
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,driveId),nextPageToken");
    url.searchParams.set("supportsAllDrives", "true"); url.searchParams.set("includeItemsFromAllDrives", "true");
    if (config.driveId) { url.searchParams.set("corpora", "drive"); url.searchParams.set("driveId", config.driveId); }
    const query = source.searchParams.get("q"); if (query) url.searchParams.set("q", `trashed = false and name contains '${query.replaceAll("'", "\\'")}'`);
    const response = await googleRequest(request, auth.user.id, url.toString());
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (error) { return googleError(error); }
}
