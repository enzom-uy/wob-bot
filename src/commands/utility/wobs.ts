import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  buildDetailComponents,
  buildDetailEmbed,
  buildListComponents,
  buildListEmbed,
  COMMAND_OPTIONS,
  CUSTOM_IDS,
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  FLOW_TIMEOUT_MS,
  PAGE_JUMP_OPTION_LIMIT,
  fetchSearchPage,
  getPageJumpWindowStart,
  getSearchResults,
  isFutureDate,
  logWobsError,
  parseDateInput,
  runWithErrorLogging,
  type SearchResponse,
  type WobResult,
} from './wobs.helpers.js';

export const data = new SlashCommandBuilder()
  .setName('wobs')
  .setDescription('Busca entre todas las WoBs publicadas en la coppermind.')
  .addStringOption((option) =>
    option
      .setName(COMMAND_OPTIONS.query)
      .setDescription('Búsqueda que querés hacer.')
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName(COMMAND_OPTIONS.afterDate)
      .setDescription('Filtra WoBs publicadas desde esta fecha. Formato DD-MM-YYYY.'),
  )
  .addStringOption((option) =>
    option
      .setName(COMMAND_OPTIONS.beforeDate)
      .setDescription('Filtra WoBs publicadas hasta esta fecha. Formato DD-MM-YYYY.'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userQuery = interaction.options.getString(COMMAND_OPTIONS.query, true);
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

  let currentPage = DEFAULT_PAGE;
  let currentResponse: SearchResponse;

  try {
    currentResponse = await runWithErrorLogging(
      () =>
        fetchSearchPage({
          query: userQuery,
          afterDate,
          beforeDate,
          page: currentPage,
          perPage: DEFAULT_PER_PAGE,
        }),
      {
        step: 'initial_fetch',
        query: userQuery,
        afterDate: afterDate?.toISOString(),
        beforeDate: beforeDate?.toISOString(),
        page: currentPage,
        perPage: DEFAULT_PER_PAGE,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      },
    );
  } catch (error) {
    logWobsError(error, {
      step: 'initial_fetch_failed',
      query: userQuery,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: 'No pude comunicarme con el backend para buscar las WoBs.',
      embeds: [],
      components: [],
    });
    return;
  }

  const results = getSearchResults(currentResponse);

  if (currentResponse.total === 0 || results.length === 0) {
    await interaction.editReply({
      content: `No encontré WoBs para \`${userQuery}\`.`,
      embeds: [],
      components: [],
    });
    return;
  }

  if (currentResponse.total === 1 && results.length === 1) {
    await interaction.editReply({
      content: null,
      embeds: [buildDetailEmbed(results[0], '1 de 1')],
      components: [],
    });
    return;
  }

  let viewMode: 'list' | 'detail' = 'list';
  let currentPageJumpWindowStart = getPageJumpWindowStart(
    currentResponse.currentPage,
    currentResponse.lastPage,
  );
  let currentDetailWob: WobResult | null = null;
  let currentDetailPositionLabel = '';
  let currentDetailShared = false;

  await interaction.editReply({
    content: null,
    embeds: [buildListEmbed(currentResponse, userQuery)],
    components: buildListComponents(currentResponse, false, currentPageJumpWindowStart),
  });
  const replyMessage = await interaction.fetchReply();

  const collector = replyMessage.createMessageComponentCollector({
    time: FLOW_TIMEOUT_MS,
    filter: (componentInteraction) => componentInteraction.user.id === interaction.user.id,
  });

  const renderListView = async (page: number) => {
    currentPage = page;
    currentResponse = await runWithErrorLogging(
      () =>
        fetchSearchPage({
          query: userQuery,
          afterDate,
          beforeDate,
          page: currentPage,
          perPage: DEFAULT_PER_PAGE,
        }),
      {
        step: 'page_fetch',
        query: userQuery,
        afterDate: afterDate?.toISOString(),
        beforeDate: beforeDate?.toISOString(),
        page: currentPage,
        perPage: DEFAULT_PER_PAGE,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      },
    );
    currentPageJumpWindowStart = getPageJumpWindowStart(
      currentResponse.currentPage,
      currentResponse.lastPage,
    );

    viewMode = 'list';

    await interaction.editReply({
      content: null,
      embeds: [buildListEmbed(currentResponse, userQuery)],
      components: buildListComponents(currentResponse, false, currentPageJumpWindowStart),
    });
  };

  const renderCurrentListView = async () => {
    viewMode = 'list';

    await interaction.editReply({
      content: null,
      embeds: [buildListEmbed(currentResponse, userQuery)],
      components: buildListComponents(currentResponse, false, currentPageJumpWindowStart),
    });
  };

  const movePageJumpWindow = async (direction: 'previous' | 'next') => {
    if (currentResponse.lastPage <= PAGE_JUMP_OPTION_LIMIT) {
      return;
    }

    const nextWindowStart =
      direction === 'previous'
        ? Math.max(1, currentPageJumpWindowStart - PAGE_JUMP_OPTION_LIMIT)
        : Math.min(
            currentResponse.lastPage - PAGE_JUMP_OPTION_LIMIT + 1,
            currentPageJumpWindowStart + PAGE_JUMP_OPTION_LIMIT,
          );

    if (nextWindowStart === currentPageJumpWindowStart) {
      return;
    }

    currentPageJumpWindowStart = nextWindowStart;
    await renderCurrentListView();
  };

  const renderDetailView = async (index: number) => {
    const resultsOnPage = getSearchResults(currentResponse);
    const wob = resultsOnPage[index];

    if (!wob) {
      return;
    }

    viewMode = 'detail';
    currentDetailWob = wob;
    currentDetailPositionLabel = `${(currentPage - 1) * currentResponse.perPage + index + 1} de ${
      currentResponse.total
    }`;
    currentDetailShared = false;

    await runWithErrorLogging(
      () =>
        interaction.editReply({
          content: null,
          embeds: [buildDetailEmbed(wob, currentDetailPositionLabel)],
          components: buildDetailComponents(false, currentDetailShared),
        }),
      {
        step: 'render_detail',
        page: currentPage,
        selectedIndex: index,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      },
    );
  };

  collector.on('collect', async (componentInteraction) => {
    try {
      if (componentInteraction.isStringSelectMenu()) {
        const selectedValue = componentInteraction.values[0];
        const index = Number.parseInt(selectedValue, 10);

        if (Number.isNaN(index)) {
          await componentInteraction.reply({
            content: 'No pude interpretar la selección.',
            ephemeral: true,
          });
          return;
        }

        if (componentInteraction.customId === CUSTOM_IDS.jumpToPage) {
          if (index < 1 || index > currentResponse.lastPage) {
            await componentInteraction.reply({
              content: `La página tiene que estar entre 1 y ${currentResponse.lastPage}.`,
              ephemeral: true,
            });
            return;
          }

          await componentInteraction.deferUpdate();
          await renderListView(index);
          return;
        }

        await componentInteraction.deferUpdate();
        await renderDetailView(index);
        return;
      }

      if (!componentInteraction.isButton()) {
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.previousPage) {
        if (currentPage <= 1) {
          await componentInteraction.deferUpdate();
          return;
        }

        await componentInteraction.deferUpdate();
        await renderListView(currentPage - 1);
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.nextPage) {
        if (currentPage >= currentResponse.lastPage) {
          await componentInteraction.deferUpdate();
          return;
        }

        await componentInteraction.deferUpdate();
        await renderListView(currentPage + 1);
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.previousPageBlock) {
        await componentInteraction.deferUpdate();
        await movePageJumpWindow('previous');
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.nextPageBlock) {
        await componentInteraction.deferUpdate();
        await movePageJumpWindow('next');
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.backToList) {
        if (viewMode !== 'detail') {
          await componentInteraction.deferUpdate();
          return;
        }

        await componentInteraction.deferUpdate();
        await renderCurrentListView();
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.shareWob) {
        if (viewMode !== 'detail' || !currentDetailWob) {
          await componentInteraction.deferUpdate();
          return;
        }

        const detailWob = currentDetailWob;
        currentDetailShared = true;
        await componentInteraction.deferUpdate();

        await runWithErrorLogging(
          () =>
            componentInteraction.followUp({
              embeds: [
                buildDetailEmbed(detailWob, currentDetailPositionLabel, {
                  spoilerContent: true,
                  spoilerTags: true,
                  spoilerNote: true,
                }),
              ],
            }),
          {
            step: 'share_public_followup',
            userId: interaction.user.id,
            guildId: interaction.guildId,
            currentPage,
            currentDetailPositionLabel,
          },
        );

        await runWithErrorLogging(
          () =>
            interaction.editReply({
              content: null,
              embeds: [buildDetailEmbed(detailWob, currentDetailPositionLabel)],
              components: buildDetailComponents(false, currentDetailShared),
            }),
          {
            step: 'share_private_update',
            userId: interaction.user.id,
            guildId: interaction.guildId,
            currentPage,
            currentDetailPositionLabel,
          },
        );
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.cancelFlow) {
        collector.stop('cancelled');
        await componentInteraction.update({
          content: 'Flujo cancelado.',
          embeds: [],
          components: [],
        });
        return;
      }

      if (componentInteraction.customId === CUSTOM_IDS.finishFlow) {
        collector.stop('finished');
        await componentInteraction.update({
          content: 'Flujo finalizado.',
          embeds: [],
          components: [],
        });
      }
    } catch (error) {
      logWobsError(error, {
        step: 'collector_handler',
        customId:
          componentInteraction.isButton() || componentInteraction.isStringSelectMenu()
            ? componentInteraction.customId
            : 'unknown',
        userId: componentInteraction.user.id,
        guildId: interaction.guildId,
        currentPage,
        viewMode,
      });

      if (componentInteraction.deferred || componentInteraction.replied) {
        await componentInteraction.followUp({
          content: 'Hubo un error al procesar la interacción.',
          ephemeral: true,
        });
        return;
      }

      await componentInteraction.reply({
        content: 'Hubo un error al procesar la interacción.',
        ephemeral: true,
      });
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'cancelled' || reason === 'finished') {
      return;
    }

    if (viewMode === 'detail') {
      await runWithErrorLogging(
        () => interaction.editReply({ components: buildDetailComponents(true, currentDetailShared) }),
        {
          step: 'collector_end_detail',
          reason,
          userId: interaction.user.id,
          guildId: interaction.guildId,
          currentPage,
        },
      );
      return;
    }

    await runWithErrorLogging(
      () => interaction.editReply({ components: buildListComponents(currentResponse, true) }),
      {
        step: 'collector_end_list',
        reason,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        currentPage,
      },
    );
  });
}
