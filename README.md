# tech-blog-agent
AI Agent to automatically generate and publish frontend tech blogs.

## Blogger publishing

The publisher uses the existing Research → Planner → Writer → SEO pipeline and adds Blogger draft publishing as the final step.

Configuration:
- Set BLOGGER_BLOG_ID in .env.
- Set BLOGGER_OAUTH_FILE if you use a different OAuth client file.
- The publisher reads labels from article metadata when available; otherwise it falls back to Angular, TypeScript, and Frontend.
- OAuth tokens are stored in token.json and are ignored by Git.
- Published article state is tracked in output/reports/blogger-publish-state.json so previously published HTML files are skipped on later runs.

The publisher publishes every HTML file under output/articles/html as a Blogger draft and writes a JSON report to output/reports/blogger-publish-report.json.
