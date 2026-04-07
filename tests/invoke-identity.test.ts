import { describe, expect, it } from 'vitest';
import { resolveToolCategory, resolveInvokeAs, type ToolCategory } from '../src/core/invoke-identity';

// ---------------------------------------------------------------------------
// resolveToolCategory
// ---------------------------------------------------------------------------

describe('resolveToolCategory', () => {
  const cases: Array<[string, ToolCategory]> = [
    ['feishu_bitable_app.create', 'bitable'],
    ['feishu_bitable_app_table_record.list', 'bitable'],
    ['feishu_calendar_event.create', 'calendar'],
    ['feishu_calendar_freebusy.list', 'calendar'],
    ['feishu_chat.get', 'chat'],
    ['feishu_chat_members.default', 'chat'],
    ['feishu_doc_comments.list', 'drive'],
    ['feishu_doc_media.download', 'drive'],
    ['feishu_drive_file.list', 'drive'],
    ['feishu_drive_file.upload', 'drive'],
    ['feishu_create_doc.default', 'mcpDoc'],
    ['feishu_fetch_doc.default', 'mcpDoc'],
    ['feishu_update_doc.default', 'mcpDoc'],
    ['feishu_get_user.default', 'common'],
    ['feishu_get_user.basic_batch', 'common'],
    ['feishu_search_user.default', 'common'],
    ['feishu_im_user_fetch_resource.default', 'imUser'],
    ['feishu_im_user_get_messages.default', 'imUser'],
    ['feishu_search_doc_wiki.search', 'search'],
    ['feishu_task_task.create', 'task'],
    ['feishu_task_tasklist.list', 'task'],
    ['feishu_wiki_space.list', 'wiki'],
    ['feishu_wiki_space_node.create', 'wiki'],
    ['feishu_sheet.read', 'sheets'],
    ['feishu_sheet.write', 'sheets'],
  ];

  it.each(cases)('%s → %s', (toolAction, expected) => {
    expect(resolveToolCategory(toolAction)).toBe(expected);
  });

  it('returns undefined for unknown prefix', () => {
    expect(resolveToolCategory('feishu_unknown.action')).toBeUndefined();
    expect(resolveToolCategory('slack_drive_file.list')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveInvokeAs
// ---------------------------------------------------------------------------

describe('resolveInvokeAs', () => {
  it('returns undefined when invokeAs is not configured', () => {
    expect(resolveInvokeAs({}, 'feishu_drive_file.list')).toBeUndefined();
    expect(resolveInvokeAs({ invokeAs: undefined }, 'feishu_drive_file.list')).toBeUndefined();
  });

  it('returns global value when invokeAs is a string', () => {
    expect(resolveInvokeAs({ invokeAs: 'tenant' }, 'feishu_drive_file.list')).toBe('tenant');
    expect(resolveInvokeAs({ invokeAs: 'user' }, 'feishu_drive_file.list')).toBe('user');
  });

  it('returns per-category value from record config', () => {
    const config = { invokeAs: { drive: 'tenant' as const, calendar: 'user' as const } };
    expect(resolveInvokeAs(config, 'feishu_drive_file.list')).toBe('tenant');
    expect(resolveInvokeAs(config, 'feishu_calendar_event.create')).toBe('user');
  });

  it('returns undefined for unconfigured category in record mode', () => {
    const config = { invokeAs: { drive: 'tenant' as const } };
    expect(resolveInvokeAs(config, 'feishu_task_task.create')).toBeUndefined();
  });

  it('returns undefined when toolAction has no matching category in record mode', () => {
    const config = { invokeAs: { drive: 'tenant' as const } };
    expect(resolveInvokeAs(config, 'feishu_unknown.action')).toBeUndefined();
  });
});
