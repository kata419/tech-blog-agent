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

interface RetryableErrorContext {
    attempt: number;
    maxAttempts: number;
    reason: string;
}

export class BloggerService {
    private authClientCache: BloggerAuthClient | null = null;
    private tokenCache: BloggerToken | null = null;
    private readonly maxAttempts = 3;

    /**
     * Publishes a blog post as a Blogger draft.
     */
    public async publishDraft(title: string, html: string, labels: string[] = []): Promise<BloggerPublishResult> {
        this.logInfo("Publishing", title);

        const auth = await this.authorize();
        const blogger = google.blogger({ version: "v3", auth });
        const requestBody: BloggerPostRequestBody = {
            title,
            content: html,
            isDraft: true
        };

        if (labels.length > 0) {
            requestBody.labels = labels;
        }

        const result = await this.publishWithRetry(blogger, title, labels, requestBody);

        this.logSuccess("Draft Published", `Post ID: ${result.postId}\nURL: ${result.url}\nTitle: ${title}\nLabels: ${labels.join(", ")}`);
        return result;
    }

    private async publishWithRetry(
        blogger: ReturnType<typeof google.blogger>,
        title: string,
        labels: string[],
        requestBody: BloggerPostRequestBody
    ): Promise<BloggerPublishResult> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                const response = await blogger.posts.insert({
                    blogId: BLOGGER_BLOG_ID,
                    requestBody
                });

                const postId = response.data.id ?? "";
                const url = response.data.url ?? `https://www.blogger.com/blog/post/edit/${postId}`;

                return {
                    postId,
                    url,
                    title,
                    labels
                };
            } catch (error) {
                const reason = this.normalizeError(error);
                lastError = new Error(reason);

                if (this.shouldRetry(reason, attempt)) {
                    const context: RetryableErrorContext = {
                        attempt,
                        maxAttempts: this.maxAttempts,
                        reason
                    };
                    this.logRetry(context);
                    await this.delay(this.calculateBackoff(attempt));
                    continue;
                }

                throw this.wrapError(reason, title);
            }
        }

        throw this.wrapError(lastError?.message ?? "Unknown publish failure", title);
    }

    private shouldRetry(reason: string, attempt: number): boolean {
        const retryable = ["429", "500", "502", "503", "504"].some(code => reason.includes(code));
        return retryable && attempt < this.maxAttempts;
    }

    private calculateBackoff(attempt: number): number {
        return Math.min(2000 * attempt, 8000);
    }

    private async delay(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async authorize(): Promise<BloggerAuthClient> {
        if (this.authClientCache) {
            return this.authClientCache;
        }

        const credentials = await this.loadCredentials();
        const authClient = this.createAuthClient(credentials);
        const tokens = await this.loadTokens();

        if (tokens) {
            this.tokenCache = tokens;
            this.logInfo("Authentication", "Using existing Blogger token file.");
            await this.ensureValidToken(authClient, tokens);
            this.authClientCache = authClient;
            return authClient;
        }

        if (process.env.GITHUB_ACTIONS === "true") {
            const refreshToken = process.env.BLOGGER_REFRESH_TOKEN;
            if (!refreshToken) {
                throw new Error("GitHub Actions requires BLOGGER_REFRESH_TOKEN to be set.");
            }

            this.logInfo("Authentication", "Authenticating silently using GitHub Actions refresh token.");
            await this.authenticateWithRefreshToken(authClient, refreshToken);
            this.authClientCache = authClient;
            return authClient;
        }

        this.logInfo("Authentication", "No token file found. Starting desktop OAuth flow.");
        await this.authenticateWithCode(authClient);
        this.authClientCache = authClient;
        return authClient;
    }

    private async loadCredentials(): Promise<OAuthCredentials> {
        const clientId = process.env.BLOGGER_CLIENT_ID;
        const clientSecret = process.env.BLOGGER_CLIENT_SECRET;

        if (clientId && clientSecret) {
            return {
                installed: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uris: ["http://localhost"]
                }
            };
        }

        const oauthPath = path.resolve(process.cwd(), BLOGGER_OAUTH_FILE);
        if (!await fs.pathExists(oauthPath)) {
            throw new Error(`Blogger OAuth credential file not found at ${oauthPath}`);
        }

        return await fs.readJson(oauthPath) as OAuthCredentials;
    }

    private createAuthClient(credentials: OAuthCredentials): BloggerAuthClient {
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
        if (this.tokenCache) {
            return this.tokenCache;
        }

        const tokenPath = path.resolve(process.cwd(), BLOGGER_TOKEN_FILE);
        if (!await fs.pathExists(tokenPath)) {
            return null;
        }

        const tokens = await fs.readJson(tokenPath) as BloggerToken;
        this.tokenCache = tokens;
        return tokens;
    }

    private async saveTokens(tokens: BloggerToken): Promise<void> {
        const tokenPath = path.resolve(process.cwd(), BLOGGER_TOKEN_FILE);
        this.tokenCache = tokens;
        await fs.ensureDir(path.dirname(tokenPath));
        await fs.writeJson(tokenPath, tokens, { spaces: 2 });
    }

    private async askForCode(authUrl: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log("\n[INFO]\nAuthorize this app by visiting the URL below:\n");
        console.log(authUrl);
        console.log("\n[INFO]\nOpen the browser and complete the sign-in flow. Paste the code below when prompted.\n");

        await open(authUrl);

        return new Promise<string>((resolve) => {
            rl.question("Enter authorization code: ", (code: string) => {
                rl.close();
                resolve(code.trim());
            });
        });
    }

    private async authenticateWithCode(authClient: BloggerAuthClient): Promise<void> {
        const authUrl = authClient.generateAuthUrl({
            access_type: "offline",
            scope: [BLOGGER_SCOPE],
            prompt: "consent"
        });

        const code = await this.askForCode(authUrl);
        const response = await authClient.getToken(code);

        if (!response.tokens) {
            throw new Error("Google OAuth flow did not return authentication tokens.");
        }

        const mergedTokens = this.mergeTokens(response.tokens as BloggerToken);
        authClient.setCredentials(mergedTokens);
        await this.saveTokens(mergedTokens);
        this.logSuccess("Authentication", "Blogger authentication complete. Token saved.");
    }

    private async authenticateWithRefreshToken(authClient: BloggerAuthClient, refreshToken: string): Promise<void> {
        authClient.setCredentials({ refresh_token: refreshToken });
        const response = await authClient.refreshAccessToken();
        const mergedTokens = this.mergeTokens(
            response.credentials as BloggerToken,
            { refresh_token: refreshToken }
        );
        authClient.setCredentials(mergedTokens);
        await this.saveTokens(mergedTokens);
        this.logSuccess("Authentication", "Blogger authentication complete using refresh token.");
    }

    private async ensureValidToken(authClient: BloggerAuthClient, tokens: BloggerToken): Promise<void> {
        authClient.setCredentials(tokens);

        const expiryDate = tokens.expiry_date ?? 0;
        const isExpired = expiryDate > 0 && expiryDate <= Date.now() + 5 * 60 * 1000;

        if (!isExpired) {
            this.logInfo("Authentication", "Using existing Blogger access token.");
            return;
        }

        const refreshToken = process.env.BLOGGER_REFRESH_TOKEN ?? tokens.refresh_token;
        if (!refreshToken) {
            throw new Error("Blogger access token expired and no refresh token is available.");
        }

        this.logInfo("Authentication", "Refreshing expired Blogger access token.");
        authClient.setCredentials({ refresh_token: refreshToken });
        const response = await authClient.refreshAccessToken();
        const refreshedTokens = this.mergeTokens(
            response.credentials as BloggerToken,
            { refresh_token: refreshToken },
            tokens
        );
        authClient.setCredentials(refreshedTokens);
        await this.saveTokens(refreshedTokens);
        this.logSuccess("Authentication", "Blogger access token refreshed successfully.");
    }

    private mergeTokens(...sources: Array<Partial<BloggerToken> | undefined>): BloggerToken {
        const merged: BloggerToken = {};

        for (const source of sources) {
            if (!source) {
                continue;
            }

            if (source.access_token) {
                merged.access_token = source.access_token;
            }
            if (source.refresh_token) {
                merged.refresh_token = source.refresh_token;
            }
            if (source.expiry_date) {
                merged.expiry_date = source.expiry_date;
            }
            if (source.token_type) {
                merged.token_type = source.token_type;
            }
            if (source.scope) {
                merged.scope = source.scope;
            }
        }

        return merged;
    }

    private normalizeError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    private wrapError(reason: string, title: string): Error {
        return new Error(`Blogger publish failed for "${title}". Reason: ${reason}`);
    }

    private logInfo(event: string, message: string): void {
        console.log(`[INFO]\n${event}\n${message}`);
    }

    private logSuccess(event: string, message: string): void {
        console.log(`[SUCCESS]\n${event}\n${message}`);
    }

    private logRetry(context: RetryableErrorContext): void {
        console.warn(`[WARN]\nRetrying publish\nAttempt: ${context.attempt}/${context.maxAttempts}\nReason: ${context.reason}`);
    }

}
