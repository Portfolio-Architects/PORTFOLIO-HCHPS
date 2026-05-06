# HCHPS Work & Wealth Architecture - AI Agents Manifest (AGENTS.md)

## 1. System Ontology (M-V-C)
This repository strictly follows a modified Feature-Sliced Design (FSD) mixed with MVC ontology:
- **Models (Storage)**: `functions/api/data.ts` (Cloudflare KV) is the Single Source of Truth (SSOT). `localStorage` acts only as a volatile offline cache and is never the primary data source.
- **Views (UI)**: `src/components/dashboard` and feature-specific components. Strict TailwindCSS styling.
- **Controllers (Hooks)**: Data fetching and mutation must ONLY happen via React Query inside `src/hooks/` (e.g., `useTasks`, `useBudget`). Direct API calls in components are strictly prohibited.

## 2. Rules of Engagement for AI Agents

### A. Data Immutability & Encryption
1. **Never bypass E2EE**: All payloads must be encrypted before hitting the network. Do not disable or circumvent `encryptPayload` / `decryptPayload` in `src/lib/crypto.ts`.
2. **Zombie Data Prevention (Tombstones)**: Cloudflare KV is eventually consistent. When deleting items, you MUST utilize the global tombstone array (`hchps-global-tombstones` in localStorage) to prevent deleted data from resurrecting on subsequent fetches.

### B. Loud Failures (Fail-Safe Mechanism)
If you attempt to mutate code and cause a Zod schema validation error, the system will now yell at you (`[HARNESS ZOD ERROR]`). 
- Do not suppress these errors.
- Read the error payload to understand exactly which field (path) failed the type expectation.
- Always provide fallback defaults `.catch()` in `schemas.ts` for backward compatibility, but fix the underlying data generation logic.

### C. Network & CORS Boundaries
The Cloudflare backend (`functions/api/*.ts`) strictly enforces CORS.
Allowed Origins:
- `https://portfolio-hchps.pages.dev`
- `https://portfolio-architects.github.io`
- `http://localhost:3001`
Never change localhost port from `3001` without updating these headers.

## 3. Multi-Agent Pipeline Map
- `src/lib/agents/planner.ts`: Task decomposition and context retrieval.
- `src/lib/agents/generator.ts`: Execution and code synthesis.
- `src/lib/agents/evaluator.ts`: Zod schema and TypeScript validation feedback loop.
