import { FEEDS } from "../config/feeds";
import { fetchFeed } from "../services/rss.service";
import { Logger } from "../utils/logger";
import fs from "fs-extra";

export class ResearchAgent {

  async run() {

    Logger.info("Research Agent Started");

    let articles: any[] = [];

    for (const feed of FEEDS) {

      Logger.info(`Checking ${feed.name}`);

      try {

        const result = await fetchFeed(feed.url);

        Logger.success(`${result.length} articles found`);

        articles.push(...result);

      } catch (error) {

        Logger.error(`Unable to read ${feed.name}`);

      }

    }

    articles = articles.filter(
      (article, index, self) =>
        index === self.findIndex(a => a.link === article.link)
    );

    await fs.ensureDir("output/reports");

    await fs.writeJson(
      "output/reports/research-report.json",
      articles,
      { spaces: 2 }
    );

    Logger.success(`Saved ${articles.length} articles`);
  }

}