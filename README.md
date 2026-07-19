# Tech Blog Agent

Tech Blog Agent is a production-oriented content automation pipeline for generating, optimizing, and publishing technical articles to Blogger. It preserves the existing architecture while combining research, planning, writing, SEO, and publishing into a reliable workflow.

## Features

- AI-assisted research and topic planning
- Professional article generation with rich technical structure
- SEO-ready metadata and HTML rendering
- Blogger draft publishing with retries and token refresh
- GitHub Actions automation for scheduled runs
- Artifact generation for articles and reports

## Pipeline

```text
Research Agent
  → Planner Agent
  → Writer Agent
  → SEO Agent
  → Blogger Publisher
```

## Folder Structure

```text
tech-blog-agent/
├── src/
│   ├── agents/
│   │   ├── planner/
│   │   ├── publisher/
│   │   ├── research/
│   │   ├── seo/
│   │   └── writer/
│   ├── config/
│   ├── models/
│   ├── pipeline/
│   └── prompts/
├── output/
│   ├── articles/
│   │   ├── html/
│   │   ├── markdown/
│   │   └── metadata/
│   └── reports/
├── credentials/
├── .github/workflows
└── README.md
```

## Installation

```bash
git clone <repository-url>
cd tech-blog-agent
npm install
```

## Environment Variables

Create a `.env` file with:

```env
GEMINI_API_KEY=your_gemini_key
BLOGGER_BLOG_ID=your_blog_id
BLOGGER_CLIENT_ID=your_client_id
BLOGGER_CLIENT_SECRET=your_client_secret
BLOGGER_REFRESH_TOKEN=your_refresh_token
BLOGGER_OAUTH_FILE=credentials/blogger-oauth.json
SITE_URL=https://example.com
```

## OAuth

The publisher uses Google OAuth for Blogger access. On the first run, it can open the browser-based desktop flow to acquire the initial token. Subsequent runs reuse the saved token and refresh it automatically when expired.

## Blogger Publishing

The publisher:

- reads generated HTML articles
- uses metadata for titles and labels
- publishes drafts to Blogger
- retries transient API errors
- writes publish state and reports to the output folder

## GitHub Actions

The workflow at [.github/workflows/weekly-blog.yml](.github/workflows/weekly-blog.yml) runs on a weekly schedule and supports manual dispatch.

### Required GitHub Secrets

Add these repository secrets under Settings → Secrets and variables → Actions:

- `GEMINI_API_KEY`
- `BLOGGER_BLOG_ID`
- `BLOGGER_CLIENT_ID`
- `BLOGGER_CLIENT_SECRET`
- `BLOGGER_REFRESH_TOKEN`

### Manual Run

1. Open the GitHub repository.
2. Go to Actions.
3. Select Weekly Blog Pipeline.
4. Click Run workflow.

## Output

Generated files are stored under:

```text
output/articles/html
output/articles/markdown
output/articles/metadata
output/reports
```

## Security

Never commit secrets or local credentials. Keep the following excluded from version control:

```text
.env
token.json
credentials/
```

## Roadmap

- Add richer article scheduling and topic prioritization
- Add support for multi-blog publishing
- Improve article quality scoring and editorial review
- Expand analytics and content performance tracking

## License

This project is distributed under the ISC license.
