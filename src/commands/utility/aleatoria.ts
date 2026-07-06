import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  buildDetailEmbed,
  COMMAND_OPTIONS,
  fetchRandomWob,
  isFutureDate,
  logWobsError,
  parseDateInput,
} from './wobs.helpers.js';

export const data = new SlashCommandBuilder()
  .setName('aleatoria')
  .setDescription('Muestra una WoB aleatoria.')
  .addStringOption((option) =>
    option
      .setName(COMMAND_OPTIONS.afterDate)
      .setDescription('Solo WoBs posteriores a esta fecha. Formato DD-MM-YYYY.'),
  )
  .addStringOption((option) =>
    option
      .setName(COMMAND_OPTIONS.beforeDate)
      .setDescription('Solo WoBs anteriores a esta fecha. Formato DD-MM-YYYY.'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const afterDateInput = interaction.options.getString(COMMAND_OPTIONS.afterDate);
  const beforeDateInput = interaction.options.getString(COMMAND_OPTIONS.beforeDate);

  let afterDate: Date | undefined;
  let beforeDate: Date | undefined;

  if (afterDateInput) {
    const parsedAfterDate = parseDateInput(afterDateInput);

    if (!parsedAfterDate) {
      await interaction.reply({
        content: 'La fecha `despues_de` tiene que tener el formato `DD-MM-YYYY` y ser válida.',
        ephemeral: true,
      });
      return;
    }

    if (isFutureDate(parsedAfterDate)) {
      await interaction.reply({
        content: '`despues_de` no puede ser una fecha futura.',
        ephemeral: true,
      });
      return;
    }

    afterDate = parsedAfterDate;
  }

  if (beforeDateInput) {
    const parsedBeforeDate = parseDateInput(beforeDateInput);

    if (!parsedBeforeDate) {
      await interaction.reply({
        content: 'La fecha `antes_de` tiene que tener el formato `DD-MM-YYYY` y ser válida.',
        ephemeral: true,
      });
      return;
    }

    if (isFutureDate(parsedBeforeDate)) {
      await interaction.reply({
        content: '`antes_de` no puede ser una fecha futura.',
        ephemeral: true,
      });
      return;
    }

    beforeDate = parsedBeforeDate;
  }

  if (afterDate && beforeDate && afterDate.getTime() >= beforeDate.getTime()) {
    await interaction.reply({
      content: '`antes_de` debe ser posterior a `despues_de`.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const wob = await fetchRandomWob({ afterDate, beforeDate });

    if (!wob) {
      await interaction.editReply({
        content: 'No encontré una WoB aleatoria con esos filtros.',
        embeds: [],
        components: [],
      });
      return;
    }

    await interaction.editReply({
      content: null,
      embeds: [buildDetailEmbed(wob, 'aleatoria')],
      components: [],
    });
  } catch (error) {
    logWobsError(error, {
      step: 'random_command',
      userId: interaction.user.id,
      guildId: interaction.guildId,
      afterDate: afterDate?.toISOString(),
      beforeDate: beforeDate?.toISOString(),
    });

    await interaction.editReply({
      content: 'No pude comunicarme con el backend para obtener una WoB aleatoria.',
      embeds: [],
      components: [],
    });
  }
}
