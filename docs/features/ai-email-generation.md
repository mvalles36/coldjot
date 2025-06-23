# AI-Powered Email Generation

## 1. Feature Overview & Purpose
ColdJot now embeds Mistral-powered “Intelligence” inside the sequence email editor so users can instantly draft highly-personalised cold emails or entire follow-up sequences.  
Goals:

* Accelerate campaign creation (reduce manual copy-writing time).  
* Maintain contextual relevance by analysing previous steps.  
* Let users iterate quickly via **Re-generate**.  
* Persist every draft for analytics/rollback.

---

## 2. Architecture & Component Breakdown

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| UI (Next.js / shadcn) | `SequenceEmailEditor` + `IntelligenceModal` | Renders **Intelligence** button, configuration modal, loading states and injects AI result into the rich-text editor. |
| API (App Router) | `POST /api/ai/generate-email` | Authenticates request → aggregates campaign context → calls Mistral → stores draft → returns content. |
| Service | `generateEmailContent` (lib/ai/mistral.ts) | Constructs prompt, invokes `/v1/chat/completions`, post-processes response. |
| Context Aggregator | `getCampaignContext` (lib/ai/campaign-context.ts) | Pulls all prior steps (email/call/wait) + metadata for prompt. |
| Persistence | Prisma `AiEmailDraft` model | Saves every generation event (content, tone, mode, user). |
| Config | Env var `MISTRAL_API_KEY` | Supplies secret to server-side calls. |

Sequence diagram:

User → Email Editor (click) → IntelligenceModal → /api/ai/generate-email → getCampaignContext → generateEmailContent (Mistral) → DB:AiEmailDraft → Response → Editor injects text.

---

## 3. Key Files

| Path | Role |
|------|------|
| `apps/web/src/components/sequences/editor/sequence-email-editor.tsx` | Adds **Intelligence** button & handles content injection / regenerate. |
| `apps/web/src/components/sequences/editor/intelligence-modal.tsx` | Modal UI for mode, prompt & tone selection. |
| `apps/web/src/app/api/ai/generate-email/route.ts` | Auth-protected endpoint performing generation pipeline. |
| `apps/web/src/lib/ai/mistral.ts` | Generic Mistral wrapper **+** `generateEmailContent`. |
| `apps/web/src/lib/ai/campaign-context.ts` | Utility for campaign context aggregation, step lookup helpers. |
| `packages/database/prisma/schema.prisma` | Contains new `AiEmailDraft` model. |
| `apps/web/env/.env.example` | Shows required `MISTRAL_API_KEY` variable. |

---

## 4. API Endpoint Specification

### `POST /api/ai/generate-email`

#### Headers  
`Authorization: Bearer <supabase-session-cookie handled by auth()>`  
`Content-Type: application/json`

#### Request Body
```json
{
  "campaignId": "seq_123",
  "stepId": "step_456",
  "mode": "single",          // or "sequence"
  "userPrompt": "Optional guidance",
  "tone": "persuasive"       // "casual" | "professional" | "persuasive" | "informative" | "humor"
}
```

#### Success ‑ 200
```json
{
  "content": "string | string[]",   // email body or array for sequence
  "draftId": "draft_cuid"
}
```

#### Failure codes
* 401 – unauthenticated
* 403/404 – sequence or step not owned by user
* 500 – upstream / Mistral / DB failure

---

## 5. Environment Variables & Configuration

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | **Required in prod**. Server-side secret used by `lib/ai/mistral.ts`. |
| `OPENAI_API_KEY`  | Optional fallback if Mistral key absent (not mandatory). |

_Development_: fallback key exists in code but **must not** be deployed.

---

## 6. Database Schema Additions

```prisma
model AiEmailDraft {
  id         String   @id @default(cuid())
  campaignId String
  stepId     String
  userId     String
  content    String   @db.Text
  tone       String?
  mode       String   // 'single' | 'sequence'
  createdAt  DateTime @default(now())

  campaign Sequence     @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  step     SequenceStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  user     User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([campaignId])
  @@index([stepId])
  @@index([userId])
}
```

Run `npx prisma migrate dev --name add_ai_email_draft` (DATABASE_URL must be set).

---

## 7. Common Error Scenarios & Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 Unauthorized | Supabase session expired | Re-login, ensure cookies forwarded in tests. |
| 403/404 Sequence not found | Campaign not owned by user or wrong IDs | Validate IDs; check user access. |
| 500 “MISTRAL_API_KEY not configured” | Env var missing in server runtime | Set `MISTRAL_API_KEY` or provide OPENAI fallback. |
| Empty/garbled AI content | Mistral moderation or bad prompt | Retry with different prompt; inspect logs for `response.choices`. |
| Modal freezes on generate | API returns non-200 | Check browser dev-tools; server log for stack trace. |

---

## 8. Testing Scenarios & Expected Behaviour

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Single email generation** | Open editor → Intelligence → mode=single → Generate | Spinner shows, email body replaced with generated copy, toast “AI generated content applied”. |
| **Full sequence generation** | Same but mode=sequence | First generated email inserted into current step; (TODO) remainder applied to next empty steps. |
| **Re-generate** | After first generation → Intelligence → Regenerate | Content replaced with new variant, existing draft updated. |
| **Tone variations** | Use each tone option | Output style reflects tone (subjective QA). |
| **No previous steps** | Campaign with 0 prior steps | AI still returns sensible opener. |
| **Long sequences** | 10+ existing steps | Prompt includes truncated history (<150 chars each) and still succeeds. |
| **Rate limit / API failure** | Temporarily unset `MISTRAL_API_KEY` | Endpoint returns 500, UI toast shows error, editor unchanged. |

Automated tests can hit the endpoint with jest/supertest using mocked `generateEmailContent`.

---

## 9. Edge Cases

* **HTML Injection** – Generated text is injected as raw HTML; rich-text editor sanitises basic tags but QA for malicious links.
* **Sequence Mode with Fewer Empty Steps** – If AI returns > available empty email steps, extras are ignored (logged).
* **Fallback to OpenAI** – If `MISTRAL_API_KEY` absent but `OPENAI_API_KEY` present, system silently switches (ensure both not null in prod).
* **Large Prompt Size** – Very long previous steps auto-truncate to first 150 chars each to stay within token limits.
* **Humor Tone Misuse** – Humor requests are validated only by user; moderation from Mistral may block offensive outputs.
* **Concurrent Regenerations** – Multiple rapid clicks queue fetches; UI disables button while `isGeneratingContent` true.

---

**Maintainer Contact:** `@markvalles` on Slack.  
**Last updated:** 2025-06-23
