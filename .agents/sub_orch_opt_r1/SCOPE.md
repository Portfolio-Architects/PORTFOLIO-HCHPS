# Scope: Milestone 2 - Initial Page Loading and Splash Loading Optimization (R1)

## Architecture
- **View (UI)**:
  - `src/app/page.tsx`: Contains the splash screen timer and preloading logic.
  - Skeletons: Dynamic imports of `PortfolioDashboardView`, `MindMap3D`, `WorkspaceView`, `LawSystemPage`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | splash_optimization | Shorten splash timer in `src/app/page.tsx` from 1.8s to 1s | None | PLANNED |
| 2 | skeleton_standardization | Implement custom SVG skeleton loaders for dynamic imports | splash_optimization | PLANNED |
| 3 | verification | Verify that `npm run build` and `npm run lint` succeed | skeleton_standardization | PLANNED |

## Interface Contracts
- Splash timer duration: 1000ms.
- Skeletons must prevent CLS (Cumulative Layout Shift) by matching component bounds.
