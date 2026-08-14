# Project: Reform 3D Mind Map into Detective Board Festival Event Tracking & Verification System

## Architecture
- **Ontology & Pattern**: Modified FSD with MVC separation.
- **Model (Storage & CRDT)**: `src/app/api/data/route.ts` (`data/*.json` SSOT), Yjs CRDT store (`globalYDoc` in `useYjsStore.ts`), `useGraphCustomization.ts`, `data/MAP_CUSTOMIZATION.json`.
- **View (UI & Canvas)**: `src/components/MindMap3D.tsx`, `src/lib/engine/OntologyRenderer.ts`, `src/lib/engine/OntologyLayout.ts`, `src/lib/OntologyCanvasEngine.ts`, `src/components/MindMapInspector.tsx`, `src/components/mindmap/ui/MindMapHUD.tsx`, `src/components/mindmap/ui/DetectiveValidationHUD.tsx` (NEW).
- **Controller (Hooks)**: `src/hooks/useGraphCustomization.ts`, `src/hooks/useFestivalValidation.ts` (NEW), `src/hooks/useBudgetSimulator.ts`, `src/hooks/useBudget.ts`, `src/hooks/useTasks.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Corkboard Canvas Texture & Frame | Render corkboard texture background, dark wooden border frame, and warm dossier layer sections in 3D canvas | M1 | survey (R1) |
| 2 | Post-It Evidence Cards & Push Pins | Render rectangular Post-it note nodes with procedural tilt (-5°~+5°), paper drop shadows, dog-eared corners, and 3D push pin heads | M1 | survey (R1) |
| 3 | Catenary Sagging Crimson Red Strings | Render thick crimson red yarn edges (#d62828) connecting push pin heads with gravity sag quadratic curves | M1 | survey (R1) |
| 4 | Investigator Verification Status Badges | Support 4 statuses (uncompleted, in-progress, verified, risk-warning) with rubber ink stamps, hazard tape strips, and Yjs CRDT inspector controls | M1 | survey (R1) |
| 5 | Festival 5-Domain Preset Dataset | Define 50-70M KRW Festival template schema (5 domain hubs, 25-30 sub-nodes, edges, 60M KRW budget entries) in `festival5DomainPreset.ts` | M2 | survey (R2) |
| 6 | 1-Click Preset Loading Pipeline | Preset loading trigger in HUD/Header populating Yjs store (`customNodesMap`, `customEdgesMap`, `overrides`) and budget simulator | M2 | survey (R2) |
| 7 | Symmetrical 3D Domain Auto-Layout | Radial pentagonal domain hub positioning (R=280px) and outward sector sub-node clustering (R=110px) in `OntologyLayout.ts` | M2 | survey (R2) |
| 8 | Essential Safety & Permit Auto-Warning Guard | Real-time regex validation for 4 essential items (지자체 신고, 경찰 도로점용, 소방 안전점검, 안전관리계획서) assigning status MISSING/INCOMPLETE/VERIFIED | M3 | survey (R3) |
| 9 | 50-70M KRW Budget & Scale Validator | Real-time validation for 50-70M KRW budget scale bounds, category budget overruns, spend ratios, and unentered domain budgets | M3 | survey (R3) |
| 10 | Detective Validation HUD & Risk Aura | Floating canvas HUD (`DetectiveValidationHUD.tsx`), node crimson risk aura (#FF0044), and risk warning badge overlay | M3 | survey (R3) |
| 11 | Harness & Rules Sync Verification | `npx tsc --noEmit` (0 errors), `node scripts/run-harness.js` (0 errors, 0 lint warnings, 0 violations), `node scripts/sync-rules.js` | M4 | survey (Acceptance) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Corkboard & Red String 3D UI Reform | Corkboard texture, wooden frame, Post-it cards, push pins, red string sag, verification status stamps & badges | None | DONE |
| M2 | Festival 5-Domain Presets & 3D Auto-Layout | 5-domain festival preset data, 1-Click loading pipeline, 3D domain clustering math | M1 | DONE |
| M3 | Zero-Mistake Real-Time Validation & Alert Engine | Safety/permit auto-warning guard, 50-70M KRW budget scale validator, Detective Validation HUD, node risk aura | M1, M2 | DONE |
| M4 | Final Integration & Gatekeeper Harness Verification | Full system integration, `npx tsc --noEmit` check, `run-harness.js` validation, `sync-rules.js` execution | M1, M2, M3 | DONE |

## Interface Contracts & Types

### 1. VerificationStatus & Node Metadata Extensions
```typescript
// src/lib/ontology.types.ts
export type VerificationStatus = 'uncompleted' | 'in-progress' | 'verified' | 'risk-warning';

export interface OntologyNode {
  // ... existing fields
  verificationStatus?: VerificationStatus;
}
```

### 2. NodeOverride & Zod Schema Extensions
```typescript
// src/hooks/useGraphCustomization.ts
export interface NodeOverride {
  // ... existing fields
  verificationStatus?: VerificationStatus | null;
}

// src/lib/schemas.ts
export const VerificationStatusSchema = z.enum([
  'uncompleted',
  'in-progress',
  'verified',
  'risk-warning'
]).catch('uncompleted');
```

### 3. Festival 5-Domain Preset Schema
```typescript
// src/lib/presets/festival5DomainPreset.ts
export interface FestivalDomain {
  id: string;
  label: string;
  group: OntologyGroup;
  color: string;
  worldX: number;
  worldY: number;
  children: Array<{
    id: string;
    label: string;
    budget?: number;
    permitKey?: 'municipal_report' | 'police_road' | 'fire_safety' | 'safety_plan';
  }>;
}
```

### 4. Festival Real-Time Validation Engine Schema
```typescript
// src/hooks/useFestivalValidation.ts
export interface EssentialPermitStatus {
  key: 'municipal_report' | 'police_road' | 'fire_safety' | 'safety_plan';
  label: string;
  status: 'MISSING' | 'INCOMPLETE' | 'VERIFIED';
  taskId?: string;
  nodeId?: string;
}

export interface BudgetValidationReport {
  scaleStatus: 'UNDER_SCALE' | 'IN_SCALE' | 'OVER_SCALE';
  targetScaleMin: number; // 50,000,000 KRW
  targetScaleMax: number; // 70,000,000 KRW
  totalAllocated: number;
  totalSpent: number;
  spendRatio: number;
  overrunCategories: string[];
  unenteredDomains: string[];
}

export interface FestivalValidationReport {
  permits: EssentialPermitStatus[];
  budgetValidation: BudgetValidationReport;
  riskNodesMap: Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>;
  overallRiskLevel: 'CRITICAL' | 'WARNING' | 'SAFE';
}
```

## Code Layout
- `src/lib/presets/festival5DomainPreset.ts` — 50-70M KRW Festival 5-Domain Preset data
- `src/hooks/useFestivalValidation.ts` — Zero-Mistake real-time validation hook
- `src/components/mindmap/ui/DetectiveValidationHUD.tsx` — Canvas HUD alert banner overlay
- `src/lib/ontology.types.ts` — Extended `VerificationStatus` & `OntologyNode`
- `src/lib/schemas.ts` — Zod schemas & `.catch()` fallbacks
- `src/hooks/useGraphCustomization.ts` — Yjs preset loading pipeline & node override types
- `src/lib/engine/OntologyRenderer.ts` — Corkboard texture, Post-its, push pins, red string sag, status stamps
- `src/lib/engine/OntologyLayout.ts` — Pentagonal domain hub layout & outward sector clustering
- `src/lib/OntologyCanvasEngine.ts` — Rectangular Post-it card hit testing
- `src/components/MindMap3D.tsx` — Canvas wrapper, wooden frame border, HUD overlay
- `src/components/MindMapInspector.tsx` — Investigator status selector UI
