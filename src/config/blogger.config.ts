import dotenv from "dotenv";

dotenv.config();

export const BLOGGER_BLOG_ID = process.env.BLOGGER_BLOG_ID;
export const BLOGGER_OAUTH_FILE = process.env.BLOGGER_OAUTH_FILE || "credentials/blogger-oauth.json";
export const BLOGGER_TOKEN_FILE = process.env.BLOGGER_TOKEN_FILE || "token.json";
export const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";
export const BLOGGER_DEFAULT_LABELS = ["Angular", "TypeScript", "Frontend"];

if (!BLOGGER_BLOG_ID) {
    throw new Error("BLOGGER_BLOG_ID is required in .env");
}
