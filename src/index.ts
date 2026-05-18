import { Client, GatewayIntentBits, Events } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Bot conectado como ${readyClient.user.tag}`);
});

// Reemplazar con token real o leer de process.env.DISCORD_TOKEN
const token = process.env.BOT_TOKEN || '';

if (!token) {
  console.error('No bot token detected in env variables.');
} else {
  client.login(token);
}
