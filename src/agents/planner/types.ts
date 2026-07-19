export interface RssArticle {
    title: string;
    link: string;
    source: string;
    published: Date;
}

export interface GeneratedTopics {
    source: string;
    topics: string[];
}
