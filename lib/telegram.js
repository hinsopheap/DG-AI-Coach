// lib/telegram.js — outbound Telegram Bot API helpers for DG AI Coach.

const BASE = 'https://api.telegram.org/bot';

function token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function call(method, body) {
  if (!token()) {
    console.log(`[Telegram] Not configured — would have called ${method}`);
    return { ok: false, reason: 'not_configured' };
  }
  const res = await fetch(`${BASE}${token()}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) console.error(`[Telegram] ${method} failed:`, data.description);
  return data;
}

export async function sendMessage(chatId, text, options = {}) {
  if (!chatId) return { ok: false, reason: 'no_chat_id' };
  return call('sendMessage', {
    chat_id:    chatId,
    text:       String(text).slice(0, 4096),
    parse_mode: 'Markdown',
    ...options,
  });
}

// Edit a message we previously sent. Returns the API response.
export async function editMessageText(chatId, messageId, text, options = {}) {
  if (!chatId || !messageId) return { ok: false, reason: 'missing_ids' };
  return call('editMessageText', {
    chat_id:    chatId,
    message_id: messageId,
    text:       String(text).slice(0, 4096),
    parse_mode: 'Markdown',
    ...options,
  });
}

// Delete a message (used to remove the placeholder if we have multi-message replies).
export async function deleteMessage(chatId, messageId) {
  if (!chatId || !messageId) return { ok: false };
  return call('deleteMessage', { chat_id: chatId, message_id: messageId });
}

export async function sendChatAction(chatId, action = 'typing') {
  if (!chatId) return;
  return call('sendChatAction', { chat_id: chatId, action });
}

// Keyboards -----------------------------------------------------------------

export function keyboard(rows) {
  return {
    reply_markup: {
      keyboard:          rows,
      resize_keyboard:   true,
      one_time_keyboard: true,
    },
  };
}

export function inlineKeyboard(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

export function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

export async function answerCallbackQuery(callbackQueryId, text = '') {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// Bot menu --------------------------------------------------------------------

export async function setMyCommands(commands) {
  return call('setMyCommands', { commands });
}

export async function setChatMenuButton() {
  return call('setChatMenuButton', { menu_button: { type: 'commands' } });
}

// Profile photos and files ---------------------------------------------------

export async function getUserProfilePhotos(userId) {
  return call('getUserProfilePhotos', { user_id: userId, limit: 1 });
}

export async function getFile(fileId) {
  return call('getFile', { file_id: fileId });
}

export function fileDownloadUrl(filePath) {
  if (!token() || !filePath) return null;
  return `https://api.telegram.org/file/bot${token()}/${filePath}`;
}

// Returns a Buffer with the file contents.
export async function downloadFileAsBuffer(filePath) {
  const url = fileDownloadUrl(filePath);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Webhook management --------------------------------------------------------

export async function setWebhook(publicUrl, secret) {
  const url = `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook/${secret}`;
  return call('setWebhook', {
    url,
    allowed_updates: ['message', 'callback_query'],
  });
}

export async function deleteWebhook() {
  return call('deleteWebhook', {});
}
