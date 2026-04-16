/**
 * Test fixture: normal routing script.
 * Routes vip_user to premium-agent, others to default-agent.
 */
import type { ScriptRouterInput } from '../../src/core/script-router';

export default function route(input: ScriptRouterInput) {
  if (input.senderId === 'vip_user') {
    return { agentId: 'premium-agent' };
  }
  return { agentId: 'default-agent' };
}
