import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  buildDetailEmbed,
  fetchRecentWobs,
  getSearchResults,
  logWobsError,
} from './wobs.helpers.js';

export const data = new SlashCommandBuilder()
  .setName('reciente')
  .setDescription('Muestra la WoB más reciente.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await fetchRecentWobs();

    const results = getSearchResults(response);

    if (results.length === 0) {
      await interaction.editReply({
        content: 'No hay WoBs recientes disponibles todavía.',
        embeds: [],
        components: [],
      });
      return;
    }

    await interaction.editReply({
      content: null,
      embeds: [buildDetailEmbed(results[0], 'más reciente')],
      components: [],
    });
  } catch (error) {
    logWobsError(error, {
      step: 'recent_command',
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: 'No pude comunicarme con el backend para obtener la WoB más reciente.',
      embeds: [],
      components: [],
    });
  }
}
