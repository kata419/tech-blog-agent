export interface Metadata {
    title: string;
    slug: string;
    description: string;
    keywords: string[];
    category: string;
    author: string;
    canonicalUrl?: string;
    readingTimeMinutes?: number;
    suggestedTags?: string[];
    ogTitle?: string;
    ogDescription?: string;
    twitterCard?: string;
}