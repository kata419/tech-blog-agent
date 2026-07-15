# Tech Blog Agent

AI-powered blog automation that researches, plans, writes, optimizes, and publishes high-quality frontend development articles to Blogger.

---

# Features

- 🤖 AI-powered research
- 📝 Automatic article planning
- ✍️ AI article generation using Gemini
- 🎨 HTML generation
- 🔍 SEO metadata generation
- 📢 Blogger draft publishing
- 🏷️ Automatic labels
- 📊 Publishing reports
- 🔄 OAuth token management
- 🚀 Weekly GitHub Actions automation (coming next)

---

# Tech Stack

- Node.js 24
- TypeScript
- Gemini API
- Google Blogger API
- GitHub Actions
- Markdown
- HTML

---

# Pipeline

```
Research Agent
        │
        ▼
Planner Agent
        │
        ▼
Writer Agent
        │
        ▼
HTML Generator
        │
        ▼
SEO Generator
        │
        ▼
Blogger Publisher
```

---

# Project Structure

```
tech-blog-agent/
│
├── src/
│   ├── agents/
│   │   ├── research/
│   │   ├── planner/
│   │   ├── writer/
│   │   ├── seo/
│   │   └── publisher/
│   │
│   ├── pipeline/
│   └── config/
│
├── output/
│   ├── articles/
│   │   ├── markdown/
│   │   ├── html/
│   │   └── metadata/
│   │
│   └── reports/
│       ├── blogger-publish-report.json
│       └── blogger-publish-state.json
│
├── credentials/
├── .github/
└── README.md
```

---

# Quick Start

## Clone Repository

```bash
git clone <your-repository-url>
cd tech-blog-agent
```

## Install Dependencies

```bash
npm install
```

## Configure Environment

Create a `.env` file.

```env
GEMINI_API_KEY=your_gemini_key

BLOGGER_BLOG_ID=your_blog_id

BLOGGER_CLIENT_ID=your_client_id

BLOGGER_CLIENT_SECRET=your_client_secret

BLOGGER_REFRESH_TOKEN=your_refresh_token

BLOGGER_OAUTH_FILE=credentials/blogger-oauth.json
```

---

# Run

```bash
npm run dev
```

The pipeline automatically executes:

1. Research latest topics
2. Plan articles
3. Generate Markdown
4. Generate HTML
5. Generate SEO metadata
6. Publish Blogger Drafts
7. Generate publishing reports

---

# Blogger Publishing

The publisher automatically:

- Reads HTML from

```
output/articles/html
```

- Reads metadata from

```
output/articles/metadata
```

- Publishes every unpublished article as a **Blogger Draft**

- Stores publishing state in

```
output/reports/blogger-publish-state.json
```

- Generates report

```
output/reports/blogger-publish-report.json
```

Already published articles are skipped automatically.

---

# OAuth Authentication

The first execution opens Google's OAuth page.

After successful authentication:

- `token.json` is created automatically.
- Future executions reuse the saved token.
- Expired access tokens are refreshed automatically.

No manual authentication is required again unless the refresh token becomes invalid.

---

# GitHub Actions

A workflow is available at:

```
.github/workflows/weekly-blog.yml
```

Features:

- Runs every Sunday at 06:00 UTC
- Manual execution supported
- Executes complete pipeline
- Publishes Blogger drafts
- Uploads reports as workflow artifacts
- Uses dependency caching

Required GitHub Secrets:

```
GEMINI_API_KEY

BLOGGER_BLOG_ID

BLOGGER_CLIENT_ID

BLOGGER_CLIENT_SECRET

BLOGGER_REFRESH_TOKEN
```

---

# Output

```
output/

├── articles/
│   ├── markdown/
│   ├── html/
│   └── metadata/
│
└── reports/
    ├── blogger-publish-report.json
    └── blogger-publish-state.json
```

---

# Security

Never commit the following files:

```
.env

token.json

credentials/
```

Ensure they remain listed in `.gitignore`.

---

# Reports

Every execution generates:

- Publishing report
- Publishing state
- Console logs
- Blogger URLs
- Post IDs

These reports can be used for monitoring and debugging.

---

# Roadmap

- ✅ Research Agent
- ✅ Planner Agent
- ✅ Writer Agent
- ✅ HTML Generator
- ✅ SEO Generator
- ✅ Blogger Publisher
- ⏳ Weekly GitHub Actions
- ⏳ Internal Linking
- ⏳ Automatic Image Generation
- ⏳ SEO Score Analysis
- ⏳ Blogger Post Synchronization
- ⏳ AI Content Quality Improvements

---

# License

MIT License

---

Built with ❤️ using TypeScript, Gemini AI, and Google Blogger API.