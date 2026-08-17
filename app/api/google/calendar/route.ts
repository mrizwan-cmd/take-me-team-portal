import { getGoogleConfig, googleError, googleRequest } from "../_lib";
import { requirePortalUser, requireSameOrigin } from "../../_auth";

export async function GET(request: Request) {
  try {
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const source = new URL(request.url);
    const config = await getGoogleConfig(request);
    const calendarId = source.searchParams.get("calendarId") || config.calendarId;
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("singleEvents", "true"); url.searchParams.set("orderBy", "startTime"); url.searchParams.set("maxResults", "100");
    url.searchParams.set("timeMin", source.searchParams.get("timeMin") || new Date(Date.now() - 7 * 86400000).toISOString());
    url.searchParams.set("timeMax", source.searchParams.get("timeMax") || new Date(Date.now() + 90 * 86400000).toISOString());
    const response = await googleRequest(request, auth.user.id, url.toString());
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (error) { return googleError(error); }
}

export async function POST(request: Request) {
  try {
    const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const body = await request.json() as { title: string; date: string; start: string; end: string; location?: string; notes?: string; guests?: string[]; meet?: boolean; timeZone?: string };
    if (!body.title || !body.date || !body.start || !body.end) return googleError(new Error("Title, date, start and end are required"), 400);
    const config = await getGoogleConfig(request);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
    url.searchParams.set("sendUpdates", "all"); if (body.meet) url.searchParams.set("conferenceDataVersion", "1");
    const timeZone = body.timeZone || "Europe/London";
    const event = { summary: body.title, description: body.notes || "", location: body.location || (body.meet ? "Google Meet" : ""), start: { dateTime: `${body.date}T${body.start}:00`, timeZone }, end: { dateTime: `${body.date}T${body.end}:00`, timeZone }, attendees: (body.guests || []).map(email => ({ email })), ...(body.meet ? { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}) };
    const response = await googleRequest(request, auth.user.id, url.toString(), { method: "POST", body: JSON.stringify(event) });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json" } });
  } catch (error) { return googleError(error); }
}

export async function PATCH(request: Request) {
  try {
    const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const source = new URL(request.url); const eventId = source.searchParams.get("eventId");
    if (!eventId) return googleError(new Error("eventId is required"), 400);
    const config = await getGoogleConfig(request); const payload = await request.json();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
    const response = await googleRequest(request, auth.user.id, url, { method: "PATCH", body: JSON.stringify(payload) });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json" } });
  } catch (error) { return googleError(error); }
}

export async function DELETE(request: Request) {
  try {
    const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const source = new URL(request.url); const eventId = source.searchParams.get("eventId");
    if (!eventId) return googleError(new Error("eventId is required"), 400);
    const config = await getGoogleConfig(request);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
    const response = await googleRequest(request, auth.user.id, url, { method: "DELETE" });
    return response.status === 204 ? new Response(null, { status: 204 }) : new Response(response.body, { status: response.status, headers: { "content-type": "application/json" } });
  } catch (error) { return googleError(error); }
}
