/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * External script-based agent routing.
 *
 * Dynamically imports a user-supplied routing module and calls its
 * default export function with the message context.  The function
 * returns `{ agentId }` to decide which agent handles the session.
 * Results are cached per session+sender with configurable TTL.
 */

import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { larkLogger } from './lark-logger';

const log = larkLogger('script-router');

// ---------------------------------------------------------------------------
// State directory resolution (mirrors SDK convention)
// ---------------------------------------------------------------------------

function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) return override;
  return path.join(os.homedir(), '.openclaw');
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ScriptRouterInput {
  senderId: string;
  senderName?: string;
  chatId?: string;
  chatType: 'group' | 'p2p';
  accountId: string;
  messageType: string;
  content?: string;
}

export interface ScriptRouterResult {
  agentId: string;
}

export interface ScriptRouterApi {
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

/**
 * Create a ScriptRouterApi logger that adapts LarkLogger's
 * (message, meta?) signature to a variadic (...args) interface
 * that is simpler for external script authors.
 */
function createScriptRouterApi(): ScriptRouterApi {
  const inner = larkLogger('in-route-script');
  const adapt =
    (fn: (message: string, meta?: Record<string, unknown>) => void) =>
    (...args: unknown[]) => {
      fn(args.map(String).join(' '));
    };
  return {
    logger: {
      info: adapt(inner.info.bind(inner)),
      warn: adapt(inner.warn.bind(inner)),
      error: adapt(inner.error.bind(inner)),
    },
  };
}

/** The function signature that routing scripts must default-export. */
export type RoutingFunction = (
  input: ScriptRouterInput,
  api: ScriptRouterApi,
) => ScriptRouterResult | Promise<ScriptRouterResult>;

// ---------------------------------------------------------------------------
// Session-level route cache (with TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  agentId: string;
  expiresAt: number;
}

const routeCache = new Map<string, CacheEntry>();

export function getCachedRoute(sessionKey: string): string | undefined {
  const entry = routeCache.get(sessionKey);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    routeCache.delete(sessionKey);
    return undefined;
  }
  return entry.agentId;
}

export function setCachedRoute(sessionKey: string, agentId: string, ttl: number): void {
  if (ttl <= 0) return; // ttl=0 means no caching
  routeCache.set(sessionKey, { agentId, expiresAt: Date.now() + ttl });
}

export function clearCachedRoute(sessionKey: string): void {
  routeCache.delete(sessionKey);
}

export function clearAllRouteCache(): void {
  routeCache.clear();
}

// ---------------------------------------------------------------------------
// Core: execute external routing script via dynamic import
// ---------------------------------------------------------------------------

export async function execRouteScript(params: {
  scriptPath: string;
  input: ScriptRouterInput;
  timeout: number;
  validAgentIds?: string[];
}): Promise<ScriptRouterResult | null> {
  const { scriptPath, input, timeout, validAgentIds } = params;
  // Absolute paths used as-is; relative paths resolved against OPENCLAW_STATE_DIR (~/.openclaw/)
  const resolved = path.isAbsolute(scriptPath) ? scriptPath : path.resolve(resolveStateDir(), scriptPath);

  log.info('executing route script', { script: resolved, timeout });

  try {
    // Dynamic import using file:// URL for cross-platform compatibility
    const moduleUrl = pathToFileURL(resolved).href;
    const mod = await Promise.race([
      import(moduleUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('route script timed out')), timeout),
      ),
    ]);

    const routeFn: unknown = mod.default;
    if (typeof routeFn !== 'function') {
      log.warn('route script does not export a default function', { script: resolved });
      return null;
    }

    const result: unknown = await Promise.race([
      (routeFn as RoutingFunction)(input, createScriptRouterApi()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('route function timed out')), timeout),
      ),
    ]);

    if (!result || typeof result !== 'object' || typeof (result as Record<string, unknown>).agentId !== 'string') {
      log.warn('route script returned unexpected shape', { script: resolved, result });
      return null;
    }

    const agentId = (result as ScriptRouterResult).agentId;

    if (validAgentIds && !validAgentIds.includes(agentId)) {
      log.warn('route script returned unknown agentId', { script: resolved, agentId, validAgentIds });
      return null;
    }

    log.info('route script resolved', { script: resolved, agentId });
    return { agentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('timed out')) {
      log.warn('route script timed out', { script: resolved, timeout });
    } else {
      log.error('route script failed', { script: resolved, error: message });
    }
    return null;
  }
}
