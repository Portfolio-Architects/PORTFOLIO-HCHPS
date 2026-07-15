# Handoff Report: RSI & Self-Evolution Environment Analysis

## 1. Observation
We have inspected the existing project structure and key scripts under the `scripts/` directory:
- **`scripts/diagnose-targets.js`**:
  - Checks codebase diagnostics for three categories of issues: Lint Warnings (`eslint`), Architectural Violations (MVC ONTOLOGY checks), and Performance Bottlenecks.
  - Line 26 executes: `execSync('npx eslint --format json src', ...)`
  - Lines 77-113 check for direct `fetch`/`axios` calls inside UI components under `src/components`.
  - Lines 125-137 search for state mutations inside `useEffect` with empty dependency arrays.
  - Lines 139-164 scan for nested loops (e.g. `.find()`, `.filter()`, `.some()` inside `.map()`, `.forEach()`, etc.) causing $O(N^2)$ time complexity. It ignores loops that match whitelist variables: `entriesByCatId`, `liveNodesMap`, `executedNoIssuanceByCatId`, and `entriesByCatMap`.
  - Lines 167-178 search for `console.warn` or `console.error` calls in `src/components/` (excluding commented-out lines).
  - Lines 181-193 check for static imports of heavy components (`MindMap3D`, `WeeklyScheduler`, `InventoryList`, `BlockNote`) inside files with `page.tsx` or `dashboard` in their path.
  - Line 206 writes the output json: `fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');` targeting `data/diagnose_report.json`.

- **`scripts/run-harness.js`**:
  - Serves as the gatekeeper for database integrity and code validation.
  - Lines 10-122 define Zod schemas (`TaskSchema`, `BudgetCategorySchema`, `BudgetEntrySchema`, `ProjectSchema`) and validate database integrity for JSON files in `data/`.
  - Lines 192-211 run code linters and typescript checks via `npm run lint`. If validation fails, it triggers auto-fixing: `execSync('npx eslint --fix .', { stdio: 'inherit' });`, then verifies it.
  - Lines 218-223 execute milestone syncing: `node scripts/sync-rules.js`.
  - Lines 231-238 execute codebase diagnostics: `node scripts/diagnose-targets.js`.
  - Exits with `0` (pass) or `1` (fail) based on `failedCount === 0`.

- **Directory Structure**:
  - `src/app/`: Contains Next.js app routes, including the main page `src/app/page.tsx`.
  - `src/components/`: Stores UI widgets and dashboards (e.g. `src/components/MindMap3D.tsx`, `src/components/dashboard/WeeklyScheduler.tsx`).
  - `src/hooks/`: Houses custom state controller hooks (e.g., `useTasks.ts`, `useBudget.ts`, `useSignal.ts`).
  - `data/`: Single source of truth containing JSON databases (e.g. `TASKS.json`, `BUDGET_CATEGORIES.json`) and `diagnose_report.json`.
  - `scripts/`: Holds diagnostic, synchronization, and recovery utility scripts.

---

## 2. Logic Chain
We map our observations to the design of a self-contained automatic refactoring script, `scripts/self-evolution.js`:

### 2.1. Refactoring $O(N^2)$ Render Loops to $O(1)$
- **Observation**: Loops mapped with `.map()` containing nested search methods (`.find()`, `.filter()`, `.some()`) trigger warning status in `diagnose-targets.js`.
- **Refactoring Chain**:
  1. **Locate Target**: Locate pattern where an array map variable maps over elements, e.g. `items.map(item => ... searchArr.find(s => s.id === item.searchId) ... )`.
  2. **Regex Strategy**: Use regex to locate loop expressions:
     ```javascript
     const loopRegex = /(\w+)\.(map|forEach|filter|reduce)\s*\(\s*(?:\((\w+)(?:,\s*\w+)*\)|\w+)\s*=>\s*\{?([\s\S]*?)(?:\}\s*\)|,\s*|\)\s*;?)/g;
     ```
  3. **Brace Matching**: For multiline loops, extract the exact body using a brace-counting parser starting at `{` following the arrow.
  4. **Inner Search Matching**: Within the body, identify lookup lines:
     ```javascript
     const findRegex = /(\w+)\.(find|filter|some)\s*\(\s*(\w+)\s*=>\s*\3\.id\s*===\s*(\w+)\.(\w+)\s*\)/;
     ```
     This matches: `projects.find(p => p.id === task.projectId)`.
  5. **Code Rewrite**:
     - Extract collection name (`projects`), inner iterator variable (`p`), target variable (`task`), and foreign key (`projectId`).
     - Define a Map instantiation block:
       ```javascript
       const projectsMap = useMemo(() => new Map(projects.map(item => [item.id, item])), [projects]);
       ```
     - Replace the inner find loop expression with: `projectsMap.get(task.projectId)`.
     - To insert the `useMemo` statement safely, we trace the file content to find the start of the React component render body (usually following `const ComponentName = ... => {` or `function ComponentName() {`) and place it right after initial hooks or directly above the return block containing the loop.

### 2.2. Resolving Console Spam (`console.warn`/`console.error`)
- **Observation**: UI components in `src/components/` must not contain plain console messages.
- **Refactoring Chain**:
  1. **Identify Files**: Scan all files under `src/components/` matching `*.tsx` or `*.ts`.
  2. **Scan Console Calls**: Traverse characters to locate `console.warn` or `console.error` that are not already commented out.
  3. **Brace Tracking Parser**: Start at `console.(warn|error)` and trace opening `(` and closing `)` parens, taking care of nested function calls:
     ```javascript
     function commentOutConsole(content) {
       let pos = 0;
       while (true) {
         const warnIdx = content.indexOf('console.warn', pos);
         const errIdx = content.indexOf('console.error', pos);
         const idx = warnIdx !== -1 && errIdx !== -1 ? Math.min(warnIdx, errIdx) : (warnIdx !== -1 ? warnIdx : errIdx);
         if (idx === -1) break;
         
         // Verify it isn't inside comments
         const lineStart = content.lastIndexOf('\n', idx) + 1;
         const preceding = content.substring(lineStart, idx).trim();
         if (preceding.startsWith('//') || preceding.startsWith('*') || preceding.startsWith('/*')) {
           pos = idx + 12;
           continue;
         }

         let openParen = content.indexOf('(', idx);
         let parenCount = 1;
         let endIdx = openParen + 1;
         while (parenCount > 0 && endIdx < content.length) {
           if (content[endIdx] === '(') parenCount++;
           else if (content[endIdx] === ')') parenCount--;
           endIdx++;
         }
         if (content[endIdx] === ';') endIdx++;
         
         const statement = content.substring(idx, endIdx);
         const commented = `/* ${statement} */`;
         content = content.substring(0, idx) + commented + content.substring(endIdx);
         pos = idx + commented.length;
       }
       return content;
     }
     ```
  4. This eliminates component console warning/error spam without altering other application logic.

### 2.3. Converting Heavy Static Imports to Dynamic Imports
- **Observation**: Heavy components like `MindMap3D`, `WeeklyScheduler`, `InventoryList`, or `BlockNote` in pages/dashboards trigger warnings if statically imported.
- **Refactoring Chain**:
  1. **Identify Import Statement**: Use regex to locate static imports of the target components:
     ```javascript
     const staticImportRegex = /import\s+(?:(\w+)|{\s*(\w+)\s*})\s+from\s+['"]([^'"]*(?:MindMap3D|WeeklyScheduler|InventoryList|BlockNote))['"]\s*;?/g;
     ```
  2. **Categorize and Substitute**:
     - If Named Import (e.g. `import { WeeklyScheduler } from './WeeklyScheduler'`):
       Replace with:
       ```javascript
       const WeeklyScheduler = dynamic(() => import('./WeeklyScheduler').then(mod => mod.WeeklyScheduler), { ssr: false });
       ```
     - If Default Import (e.g. `import MindMap3D from './MindMap3D'`):
       Replace with:
       ```javascript
       const MindMap3D = dynamic(() => import('./MindMap3D'), { ssr: false });
       ```
  3. **Check for `dynamic` Import Utility**:
     Ensure `import dynamic from 'next/dynamic';` exists in the target file. If missing, insert it right after the `'use client';` directive or at the top of the imports block.

---

## 3. Caveats
1. **Scope/Context Blindness in Regex**: Regular expressions can match strings inside block comments or template literals. Heuristics (like checking preceding text for `//` or `/*`) are used, but complex multi-line comment structures can still trigger false positives.
2. **Typescript Variable Binding**: In dynamic imports, named exports must match exactly. If the name is alias-imported (e.g. `import { MindMap3D as MM3D }`), the regex needs to capture the alias name and transform it correctly.
3. **Complex Conditions in Loops**: Lookups that use complex filters (e.g. `projects.find(p => p.id === task.projectId && p.active)`) cannot be converted into a simple `Map.get(id)` without adjusting the key to include multiple conditions or filter criteria.
4. **AST Refinement Recommended**: For absolute safety, standard text-replacement regexes should be combined with or backed up by TypeScript Compiler API parsing when rewriting components to avoid introducing compile-time syntax errors.

---

## 4. Conclusion & Recommendations
We recommend creating `scripts/self-evolution.js` with the following structure:
- **File Scanner**: Traverses `src/**/*.tsx` and `src/**/*.ts`.
- **Refactoring Runner**: Applies the replacement procedures for the three identified issues sequentially.
- **Self-Healing Loop**:
  - The script keeps a copy of the file content before starting.
  - It attempts to apply a refactor change.
  - It runs `node scripts/run-harness.js` to execute linting, TypeScript type-checking (`tsc`), and Zod validation.
  - If harness returns exit code `0`, it saves changes, adds them to git staging, commits with `git commit -m "[auto] self-evolution: refactor component"`, and pushes.
  - If the harness fails (exit code `1`), it reverts the files (`git checkout -- <filepath>` or rewriting original content), increments a retry counter, and logs the failure.
  - It tries alternate templates/refactoring methods if applicable, up to a limit of **3 retries**.
  - If it fails 3 times, it enters **Fallback mode**: skips the file, restores it to its original safe state, and logs the issue to `diagnose_report.json` so the build doesn't crash.

---

## 5. Verification Method
To verify that the self-evolution script behaves correctly:
1. Run codebase diagnostics to populate initial reports:
   ```powershell
   node scripts/diagnose-targets.js
   ```
2. Run the self-evolution runner (once implemented):
   ```powershell
   node scripts/self-evolution.js
   ```
3. The self-evolution script will call `node scripts/run-harness.js` internally.
4. Verify changes in Git history by running:
   ```powershell
   git log -n 5
   ```
5. Check if the files reverted correctly in case of a simulated harness failure by observing clean `git status`.
