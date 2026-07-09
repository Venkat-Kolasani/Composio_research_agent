# Manual Setup Checklist

These are the only manual things still worth doing before final submission. Everything else is scripted.

## Required Before Submission

1. **Composio account and API key**
   - Sign up at https://composio.dev.
   - The pricing page currently advertises a free tier with 20k tool calls/month, which is enough for this proof run.
   - Create a project API key in the Composio dashboard.
   - Add it locally:

```bash
echo 'COMPOSIO_API_KEY=your_key_here' >> .env
npm run proof:mcp
npm run build:site
```

2. **Vercel account**
   - The project is already deployed at https://composio-research-agent.vercel.app.
   - Vercel Hobby is free for personal projects.
   - If you deploy from a new machine:

```bash
npx vercel login
npx vercel --prod
```

3. **GitHub repo access**
   - Repo: https://github.com/Venkat-Kolasani/Composio_research_agent
   - Make sure the final commit is pushed before sending the take-home.

```bash
git status
git push
```

## Optional But Strong

1. **LLM key for live refresh**
   - `OPENAI_API_KEY` is optional. Use it only if you add a live LLM extraction pass.
   - The current submitted dataset does not require it because the evidence catalog is already curated and linked to official docs.

2. **Search API key**
   - `TAVILY_API_KEY` or `SERPER_API_KEY` is optional.
   - Use this if you want to refresh all evidence URLs automatically before resubmitting later.

3. **Composio org API key**
   - Only needed if you extend the project to query project-management endpoints directly.
   - The current MCP proof only needs the normal project API key.

## Do Not Spend Money On

- Paid accounts for the 100 target apps.
- Paid ad platform access.
- Paid fintech production approvals.
- Enterprise APIs such as PitchBook or Amazon Selling Partner approval.

For this assignment, “gated behind paid/admin/partner approval” is a correct finding, not a failure.

## Final Pre-Submission Commands

```bash
npm run audit
npm run proof:mcp
npm run build:site
git status
npx vercel --prod
```

If `proof:mcp` says `skipped_no_api_key`, add `COMPOSIO_API_KEY` and rerun it. That is the only current proof artifact still dependent on your manual setup.
