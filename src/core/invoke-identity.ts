/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * 工具调用身份解析模块。
 *
 * 根据 toolAction 前缀自动推导工具类别，再结合 invokeAs 配置
 * 决定调用身份（user / tenant）。
 */

import type { FeishuAccountConfig } from './types';

// ---------------------------------------------------------------------------
// Tool category
// ---------------------------------------------------------------------------

export type ToolCategory =
  | 'drive'
  | 'wiki'
  | 'calendar'
  | 'task'
  | 'bitable'
  | 'sheets'
  | 'chat'
  | 'search'
  | 'imUser'
  | 'common'
  | 'mcpDoc';

/**
 * 前缀 → 类别映射（按最长前缀优先排列）。
 *
 * 匹配规则：取第一个匹配的前缀。靠前的条目优先级更高，
 * 因此更具体的前缀（如 `feishu_doc_comments`）应排在
 * 更笼统的前缀（如 `feishu_doc`）之前。
 */
const PREFIX_MAP: ReadonlyArray<readonly [string, ToolCategory]> = [
  ['feishu_bitable_', 'bitable'],
  ['feishu_calendar_', 'calendar'],
  ['feishu_chat', 'chat'],
  ['feishu_doc_comments', 'drive'],
  ['feishu_doc_media', 'drive'],
  ['feishu_drive_', 'drive'],
  ['feishu_create_doc', 'mcpDoc'],
  ['feishu_fetch_doc', 'mcpDoc'],
  ['feishu_update_doc', 'mcpDoc'],
  ['feishu_get_user', 'common'],
  ['feishu_search_user', 'common'],
  ['feishu_im_user_', 'imUser'],
  ['feishu_search_', 'search'],
  ['feishu_task_', 'task'],
  ['feishu_wiki_', 'wiki'],
  ['feishu_sheet', 'sheets'],
];

/**
 * 从 toolAction 字符串推导工具类别。
 *
 * @returns 匹配到的类别，未匹配返回 `undefined`
 */
export function resolveToolCategory(toolAction: string): ToolCategory | undefined {
  for (const [prefix, category] of PREFIX_MAP) {
    if (toolAction.startsWith(prefix)) return category;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// invokeAs resolution
// ---------------------------------------------------------------------------

/**
 * 根据配置和 toolAction 解析调用身份。
 *
 * 优先级：按类别配置 > 全局配置 > undefined（调用方走默认 user）。
 *
 * @returns `'user'` | `'tenant'` | `undefined`（未配置）
 */
export function resolveInvokeAs(
  config: Pick<FeishuAccountConfig, 'invokeAs'>,
  toolAction: string,
): 'user' | 'tenant' | undefined {
  const { invokeAs } = config;
  if (invokeAs == null) return undefined;

  if (typeof invokeAs === 'string') return invokeAs;

  const category = resolveToolCategory(toolAction);
  if (category && category in invokeAs) {
    return invokeAs[category];
  }
  return undefined;
}
