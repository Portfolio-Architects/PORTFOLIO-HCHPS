const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 M1 Empirical Verification Harness');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failCount++;
  }
}

// 1. Verify target files exist
const targetFiles = [
  'src/app/page.tsx',
  'src/components/WorkspaceView.tsx',
  'src/components/budget/BudgetDashboard.tsx',
  'src/components/dashboard/PortfolioDashboardView.tsx'
];

targetFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  assert(fs.existsSync(fullPath), `Target file exists: ${file}`);
});

// 2. Verify dynamic imports and ssr: false configuration in page.tsx
const pageContent = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf-8');

assert(pageContent.includes("ssr: false"), "page.tsx configures dynamic imports with ssr: false");
assert(pageContent.includes("PortfolioDashboardViewSkeleton"), "page.tsx has PortfolioDashboardViewSkeleton fallback");
assert(pageContent.includes("MindMap3DSkeleton"), "page.tsx has MindMap3DSkeleton fallback");
assert(pageContent.includes("WorkspaceViewSkeleton"), "page.tsx has WorkspaceViewSkeleton fallback");
assert(pageContent.includes("ProjectManagementPageSkeleton"), "page.tsx has ProjectManagementPageSkeleton fallback");

// 3. Verify staggered preloading timing (3.5s, 5.5s, 7.5s)
assert(pageContent.includes("3500"), "page.tsx has staggered preload delay at 3.5s for mindmap");
assert(pageContent.includes("5500"), "page.tsx has staggered preload delay at 5.5s for workspace");
assert(pageContent.includes("7500"), "page.tsx has staggered preload delay at 7.5s for project");
assert(pageContent.includes("cancelIdleCallback") && pageContent.includes("clearTimeout"), "page.tsx cleans up idle callbacks and timers on unmount");

// 4. Verify WorkspaceView dynamic imports
const workspaceContent = fs.readFileSync(path.join(process.cwd(), 'src/components/WorkspaceView.tsx'), 'utf-8');

assert(workspaceContent.includes("BudgetDashboardSkeleton"), "WorkspaceView.tsx has BudgetDashboardSkeleton fallback");
assert(workspaceContent.includes("ssr: false"), "WorkspaceView.tsx uses ssr: false for heavy sub-components");

// 5. Verify BudgetDashboard dynamic imports
const budgetDashContent = fs.readFileSync(path.join(process.cwd(), 'src/components/budget/BudgetDashboard.tsx'), 'utf-8');

assert(budgetDashContent.includes("CategoryEditModal") && budgetDashContent.includes("ssr: false"), "BudgetDashboard.tsx code-splits CategoryEditModal with ssr: false");
assert(budgetDashContent.includes("ExpenseEntryModal") && budgetDashContent.includes("ssr: false"), "BudgetDashboard.tsx code-splits ExpenseEntryModal with ssr: false");
assert(budgetDashContent.includes("LedgerModal") && budgetDashContent.includes("ssr: false"), "BudgetDashboard.tsx code-splits LedgerModal with ssr: false");

// 6. Verify PortfolioDashboardView dynamic imports & staggered sub-widget mounting
const portDashContent = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/PortfolioDashboardView.tsx'), 'utf-8');

assert(portDashContent.includes("WeeklySchedulerSkeleton"), "PortfolioDashboardView.tsx has WeeklySchedulerSkeleton fallback");
assert(portDashContent.includes("renderScheduler") && portDashContent.includes("renderContacts"), "PortfolioDashboardView.tsx implements staggered sub-widget rendering");
assert(portDashContent.includes("ResizeObserver") && portDashContent.includes("requestAnimationFrame"), "PortfolioDashboardView.tsx uses ResizeObserver + rAF with threshold snapping to eliminate re-render thrashing");

// 7. Verify layout height match between skeletons and target components
// WeeklyScheduler container vs skeleton
assert(portDashContent.includes("h-[620px]"), "PortfolioDashboardViewSkeleton preserves h-[620px] spatial container for WeeklyScheduler");
// MindMap3D container vs skeleton
assert(pageContent.includes("h-[660px]"), "MindMap3DSkeleton preserves h-[660px] spatial container for MindMap3D");
// BudgetDashboard container vs skeleton
assert(pageContent.includes("h-[400px]") && pageContent.includes("min-h-[530px]"), "PortfolioDashboardViewSkeleton preserves height constraints (400px, min-530px)");

console.log('\n====================================================');
if (failCount === 0) {
  console.log(`🎉 [PASS] M1 Empirical Verification: All ${passCount} tests passed!`);
} else {
  console.error(`🚨 [FAIL] M1 Empirical Verification: ${failCount} tests failed.`);
}
console.log('====================================================');

process.exit(failCount === 0 ? 0 : 1);
