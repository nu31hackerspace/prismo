import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDiscordWebhookUrl } from './discord-hook';

test('isDiscordWebhookUrl only accepts https Discord webhook urls', () => {
  assert.ok(isDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc'));
  assert.ok(isDiscordWebhookUrl('https://discordapp.com/api/webhooks/123/abc'));
  assert.ok(!isDiscordWebhookUrl('http://discord.com/api/webhooks/123/abc'));
  assert.ok(!isDiscordWebhookUrl('https://discord.com.evil.io/api/webhooks/1/a'));
  assert.ok(!isDiscordWebhookUrl('https://evil.io/api/webhooks/1/a'));
  assert.ok(!isDiscordWebhookUrl('https://discord.com/channels/1'));
  assert.ok(!isDiscordWebhookUrl('not a url'));
});
