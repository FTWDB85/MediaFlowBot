import { api, fetch } from 'sdk';

const API_URL = 'https://mediaflow-api.danial-khazafmoghadam.workers.dev';

export default async function (message) {
  const text = message.text?.trim();

  if (!text) return;

  const chatId = message.chat.id;

  const command = text.split(/\s+/, 1)[0]
    .split('@')[0]
    .toLowerCase();

  if (command === '/start') {
    await api.sendMessage({
      chat_id: chatId,
      text: "Welcome to FTWDB Downloader Bot!\n\nSend a supported media link to get started.",
    });

    return;
  }

  // Extract the first HTTPS link
  const urlMatch = text.match(/https:\/\/[^\s]+/i);

  if (!urlMatch) {
    await api.sendMessage({
      chat_id: chatId,
      text: "Please send a valid media URL.",
    });

    return;
  }

  const mediaUrl = urlMatch[0].replace(/[.,!?)}\]]+$/, '');

  try {
    const response = await fetch(`${API_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: mediaUrl,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      await api.sendMessage({
        chat_id: chatId,
        text: "This link is invalid or its platform is not supported.",
      });

      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `Your request has been registered!\n\nJob ID: ${result.job_id}\nPlatform: ${result.platform}\nStatus: ${result.status}`,
    });
  }    catch (error) {
    console.error('API request failed:', error);

    await api.sendMessage({
      chat_id: chatId,
      text: `API Connection Error\nType: ${error.name}\nDetails: ${error.message}`,
    });
  }
}