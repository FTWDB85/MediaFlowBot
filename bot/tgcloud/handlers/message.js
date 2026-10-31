import { api } from 'sdk';

export default async function (message) {
  const text = message.text?.trim();

  if (!text) return;

  const command = text.split(/\s+/, 1)[0]
    .split('@')[0]
    .toLowerCase();

  if (command === '/start') {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: "Welcome to FTWDBdownloaderBot!\n\nThis bot is designed to process video and audio media.\n\nMore features are coming soon.",
    });

    return;
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: "Send /start to begin using the bot.",
  });
}