/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Pending inbox: bridges outbound messages across session resets.
 *
 * When user A sends a message to idle user B via the bot, the outbound
 * path writes an entry here. When B replies and triggers a new session,
 * the inbound dispatch reads and clears these entries, injecting them
 * into InboundHistory so the AI sees A's message as context.
 *
 * Storage is in-memory (process-scoped Map). Loss on restart is
 * acceptable — the messages themselves are already delivered to Feishu.
 */

export interface PendingInboxEntry {
  sender: string;
  body: string;
  timestamp: number;
}

const store = new Map<string, PendingInboxEntry[]>();

export function writePendingInbox(sessionKey: string, entry: PendingInboxEntry): void {
  const existing = store.get(sessionKey);
  if (existing) {
    existing.push(entry);
  } else {
    store.set(sessionKey, [entry]);
  }
}

export function readAndClearPendingInbox(sessionKey: string): PendingInboxEntry[] | undefined {
  const entries = store.get(sessionKey);
  if (entries && entries.length > 0) {
    store.delete(sessionKey);
    return entries;
  }
  return undefined;
}
