import { Article } from "../models/article.model";
import { Metadata } from "../models/metadata.model";

export interface PipelineContext {

    articles: Article[];

    plannedArticles: any[];

    currentArticle: any;

    markdown: string;

    html: string;

    metadata: Metadata | null;

}