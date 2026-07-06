import Parser from "rss-parser";
import { Article } from "../models/article.model";

const parser = new Parser();

export async function fetchFeed(url: string): Promise<Article[]> {
  const feed = await parser.parseURL(url);

  return (feed.items || []).map(item => ({
    source: feed.title ?? "Unknown",
    title: item.title ?? "",
    link: item.link ?? "",
    published: item.pubDate ?? "",
    categories: item.categories ?? []
  }));
}