import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

export const COMMAND_OPTIONS = {
  query: 'consulta',
  afterDate: 'despues_de',
  beforeDate: 'antes_de',
} as const;

export const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:3000';
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const FLOW_TIMEOUT_MS = 120_000;
export const PAGE_JUMP_OPTION_LIMIT = 25;

export const CUSTOM_IDS = {
  selectResult: 'wobs_select_result',
  previousPage: 'wobs_previous_page',
  nextPage: 'wobs_next_page',
  jumpToPage: 'wobs_jump_to_page',
  previousPageBlock: 'wobs_previous_page_block',
  nextPageBlock: 'wobs_next_page_block',
  cancelFlow: 'wobs_cancel_flow',
  backToList: 'wobs_back_to_list',
  shareWob: 'wobs_share_wob',
  finishFlow: 'wobs_finish_flow',
} as const;

export interface WobResult {
  date?: string | Date;
  sourceUrl?: string | null;
  note?: string | null;
  tags?: string[] | null;
  data?: unknown;
  [key: string]: unknown;
}

export interface SearchResponse {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  data?: WobResult[];
  results?: WobResult[];
}

interface RandomResponse {
  data?: WobResult | null;
  afterDate?: string;
  beforeDate?: string;
}

type TranscriptEntry = {
  speaker?: unknown;
  text?: unknown;
  content?: unknown;
  body?: unknown;
  quote?: unknown;
  lines?: unknown;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractTextFromValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractTextFromValue(entry))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  const record = value as Record<string, unknown>;
  const preferredKeys = ['text', 'content', 'body', 'quote', 'lines'];

  for (const key of preferredKeys) {
    const candidate = record[key];
    const extracted = extractTextFromValue(candidate);

    if (extracted) {
      return extracted;
    }
  }

  if ('data' in record) {
    return extractTextFromValue(record.data);
  }

  return '';
}

export function parseDateInput(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);

  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function formatDateInput(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

export function formatDisplayDate(value: string | Date | undefined) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('es-UY');
}

export function isFutureDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date.getTime() > today.getTime();
}

export function getSearchResults(response: SearchResponse) {
  return response.data ?? response.results ?? [];
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export function extractWobText(value: unknown): string {
  const text = extractTextFromValue(value);

  if (text) {
    return text;
  }

  return 'Contenido no disponible.';
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function replaceAnchorTagsWithHref(value: string) {
  return value.replace(/<a\b([^>]*)>(.*?)<\/a>/gis, (_match, attributes: string) => {
    const hrefMatch = attributes.match(/href\s*=\s*["']([^"']+)["']/i);

    return hrefMatch ? hrefMatch[1] : '';
  });
}

export function htmlToMarkdown(value: string) {
  const withLineBreaks = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*\/blockquote\s*>/gi, '\n');

  const withAnchorsAsHref = replaceAnchorTagsWithHref(withLineBreaks);

  const withMarkdown = withAnchorsAsHref
    .replace(/<\s*(strong|b)\s*>(.*?)<\s*\/\1\s*>/gi, '**$2**')
    .replace(/<\s*(em|i)\s*>(.*?)<\s*\/\1\s*>/gi, '*$2*')
    .replace(/<\s*(code)\s*>(.*?)<\s*\/\1\s*>/gi, '`$2`')
    .replace(/<\s*li\s*>/gi, '- ')
    .replace(/<\s*blockquote\s*>/gi, '> ')
    .replace(/<\s*\/?(p|div|span|ul|ol|br|hr|section|article|header|footer)\s*\/?>/gi, '\n');

  const stripped = withMarkdown.replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(stripped)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wrapSpoiler(value: string) {
  return `||${value.replace(/\|\|/g, '\\|\\|')}||`;
}

export function buildSpoilerFieldValue(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return 'Sin dato';
  }

  return wrapSpoiler(value.trim());
}

export function logWobsError(error: unknown, context: Record<string, unknown>) {
  console.error('[wobs] interaction error', {
    ...context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  });
}

export async function runWithErrorLogging<T>(
  action: () => Promise<T>,
  context: Record<string, unknown>,
) {
  try {
    return await action();
  } catch (error) {
    logWobsError(error, context);
    throw error;
  }
}

export function normalizeWobText(value: unknown) {
  const rawText = extractWobText(value);

  if (!rawText || rawText === 'Contenido no disponible.') {
    return rawText;
  }

  return htmlToMarkdown(rawText);
}

function formatSpeakerName(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return 'Questioner';
}

function formatTranscriptEntry(entry: TranscriptEntry) {
  const speaker = formatSpeakerName(entry.speaker);
  const rawText = extractTextFromValue(entry);
  const normalizedText = htmlToMarkdown(String(rawText || 'Contenido no disponible.'));

  return `**${speaker}:** ${normalizedText}`;
}

function isTranscriptLikeObject(value: Record<string, unknown>) {
  return (
    'speaker' in value ||
    'text' in value ||
    'content' in value ||
    'body' in value ||
    'quote' in value ||
    'lines' in value ||
    'data' in value
  );
}

export function renderWobTranscript(value: unknown) {
  if (typeof value === 'string') {
    const normalized = htmlToMarkdown(value);

    return normalized || 'Contenido no disponible.';
  }

  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => {
        if (typeof entry === 'string') {
          const normalized = htmlToMarkdown(entry);
          return normalized ? `**Questioner:** ${normalized}` : null;
        }

        if (!isRecord(entry)) {
          return null;
        }

        if (isTranscriptLikeObject(entry)) {
          return formatTranscriptEntry(entry as TranscriptEntry);
        }

        const nestedData = extractTextFromValue(entry.data);
        if (nestedData) {
          const speaker = formatSpeakerName(entry.speaker);
          return `**${speaker}:** ${htmlToMarkdown(nestedData)}`;
        }

        return null;
      })
      .filter((entry): entry is string => Boolean(entry && entry.trim()));

    if (entries.length > 0) {
      return entries.join('\n\n');
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if ('data' in record) {
      const nestedData = record.data;

      if (Array.isArray(nestedData) || typeof nestedData === 'string') {
        return renderWobTranscript(nestedData);
      }

      if (isRecord(nestedData) && isTranscriptLikeObject(nestedData)) {
        return formatTranscriptEntry(nestedData as TranscriptEntry);
      }
    }

    if (isTranscriptLikeObject(record)) {
      return formatTranscriptEntry(record as TranscriptEntry);
    }
  }

  return 'Contenido no disponible.';
}

export function extractQuestionPreview(value: unknown) {
  const normalized = normalizeWobText(value);

  if (!normalized || normalized === 'Contenido no disponible.') {
    return normalized;
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return normalized;
  }

  const answerMarkerIndex = paragraphs.findIndex((paragraph) =>
    /^(brandon(?:\s+sanderson)?|bs|answer|respuesta)\s*[:\-]/i.test(paragraph),
  );

  const questionParagraphs =
    answerMarkerIndex > 0 ? paragraphs.slice(0, answerMarkerIndex) : [paragraphs[0]];

  const questionText = questionParagraphs.join('\n\n').trim();

  const cleanedQuestion = questionText.replace(
    /(^|\n)(brandon(?:\s+sanderson)?|bs|answer|respuesta)\s*[:\-].*$/gim,
    '',
  );

  return cleanedQuestion || paragraphs[0];
}

export function buildListOptionLabel(wob: WobResult, index: number) {
  const date = formatDisplayDate(wob.date);
  return truncateText(`${index + 1}. ${date}`, 100);
}

export function buildListOptionDescription(wob: WobResult) {
  const summarySource = wob.note?.trim() || extractQuestionPreview(wob.data);
  const summary = summarySource ? summarySource.replace(/\s+/g, ' ') : 'Sin descripción';

  return truncateText(summary, 100);
}

export function buildListEmbed(response: SearchResponse, query: string) {
  const results = getSearchResults(response);

  const lines = results.map((wob, index) => {
    const date = formatDisplayDate(wob.date);
    const title =
      wob.note?.trim() || extractQuestionPreview(wob.data).replace(/\s+/g, ' ') || 'Sin texto';
    const shortTitle = truncateText(title, 120);

    return `**${index + 1}.** ${date} - ${shortTitle}`;
  });

  return new EmbedBuilder()
    .setColor(0x2b90d9)
    .setTitle('Resultados de WoBs')
    .setDescription(
      lines.length > 0 ? lines.join('\n\n') : 'No hay resultados para mostrar en esta página.',
    )
    .addFields(
      { name: 'Consulta', value: `\`${query}\``, inline: true },
      { name: 'Página', value: `${response.currentPage}/${response.lastPage}`, inline: true },
      { name: 'Total', value: String(response.total), inline: true },
    );
}

export function buildDetailEmbed(
  wob: WobResult,
  positionLabel: string,
  options?: { spoilerContent?: boolean; spoilerTags?: boolean; spoilerNote?: boolean },
) {
  const content = renderWobTranscript(wob.data);
  const tags = wob.tags?.length ? wob.tags.join(', ') : 'Sin tags';
  const note = wob.note?.trim() || 'Sin nota';
  const description = truncateText(content || 'Contenido no disponible.', 3500);
  const finalDescription = options?.spoilerContent ? wrapSpoiler(description) : description;
  const finalTags = options?.spoilerTags ? buildSpoilerFieldValue(tags) : truncateText(tags, 1024);
  const finalNote = options?.spoilerNote ? buildSpoilerFieldValue(note) : truncateText(note, 1024);

  const embed = new EmbedBuilder()
    .setColor(0x2b90d9)
    .setTitle(`WoB ${positionLabel}`)
    .setDescription(finalDescription)
    .addFields(
      { name: 'Fecha', value: formatDisplayDate(wob.date), inline: true },
      { name: 'Tags', value: finalTags, inline: true },
      { name: 'Nota', value: finalNote, inline: false },
    );

  if (wob.sourceUrl) {
    embed.addFields({ name: 'Fuente', value: `[Abrir fuente](${wob.sourceUrl})`, inline: false });
  }

  return embed;
}

export function getPageJumpWindowStart(currentPage: number, lastPage: number) {
  if (lastPage <= PAGE_JUMP_OPTION_LIMIT) {
    return 1;
  }

  const halfWindow = Math.floor(PAGE_JUMP_OPTION_LIMIT / 2);
  let startPage = Math.max(1, currentPage - halfWindow);
  let endPage = startPage + PAGE_JUMP_OPTION_LIMIT - 1;

  if (endPage > lastPage) {
    endPage = lastPage;
    startPage = Math.max(1, endPage - PAGE_JUMP_OPTION_LIMIT + 1);
  }

  return startPage;
}

export function getPageJumpWindowEnd(startPage: number, lastPage: number) {
  return Math.min(startPage + PAGE_JUMP_OPTION_LIMIT - 1, lastPage);
}

export function buildPageJumpComponents(
  response: SearchResponse,
  disabled = false,
  windowStart = getPageJumpWindowStart(response.currentPage, response.lastPage),
) {
  if (response.lastPage <= 5) {
    return [];
  }

  const startPage = Math.max(1, Math.min(windowStart, response.lastPage));
  const endPage = getPageJumpWindowEnd(startPage, response.lastPage);

  const pageJumpMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.jumpToPage)
    .setPlaceholder(
      response.lastPage > PAGE_JUMP_OPTION_LIMIT
        ? `Páginas ${startPage}-${endPage}`
        : 'Saltar a otra página',
    )
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      Array.from({ length: endPage - startPage + 1 }, (_, index) => {
        const pageNumber = startPage + index;

        return {
          label: `Página ${pageNumber}`,
          value: String(pageNumber),
        };
      }),
    )
    .setDisabled(disabled);

  const components: Array<
    ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
  > = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pageJumpMenu)];

  if (response.lastPage > PAGE_JUMP_OPTION_LIMIT) {
    const previousBlockDisabled = disabled || startPage <= 1;
    const nextBlockDisabled = disabled || endPage >= response.lastPage;

    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.previousPageBlock)
          .setLabel('Bloque anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(previousBlockDisabled),
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.nextPageBlock)
          .setLabel('Bloque siguiente')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(nextBlockDisabled),
      ),
    );
  }

  return components;
}

export function buildListComponents(
  response: SearchResponse,
  disabled = false,
  windowStart = getPageJumpWindowStart(response.currentPage, response.lastPage),
) {
  const results = getSearchResults(response);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.selectResult)
    .setPlaceholder('Elegí una WoB para ver su detalle')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      results.map((wob, index) => ({
        label: buildListOptionLabel(wob, index),
        description: buildListOptionDescription(wob),
        value: String(index),
      })),
    )
    .setDisabled(disabled || results.length === 0);

  const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.previousPage)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || response.currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.nextPage)
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || response.currentPage >= response.lastPage),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.cancelFlow)
      .setLabel('Salir')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    ...buildPageJumpComponents(response, disabled, windowStart),
    navigationRow,
  ];
}

export function buildDetailComponents(disabled = false, shared = false) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.backToList)
        .setLabel('Volver a la lista')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.shareWob)
        .setLabel(shared ? 'Ya visible' : 'Hacer visible')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || shared),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.finishFlow)
        .setLabel('Terminar')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    ),
  ];
}

export async function fetchSearchPage({
  query,
  afterDate,
  beforeDate,
  page,
  perPage,
}: {
  query: string;
  afterDate?: Date;
  beforeDate?: Date;
  page: number;
  perPage: number;
}) {
  const url = new URL('/wobs/search', BACKEND_BASE_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(perPage));

  if (afterDate) {
    url.searchParams.set('afterDate', formatDateInput(afterDate));
  }

  if (beforeDate) {
    url.searchParams.set('beforeDate', formatDateInput(beforeDate));
  }

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Backend response failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }

  return (await response.json()) as SearchResponse;
}

export async function fetchRecentWobs() {
  const url = new URL('/wobs/recent', BACKEND_BASE_URL);

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Backend response failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }

  return (await response.json()) as SearchResponse;
}

export async function fetchRandomWob({
  afterDate,
  beforeDate,
}: {
  afterDate?: Date;
  beforeDate?: Date;
}): Promise<WobResult | null> {
  const url = new URL('/wobs/random', BACKEND_BASE_URL);

  if (afterDate) {
    url.searchParams.set('afterDate', formatDateInput(afterDate));
  }

  if (beforeDate) {
    url.searchParams.set('beforeDate', formatDateInput(beforeDate));
  }

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Backend response failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }

  const payload: unknown = await response.json();

  if (isRecord(payload) && 'afterDate' in payload && 'beforeDate' in payload) {
    const randomResponse = payload as RandomResponse;
    return randomResponse.data ?? null;
  }

  if (isRecord(payload)) {
    return payload as WobResult;
  }

  return null;
}
