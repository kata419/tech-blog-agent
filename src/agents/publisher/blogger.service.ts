import fs from "fs-extra";
import path from "path";
import open from "open";
import readline from "readline";
import { google } from "googleapis";
import {
    BLOGGER_BLOG_ID,
    BLOGGER_OAUTH_FILE,
    BLOGGER_SCOPE,
    BLOGGER_TOKEN_FILE
} from "../../config/blogger.config";

interface OAuthCredentials {
    installed?: {
        client_id: string;
        client_secret: string;
        redirect_uris: string[];
    };
    web?: {
        client_id: string;
        client_secret: string;
        redirect_uris: string[];
    };
}

interface BloggerToken {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
    token_type?: string;
    scope?: string;
}

export interface BloggerPublishResult {
    postId: string;
    url: string;
    title: string;
    labels: string[];
}

interface BloggerPostRequestBody {
    title: string;
    content: string;
    isDraft: boolean;
    labels?: string[];
}

type BloggerAuthClient = InstanceType<typeof google.auth.OAuth2>;

export class BloggerService {

    private async loadCredentials(): Promise<OAuthCredentials> {
        const oauthPath = path.resolve(process.cwd(), BLOGGER_OAUTH_FILE);

        if (!await fs.pathExists(oauthPath)) {
            throw new Error(`Blogger OAuth credential file not found at ${oauthPath}`);
        }

        return await fs.readJson(oauthPath) as OAuthCredentials;
    }

    private getClientFromCredentials(credentials: OAuthCredentials): BloggerAuthClient {
        const payload = credentials.installed ?? credentials.web;

        if (!payload) {
            throw new Error("Blogger OAuth credential file must contain an installed or web OAuth client section.");
        }

        const redirectUri = payload.redirect_uris[0];

        return new google.auth.OAuth2(
            payload.client_id,
            payload.client_secret,
            redirectUri
        );
    }

    private async loadTokens(): Promise<BloggerToken | null> {
        const tokenPath = path.resolve(process.cwd(), BLOGGER_TOKEN_FILE);

        if (!await fs.pathExists(tokenPath)) {
            return null;
        }

        return await fs.readJson(tokenPath).catch(() => null) as BloggerToken | null;
    }

    private async saveTokens(tokens: BloggerToken): Promise<void> {
        const tokenPath = path.resolve(process.cwd(), BLOGGER_TOKEN_FILE);
        await fs.writeJson(tokenPath, tokens, { spaces: 2 });
    }

    private async askForCode(authUrl: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log("\nAuthorize this app by visiting the URL below:\n");
        console.log(authUrl);
        console.log("\nA browser window should open automatically. After granting access, paste the code below.\n");

        await open(authUrl);

        return new Promise((resolve) => {
            rl.question("Enter authorization code: ", (code) => {
                rl.close();
                resolve(code.trim());
            });
        });
    }

    private async authenticateWithCode(authClient: BloggerAuthClient): Promise<BloggerAuthClient> {
        console.log("No Blogger token.json found. Starting Google OAuth desktop authentication...");

        const authUrl = authClient.generateAuthUrl({
            access_type: "offline",
            scope: [BLOGGER_SCOPE],
            prompt: "consent"
        });

        const code = await this.askForCode(authUrl);
        console.log("Authorization code received. Exchanging it for Blogger tokens...");

        const response = await authClient.getToken(code);

        if (!response.tokens) {
            throw new Error("Google OAuth flow did not return any tokens.");
        }

        authClient.setCredentials(response.tokens);
        await this.saveTokens(response.tokens as BloggerToken);
        console.log("Blogger authentication complete. token.json saved successfully.");

        return authClient;
    }

    private async ensureValidToken(authClient: BloggerAuthClient): Promise<void> {
        const tokens = await this.loadTokens();

        if (!tokens) {
            return;
        }

        authClient.setCredentials(tokens);

        const expiryDate = tokens.expiry_date ?? 0;
        const isExpired = expiryDate > 0 && expiryDate <= Date.now() + 5 * 60 * 1000;

        if (!isExpired) {
            console.log("Using existing Blogger access token.");
            return;
        }

        if (!tokens.refresh_token) {
            console.log("Blogger access token expired and no refresh token is available. Re-authentication is required.");
            throw new Error("Blogger access token expired and no refresh token is available.");
        }

        try {
            console.log("Refreshing expired Blogger access token...");
            const refreshed = await authClient.refreshAccessToken();
            const refreshedTokens = refreshed.credentials as BloggerToken;
            await this.saveTokens(refreshedTokens);
            authClient.setCredentials(refreshedTokens);
            console.log("Blogger access token refreshed successfully.");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Blogger token refresh failed: ${message}`);
        }
    }

    private async authorize(): Promise<BloggerAuthClient> {
        const credentials = await this.loadCredentials();
        const authClient = this.getClientFromCredentials(credentials);
        const tokens = await this.loadTokens();

        if (!tokens) {
            return this.authenticateWithCode(authClient);
        }

        console.log("Found existing Blogger token.json. Validating authentication...");
        await this.ensureValidToken(authClient);
        return authClient;
    }

    async publishDraft(title: string, html: string, labels: string[] = []): Promise<BloggerPublishResult> {
        const auth = await this.authorize();

        const blogger = google.blogger({ version: "v3", auth });

        const requestBody: BloggerPostRequestBody = {
            title,
            content: html,
            isDraft: true
        };

        if (labels.length) {
            requestBody.labels = labels;
        }

        const result = await blogger.posts.insert({
            blogId: BLOGGER_BLOG_ID,
            requestBody
        });

        const postId = result.data.id ?? "";
        const url = result.data.url ?? `https://www.blogger.com/blog/post/edit/${postId}`;

        return { postId, url, title, labels };
    }

}
