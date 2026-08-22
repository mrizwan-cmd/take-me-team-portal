"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultPortalState,
  mergePortalState,
  type PortalState,
} from "./portal-data";
import { useRealtime } from "./use-realtime";

export type SaveStatus =
  | "Loading"
  | "Saving"
  | "Saved"
  | "Save failed"
  | "Unavailable"
  | "Conflict — merging";
export type PortalIdentity = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  canApprove: boolean;
  localDevelopment: boolean;
};

type PortalResponse = {
  data?: Partial<PortalState>;
  revision?: number;
  personalRevision?: number;
  featureRevisions?: Record<string, number>;
  user?: PortalIdentity;
};

const personalAreas = new Set([
  "profile",
  "preferences",
  "widgets",
  "tasks",
  "events",
  "notifications",
  "leave",
  "shifts",
]);
const featureAreas = new Set([
  "conversations",
  "documents",
  "articles",
  "projectBoards",
  "projectAutomations",
  "projectTemplates",
]);

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function equalRevisions(
  left: Record<string, number>,
  right: Record<string, number> | undefined,
) {
  return equal(left, right || {});
}

function mergeArray(
  base: unknown[],
  local: unknown[],
  remote: unknown[],
): unknown[] {
  const identifiable = [...base, ...local, ...remote].every(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).id === "string",
  );
  if (!identifiable) return equal(local, base) ? remote : local;
  const byId = (items: unknown[]) =>
    new Map(
      items.map((item) => [String((item as Record<string, unknown>).id), item]),
    );
  const baseById = byId(base);
  const localById = byId(local);
  const remoteById = byId(remote);
  const order = [
    ...remote.map((item) => String((item as Record<string, unknown>).id)),
    ...local.map((item) => String((item as Record<string, unknown>).id)),
  ];
  const ids = [...new Set(order)];
  const merged: unknown[] = [];
  for (const id of ids) {
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (baseItem && !localItem) {
      if (remoteItem && !equal(remoteItem, baseItem)) merged.push(remoteItem);
      continue;
    }
    if (baseItem && !remoteItem) {
      if (localItem && !equal(localItem, baseItem)) merged.push(localItem);
      continue;
    }
    if (!baseItem) {
      merged.push(localItem ?? remoteItem);
      continue;
    }
    if (localItem !== undefined && remoteItem !== undefined)
      merged.push(mergeThreeWay(baseItem, localItem, remoteItem));
  }
  return merged;
}

function mergeThreeWay(
  base: unknown,
  local: unknown,
  remote: unknown,
): unknown {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote))
    return mergeArray(base, local, remote);
  if (
    base &&
    local &&
    remote &&
    typeof base === "object" &&
    typeof local === "object" &&
    typeof remote === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(local) &&
    !Array.isArray(remote)
  ) {
    const baseObject = base as Record<string, unknown>;
    const localObject = local as Record<string, unknown>;
    const remoteObject = remote as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of new Set([
      ...Object.keys(baseObject),
      ...Object.keys(localObject),
      ...Object.keys(remoteObject),
    ]))
      result[key] = mergeThreeWay(
        baseObject[key],
        localObject[key],
        remoteObject[key],
      );
    return result;
  }
  return local;
}

function changedAreas(base: PortalState, next: PortalState) {
  const areas = (Object.keys(next) as Array<keyof PortalState>).filter(
    (key) => !equal(base[key], next[key]),
  );
  const shared = areas.filter((area) => !personalAreas.has(area));
  return shared.length ? shared : ["personal"];
}

async function loadPortalState() {
  const response = await fetch("/api/portal-state", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Company sign-in is required"
        : "Portal data could not be loaded",
    );
  return response.json() as Promise<PortalResponse>;
}

export function usePortalState() {
  const [state, setState] = useState<PortalState>(defaultPortalState);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Loading");
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [loadError, setLoadError] = useState("");
  const ready = useRef(false);
  const revision = useRef(0);
  const personalRevision = useRef(0);
  const featureRevisions = useRef<Record<string, number>>({});
  const stateRef = useRef<PortalState>(defaultPortalState);
  const baseState = useRef<PortalState>(defaultPortalState);
  const dirty = useRef(false);
  const saving = useRef(false);
  const refreshing = useRef(false);
  const changeSequence = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const realtimeSend = useRef<(event: Record<string, unknown>) => boolean>(
    () => false,
  );

  const applyRemote = useCallback((result: PortalResponse, force = false) => {
    if (!result.data || (!force && (dirty.current || saving.current)))
      return false;
    const nextRevision = result.revision || 0;
    const nextPersonalRevision = result.personalRevision || 0;
    if (
      !force &&
      nextRevision === revision.current &&
      nextPersonalRevision === personalRevision.current &&
      equalRevisions(featureRevisions.current, result.featureRevisions)
    )
      return false;
    const next = mergePortalState(result.data);
    stateRef.current = next;
    baseState.current = next;
    revision.current = nextRevision;
    personalRevision.current = nextPersonalRevision;
    featureRevisions.current = result.featureRevisions || {};
    dirty.current = false;
    setState(next);
    if (result.user) setIdentity(result.user);
    setSaveStatus("Saved");
    return true;
  }, []);

  const refreshFromServer = useCallback(
    async (includeBackgroundTab = false) => {
      if (
        !ready.current ||
        refreshing.current ||
        dirty.current ||
        saving.current ||
        (!includeBackgroundTab && document.visibilityState === "hidden")
      )
        return;
      refreshing.current = true;
      try {
        applyRemote(await loadPortalState());
      } catch {
        /* preserve the last safe screen during a background outage */
      } finally {
        refreshing.current = false;
      }
    },
    [applyRemote],
  );

  const realtime = useRealtime(
    Boolean(state.adminSettings.realtimeEnabled),
    () => {
      void refreshFromServer(true);
    },
  );
  useEffect(() => {
    realtimeSend.current = realtime.send;
  }, [realtime.send]);

  const scheduleSave = useCallback((delay = 450) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveStatus("Saving");
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveRef.current();
    }, delay);
  }, []);

  const persistLatest = useCallback(async () => {
    if (!ready.current || !dirty.current || saving.current) return;
    saving.current = true;
    const snapshot = stateRef.current;
    const base = baseState.current;
    const sequence = changeSequence.current;
    try {
      const changed = (
        Object.keys(snapshot) as Array<keyof PortalState>
      ).filter((key) => !equal(base[key], snapshot[key]));
      const featureChanges = Object.fromEntries(
        changed
          .filter((key) => featureAreas.has(key))
          .map((key) => [key, snapshot[key]]),
      );
      if (Object.keys(featureChanges).length) {
        const featureResponse = await fetch("/api/portal-state/features", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            areas: featureChanges,
            revisions: featureRevisions.current,
          }),
        });
        const featureResult =
          (await featureResponse.json()) as PortalResponse & { code?: string };
        if (!featureResponse.ok) {
          if (featureResponse.status === 409) {
            setSaveStatus("Conflict — merging");
            const latest = await loadPortalState();
            const remote = mergePortalState(latest.data);
            const merged = mergeThreeWay(
              base,
              stateRef.current,
              remote,
            ) as PortalState;
            revision.current = latest.revision || 0;
            personalRevision.current = latest.personalRevision || 0;
            featureRevisions.current = latest.featureRevisions || {};
            baseState.current = remote;
            stateRef.current = merged;
            dirty.current = true;
            changeSequence.current += 1;
            setState(merged);
            scheduleSave(80);
            return;
          }
          throw new Error("Feature save failed");
        }
        featureRevisions.current = {
          ...featureRevisions.current,
          ...(featureResult.featureRevisions || {}),
        };
      }
      const response = await fetch("/api/portal-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: snapshot,
          revision: revision.current,
          personalRevision: personalRevision.current,
        }),
      });
      const result = (await response.json()) as PortalResponse & {
        code?: string;
      };
      if (
        response.status === 409 &&
        (result.code === "revision_conflict" ||
          result.code === "personal_revision_conflict")
      ) {
        setSaveStatus("Conflict — merging");
        const latest = await loadPortalState();
        const remote = mergePortalState(latest.data);
        const local = stateRef.current;
        const merged = mergeThreeWay(base, local, remote) as PortalState;
        revision.current = latest.revision || 0;
        personalRevision.current = latest.personalRevision || 0;
        baseState.current = remote;
        stateRef.current = merged;
        dirty.current = true;
        changeSequence.current += 1;
        setState(merged);
        scheduleSave(80);
        return;
      }
      if (!response.ok) throw new Error("Save failed");
      revision.current = result.revision || revision.current;
      personalRevision.current =
        result.personalRevision || personalRevision.current;
      baseState.current = snapshot;
      const hasNewerChanges = changeSequence.current !== sequence;
      dirty.current = hasNewerChanges;
      setSaveStatus(hasNewerChanges ? "Saving" : "Saved");
      realtimeSend.current({
        type: "state.changed",
        areas: changedAreas(base, snapshot),
        revision: revision.current,
        personalRevision: personalRevision.current,
      });
      if (hasNewerChanges) scheduleSave(80);
    } catch {
      setSaveStatus("Save failed");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void saveRef.current();
      }, 5_000);
    } finally {
      saving.current = false;
    }
  }, [scheduleSave]);
  useEffect(() => {
    saveRef.current = persistLatest;
  }, [persistLatest]);

  useEffect(() => {
    let active = true;
    loadPortalState()
      .then((result) => {
        if (!active) return;
        applyRemote(result, true);
        ready.current = true;
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Portal data could not be loaded",
        );
        setSaveStatus("Unavailable");
      });
    return () => {
      active = false;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [applyRemote]);

  useEffect(() => {
    if (!state.adminSettings.realtimeEnabled) return;
    const seconds = Math.max(
      2,
      Math.min(30, Number(state.adminSettings.realtimePollingSeconds) || 3),
    );
    const timer = window.setInterval(() => {
      void refreshFromServer();
    }, seconds * 1000);
    const focus = () => {
      if (document.visibilityState === "visible") void refreshFromServer(true);
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [
    refreshFromServer,
    state.adminSettings.realtimeEnabled,
    state.adminSettings.realtimePollingSeconds,
  ]);

  const updateState = useCallback(
    (updater: (current: PortalState) => PortalState) => {
      setState((current) => {
        const next = updater(current);
        if (next === current || equal(next, current)) return current;
        stateRef.current = next;
        dirty.current = true;
        changeSequence.current += 1;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  return { state, updateState, saveStatus, identity, loadError, realtime };
}
