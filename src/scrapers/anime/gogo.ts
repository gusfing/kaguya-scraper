import axios from 'axios';
import { load } from 'cheerio';
import AnimeScraper, {
  AnimeSource,
  GetSourcesQuery,
} from '../../core/AnimeScraper';
import gogoExtractor from '../../extractors/gogoplay';
import { SourceAnime, SourceEpisode } from '../../types/data';
import { fulfilledPromises } from '../../utils';

const BASE_URL = 'https://gogoanime.sk';
const BASE_AJAX_URL = 'https://ajax.gogo-load.com/ajax';

export default class AnimeGOGOScraper extends AnimeScraper {
  constructor() {
    super('gogo', 'GOGO', { baseURL: BASE_URL });

    // Languages that the source supports (Two letter code)
    // See more: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
    this.locales = ['en'];
    this.blacklistTitles = ['live action', 'dub'];

    this.monitor.onRequest = async () => {
      const { data } = await axios.get(
        `${BASE_AJAX_URL}/page-recent-release.html?page=1&type=1`,
      );

      return data;
    };
  }

  shouldMonitorChange(oldPage: string, newPage: string): boolean {
    if (!oldPage || !newPage) return false;

    const selector = '.items li:first-child';
    const nameSelector = '.name';

    const $old = load(oldPage);
    const $new = load(newPage);

    const oldTitle = $old(selector).find(nameSelector).text().trim();
    const newTitle = $new(selector).find(nameSelector).text().trim();

    return oldTitle !== newTitle;
  }

  async scrapeAnimePage(page: number): Promise<SourceAnime[]> {
    const { data } = await axios.get(
      `${BASE_AJAX_URL}/page-recent-release.html`,
      {
        params: {
          page,
          type: 1,
        },
      },
    );

    const $ = load(data);

    return fulfilledPromises<Promise<SourceAnime>>(
      $('.items li')
        .toArray()
        .map(async (el) => {
          const href = $(el).find('a').attr('href') as string;

          // /honzuki-no-gekokujou-shisho-ni-naru-tame-ni-wa-shudan-wo-erandeiraremasen-3rd-season-episode-4
          const [sourceMediaId] = href.replace('/', '').split('-episode');
          const episodes = await this.getEpisodes(sourceMediaId);
          const name = $(el).find('.name').text();

          return {
            titles: [name],
            episodes,
            sourceId: this.id,
            sourceMediaId: sourceMediaId,
          };
        }),
    );
  }

  async getEpisodes(
    sourceSlug: string,
    sourceId?: string,
  ): Promise<SourceEpisode[]> {
    if (!sourceId) {
      sourceId = await this.getAnimeId(sourceSlug);
    }

    const { data } = await axios.get(`${BASE_AJAX_URL}/load-list-episode`, {
      params: {
        ep_start: 0,
        ep_end: 10000,
        id: sourceId,
      },
    });

    const $ = load(data);

    return $('ul li')
      .toArray()
      .map((el) => {
        const $el = $(el);

        const href = $el.find('a').attr('href') as string;
        const sourceEpisodeId = href.trim().replace(/\//g, '');

        const name = $el.find('.name').text().trim();

        return {
          name,
          sourceEpisodeId,
          sourceMediaId: sourceSlug,
        };
      });
  }

  async getAnimeId(sourceSlug: string): Promise<string> {
    const { data } = await this.client.get(`/category/${sourceSlug}`);

    const $ = load(data);

    return $('#movie_id').val() as string;
  }

  async getSources(query: GetSourcesQuery): Promise<AnimeSource> {
    const { episode_id } = query;
    const { sources } = await gogoExtractor(episode_id);

    if (!sources?.length) return { sources: [] };

    return { sources };
  }
}
