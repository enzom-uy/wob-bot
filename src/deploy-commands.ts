import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.BOT_TOKEN || '';
const clientId = process.env.BOT_CLIENT_ID || '';
const guildId = process.env.GUILD_ID || '';

if (!token || !clientId) {
  console.error('❌ Env variables missing: BOT_TOKEN o CLIENT_ID.');
  process.exit(1);
}

const commands: unknown[] = [];
const foldersPath = path.join(__dirname, 'commands');

if (fs.existsSync(foldersPath)) {
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.match(/\.(js|ts)$/));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);

      const commandModule = await import(pathToFileURL(filePath).href);
      const command = commandModule.default || commandModule;

      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }
} else {
  console.warn(`⚠️  Commands folder not found in ${foldersPath}`);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`🔄 Updating ${commands.length} slash commands (/).`);

    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    const data = (await rest.put(route, { body: commands })) as unknown[];

    console.log(`✅ ${data.length} successfully updated commands (/).`);
  } catch (error) {
    console.error('❌ Something went wrong while updating commands:');
    console.error(error);
  }
})();
