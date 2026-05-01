export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
}

export interface FeedRow {
  id: string;
  kind: string;
  who: string;
  verb: string;
  obj: string;
  detail: string;
  ago: string;
  badges?: { t: string; c: string }[];
  by?: string;
  fresh?: boolean;
}

export interface Session {
  id: string;
  who: string;
  status: string;
  task: string;
  file: string;
  bundle: string;
  progress: number;
  tokens: number;
  cap: number;
  saved: number;
  ago: string;
}

export interface Skill {
  id: string;
  name: string;
  desc: string;
  author: string;
  uses: number;
  ver: string;
  official: boolean;
  fresh?: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  hot?: boolean;
  files: number;
  bundle: string;
  decisions?: number;
}

export interface FileNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
}

export interface FileDetail {
  path: string;
  summary: string;
  renders: string[];
  hooks: string[];
  libs: string[];
  navTo: { to: string; label: string }[];
  lines: number;
  owner: string;
  lastChange: string;
  changedBy: string;
  decisions: string[];
  tests: string[];
  notes?: string;
  usedBy?: string[];
}

export interface ModuleDetail {
  files: FileNode[];
  edges: [string, string][];
}

export const PEOPLE: Person[] = [
  { id: "santi", name: "Santi", initials: "SA", color: "#c98b5b", role: "Founder" },
  { id: "ana", name: "Ana Reyes", initials: "AR", color: "#6b8af0", role: "Tech Lead" },
  { id: "marc", name: "Marc Oliveira", initials: "MO", color: "#f06b9b", role: "Senior Dev" },
  { id: "kei", name: "Kei Tanaka", initials: "KT", color: "#6bf0c8", role: "Backend" },
  { id: "ines", name: "Ines Vargas", initials: "IV", color: "#f0c46b", role: "Frontend" },
];

export const personById = (id: string) => PEOPLE.find((p) => p.id === id);

export const FEED_SEED: FeedRow[] = [
  {
    id: "f1", kind: "claude", who: "claude",
    verb: "llamo", obj: "get_context(\"login\")",
    detail: "Bundle servido desde cache · 4.8K tokens vs 62K leyendo archivos directos · 92% reduccion",
    ago: "ahora",
    badges: [{ t: "-57.2k tokens", c: "accent" }, { t: "MCP context", c: "pink" }],
    by: "marc",
  },
  {
    id: "f2", kind: "warn", who: "claude",
    verb: "previno reescribir", obj: "formatTenantId()",
    detail: "Ya existe en packages/shared/tenant.ts:18. Decision-012 dice usar la del shared.",
    ago: "2m",
    badges: [{ t: "duplicacion evitada", c: "yellow" }, { t: "-3.1k tokens", c: "accent" }],
    by: "ines",
  },
  {
    id: "f3", kind: "doc", who: "claude",
    verb: "regenero ERD de", obj: "module: billing",
    detail: "3 tablas modificadas en migration 0084. Mermaid actualizado.",
    ago: "6m",
    badges: [{ t: "auto-doc", c: "blue" }, { t: "GitHub Action", c: "" }],
  },
  {
    id: "f4", kind: "decision", who: "ana",
    verb: "fijo decision", obj: "decision-014: no JWT en cookies httpOnly",
    detail: "Bundle de \"auth\" la incluye desde ahora. Proximas sesiones de Claude la veran.",
    ago: "14m",
    badges: [{ t: "pinned", c: "violet" }, { t: "auth", c: "" }],
  },
  {
    id: "f5", kind: "skill", who: "kei",
    verb: "publico skill", obj: "dguard-migrations",
    detail: "Template de migrations + naming + rollback. Disponible en marketplace interno.",
    ago: "31m",
    badges: [{ t: "skill v1.0", c: "green" }, { t: "marketplace", c: "" }],
  },
  {
    id: "f6", kind: "claude", who: "claude",
    verb: "leyo bundle de", obj: "module: tenant-isolation",
    detail: "5.2K tokens · incluye 3 decisiones, ERD, recent_changes, 2 skills relacionados.",
    ago: "44m",
    badges: [{ t: "-71k tokens", c: "accent" }],
    by: "santi",
  },
];

export const FEED_TICKER: FeedRow[] = [
  {
    id: "t1", kind: "claude", who: "claude",
    verb: "llamo", obj: "get_context(\"checkout\")",
    detail: "Servido en 84ms · 6.1K tokens",
    ago: "ahora",
    badges: [{ t: "-48k tokens", c: "accent" }],
    by: "marc",
  },
  {
    id: "t2", kind: "skill", who: "claude",
    verb: "ejecuto skill", obj: "dep-guardian",
    detail: "Detecto @stripe/react-stripe-js en candidatos. Bloqueado: decision-009 lo prohibe.",
    ago: "ahora",
    badges: [{ t: "skill", c: "green" }],
    by: "marc",
  },
  {
    id: "t3", kind: "decision", who: "santi",
    verb: "linkeo", obj: "decision-015 -> modulo cache",
    detail: "Proximas sesiones que toquen cache veran: \"no Redis multi-tenant en mismo namespace\"",
    ago: "ahora",
    badges: [{ t: "pinned", c: "violet" }],
  },
  {
    id: "t4", kind: "doc", who: "claude",
    verb: "actualizo", obj: "ARCHITECTURE.md",
    detail: "Seccion \"event-bus\" reescrita tras 4 commits",
    ago: "ahora",
    badges: [{ t: "auto-doc", c: "blue" }],
  },
  {
    id: "t5", kind: "claude", who: "claude",
    verb: "busco implementacion previa de", obj: "useTenantSession",
    detail: "Encontrada en packages/shared/auth/useTenantSession.ts · no regenero",
    ago: "ahora",
    badges: [{ t: "-2.4k tokens", c: "accent" }],
    by: "ines",
  },
];

export const SESSIONS: Session[] = [
  {
    id: "s1", who: "marc", status: "live",
    task: "Implementar checkout multi-tenant con Stripe Connect",
    file: "packages/billing/checkout/Flow.tsx",
    bundle: "checkout", progress: 62,
    tokens: 18200, cap: 80000, saved: 47800, ago: "8m 12s",
  },
  {
    id: "s2", who: "ines", status: "live",
    task: "Refactor onboarding paso 3 (seleccion de plan)",
    file: "packages/onboarding/StepBilling.tsx",
    bundle: "onboarding", progress: 24,
    tokens: 5210, cap: 80000, saved: 12400, ago: "2m 41s",
  },
  {
    id: "s3", who: "kei", status: "idle",
    task: "Estrategia de cache para DGuard tenants",
    file: "infra/cache/strategy.md",
    bundle: "cache", progress: 88,
    tokens: 23480, cap: 80000, saved: 38600, ago: "idle 14s",
  },
  {
    id: "s4", who: "ana", status: "done",
    task: "Review arquitectura modulo billing",
    file: "docs/arch/billing.md",
    bundle: "billing", progress: 100,
    tokens: 9440, cap: 80000, saved: 51200, ago: "hace 6m",
  },
];

export const NODES: MapNode[] = [
  { id: "web", name: "@dguard/web", kind: "frontend", x: 50, y: 10, hot: true, files: 184, bundle: "web" },
  { id: "ui", name: "@dguard/ui", kind: "shared", x: 18, y: 28, files: 142, bundle: "ui" },
  { id: "auth", name: "auth", kind: "shared", x: 82, y: 28, files: 38, bundle: "auth", decisions: 4 },
  { id: "checkout", name: "checkout", kind: "frontend", x: 32, y: 50, hot: true, files: 41, bundle: "checkout", decisions: 2 },
  { id: "onboarding", name: "onboarding", kind: "frontend", x: 68, y: 50, hot: true, files: 33, bundle: "onboarding" },
  { id: "billing", name: "billing-sdk", kind: "backend", x: 12, y: 72, files: 56, bundle: "billing", decisions: 3 },
  { id: "tenant", name: "tenant-isolation", kind: "backend", x: 50, y: 72, hot: true, files: 78, bundle: "tenant-isolation", decisions: 6 },
  { id: "events", name: "event-bus", kind: "infra", x: 88, y: 72, files: 18, bundle: "events" },
  { id: "tests", name: "e2e-tests", kind: "test", x: 50, y: 92, files: 67, bundle: "tests" },
];

export const EDGES: [string, string][] = [
  ["web", "ui"], ["web", "auth"], ["web", "checkout"], ["web", "onboarding"],
  ["checkout", "billing"], ["checkout", "tenant"], ["onboarding", "tenant"],
  ["onboarding", "auth"], ["billing", "tenant"], ["tenant", "events"],
  ["tests", "checkout"], ["tests", "onboarding"], ["tests", "tenant"],
  ["ui", "checkout"], ["ui", "onboarding"], ["auth", "tenant"],
];

export const MODULE_DETAILS: Record<string, ModuleDetail> = {
  web: {
    files: [
      { id: "App", name: "App.tsx", kind: "screen", x: 50, y: 14 },
      { id: "Router", name: "Router.tsx", kind: "screen", x: 22, y: 32 },
      { id: "Layout", name: "Layout.tsx", kind: "comp", x: 78, y: 32 },
      { id: "Dashboard", name: "screens/Dashboard.tsx", kind: "screen", x: 18, y: 60 },
      { id: "Tenants", name: "screens/Tenants.tsx", kind: "screen", x: 50, y: 60 },
      { id: "Settings", name: "screens/Settings.tsx", kind: "screen", x: 82, y: 60 },
      { id: "useAuth", name: "hooks/useAuth.ts", kind: "hook", x: 30, y: 86 },
      { id: "useTenant", name: "hooks/useTenant.ts", kind: "hook", x: 70, y: 86 },
    ],
    edges: [
      ["App", "Router"], ["App", "Layout"],
      ["Router", "Dashboard"], ["Router", "Tenants"], ["Router", "Settings"],
      ["Dashboard", "useTenant"], ["Tenants", "useTenant"], ["Settings", "useAuth"],
      ["Layout", "useAuth"],
    ],
  },
  checkout: {
    files: [
      { id: "Flow", name: "Flow.tsx", kind: "screen", x: 50, y: 14 },
      { id: "StepPlan", name: "steps/StepPlan.tsx", kind: "screen", x: 20, y: 38 },
      { id: "StepBilling", name: "steps/StepBilling.tsx", kind: "screen", x: 50, y: 38 },
      { id: "StepConfirm", name: "steps/StepConfirm.tsx", kind: "screen", x: 80, y: 38 },
      { id: "PaymentForm", name: "components/PaymentForm.tsx", kind: "comp", x: 50, y: 64 },
      { id: "useCheckout", name: "hooks/useCheckout.ts", kind: "hook", x: 30, y: 88 },
      { id: "stripeAdapter", name: "lib/stripeAdapter.ts", kind: "lib", x: 70, y: 88 },
    ],
    edges: [
      ["Flow", "StepPlan"], ["Flow", "StepBilling"], ["Flow", "StepConfirm"],
      ["StepBilling", "PaymentForm"],
      ["StepBilling", "useCheckout"], ["StepConfirm", "useCheckout"],
      ["useCheckout", "stripeAdapter"], ["PaymentForm", "stripeAdapter"],
    ],
  },
  auth: {
    files: [
      { id: "SessionProvider", name: "SessionProvider.tsx", kind: "comp", x: 50, y: 14 },
      { id: "useSession", name: "hooks/useSession.ts", kind: "hook", x: 25, y: 40 },
      { id: "useTenantSession", name: "hooks/useTenantSession.ts", kind: "hook", x: 75, y: 40 },
      { id: "LoginForm", name: "components/LoginForm.tsx", kind: "comp", x: 25, y: 68 },
      { id: "RequireAuth", name: "components/RequireAuth.tsx", kind: "comp", x: 75, y: 68 },
      { id: "authApi", name: "lib/authApi.ts", kind: "lib", x: 50, y: 90 },
    ],
    edges: [
      ["SessionProvider", "useSession"], ["SessionProvider", "useTenantSession"],
      ["LoginForm", "useSession"], ["RequireAuth", "useSession"],
      ["useSession", "authApi"], ["useTenantSession", "authApi"],
    ],
  },
  "tenant-isolation": {
    files: [
      { id: "tenant", name: "tenant.ts", kind: "lib", x: 50, y: 14 },
      { id: "rls", name: "rls.sql", kind: "schema", x: 22, y: 38 },
      { id: "mw", name: "middleware/tenantCtx.ts", kind: "lib", x: 50, y: 38 },
      { id: "policies", name: "policies/tenantAccess.ts", kind: "lib", x: 78, y: 38 },
      { id: "schemaT", name: "schema/tenants.sql", kind: "schema", x: 22, y: 68 },
      { id: "schemaU", name: "schema/users_tenants.sql", kind: "schema", x: 78, y: 68 },
      { id: "tests", name: "tests/isolation.test.ts", kind: "test", x: 50, y: 90 },
    ],
    edges: [
      ["tenant", "mw"], ["tenant", "policies"], ["mw", "schemaT"], ["mw", "schemaU"],
      ["policies", "rls"], ["rls", "schemaT"], ["rls", "schemaU"],
      ["tests", "tenant"], ["tests", "mw"], ["tests", "policies"],
    ],
  },
  billing: {
    files: [
      { id: "client", name: "client.ts", kind: "lib", x: 50, y: 14 },
      { id: "invoices", name: "invoices/handler.ts", kind: "lib", x: 25, y: 40 },
      { id: "subs", name: "subscriptions/handler.ts", kind: "lib", x: 75, y: 40 },
      { id: "stripe", name: "providers/stripe.ts", kind: "lib", x: 25, y: 68 },
      { id: "schemaInv", name: "schema/invoices.sql", kind: "schema", x: 75, y: 68 },
      { id: "billTests", name: "tests/billing.test.ts", kind: "test", x: 50, y: 90 },
    ],
    edges: [
      ["client", "invoices"], ["client", "subs"], ["invoices", "stripe"], ["subs", "stripe"],
      ["invoices", "schemaInv"], ["billTests", "invoices"], ["billTests", "subs"],
    ],
  },
};

export const FILE_DETAILS: Record<string, FileDetail> = {
  Dashboard: {
    path: "apps/web/src/screens/Dashboard.tsx",
    summary: "Pantalla principal · resumen del tenant activo",
    renders: ["KpiGrid", "RecentActivity", "TenantHeader"],
    hooks: ["useTenant", "useSession"],
    libs: ["api/dashboard.ts"],
    navTo: [{ to: "Tenants", label: "ver tenants" }, { to: "Onboard", label: "si tenant.isNew" }],
    lines: 184, owner: "ines", lastChange: "hace 2h", changedBy: "marc",
    decisions: ["decision-007: 1 sola peticion de KPIs por dashboard"],
    tests: ["dashboard.spec.tsx · 8 tests"],
    notes: "Carga KpiGrid en paralelo con TenantHeader.",
  },
  Flow: {
    path: "apps/web/src/checkout/Flow.tsx",
    summary: "Orquesta los 3 pasos del checkout",
    renders: ["StepPlan", "StepBilling", "StepConfirm"],
    hooks: ["useCheckout"],
    libs: [],
    navTo: [{ to: "Dashboard", label: "al completar" }],
    lines: 78, owner: "marc", lastChange: "hace 1d", changedBy: "marc",
    decisions: ["decision-011: checkout siempre 3 pasos · no skip"],
    tests: ["flow.spec.tsx · 6 tests"],
    notes: "Estado vive en useCheckout. Ningun paso puede saltarse.",
  },
  SessionProvider: {
    path: "apps/web/src/auth/SessionProvider.tsx",
    summary: "Provider raiz · expone sesion a toda la app",
    renders: ["RequireAuth"],
    hooks: ["useSession", "useTenantSession"],
    libs: ["lib/authApi.ts"],
    navTo: [],
    lines: 56, owner: "ana", lastChange: "hace 12d", changedBy: "ana",
    decisions: ["decision-014: no JWT en cookies httpOnly"],
    tests: ["session.spec.tsx · 4 tests"],
    notes: "Expone <RequireAuth /> que envuelve cada screen privada.",
  },
  useSession: {
    path: "apps/web/src/hooks/useSession.ts",
    summary: "Hook · estado de sesion y metodos auth",
    renders: [], hooks: [], libs: ["lib/authApi.ts"], navTo: [],
    lines: 62, owner: "ana", lastChange: "hace 12d", changedBy: "ana",
    decisions: ["decision-014: no JWT en cookies httpOnly"],
    tests: ["usesession.spec.ts · 8 tests"],
    usedBy: ["SessionProvider", "RequireAuth", "Dashboard", "LoginForm"],
    notes: "Refresh token rotativo cada 15 min.",
  },
  useCheckout: {
    path: "apps/web/src/checkout/useCheckout.ts",
    summary: "Hook · estado del checkout multi-paso",
    renders: [], hooks: [], libs: ["lib/stripeAdapter.ts"], navTo: [],
    lines: 84, owner: "marc", lastChange: "hace 1d", changedBy: "marc",
    decisions: ["decision-011: checkout siempre 3 pasos · no skip"],
    tests: ["usecheckout.spec.ts · 6 tests"],
    usedBy: ["Flow", "StepBilling", "StepConfirm"],
    notes: "State machine simple · pasos solo avanzan.",
  },
};

export const SKILLS: Skill[] = [
  { id: "dep-guardian", name: "dep-guardian", desc: "Bloquea deps prohibidas por decisiones del equipo", author: "santi", uses: 412, ver: "1.4.2", official: true },
  { id: "dguard-migrations", name: "dguard-migrations", desc: "Template + naming + rollback de migrations Postgres", author: "kei", uses: 38, ver: "1.0.0", official: false, fresh: true },
  { id: "tenant-tests", name: "tenant-tests", desc: "Genera tests RLS + isolation por modulo", author: "ana", uses: 86, ver: "0.7.1", official: false },
  { id: "rls-policies", name: "rls-policies", desc: "Policies de Row Level Security idiomaticas", author: "santi", uses: 124, ver: "1.2.0", official: true },
  { id: "adr-writer", name: "adr-writer", desc: "Compila decisiones desde sesiones + Slack", author: "ana", uses: 56, ver: "0.9.4", official: false },
  { id: "tsx-conventions", name: "tsx-conventions", desc: "Lint AI: convenciones DGuard de React/TSX", author: "ines", uses: 201, ver: "1.1.0", official: false },
];

export const COVERAGE = {
  overall: {
    pct: 73, target: 85, trend: "+2.4 esta semana",
    files: 612, tested: 446, missing: 166, untestedCritical: 8,
  },
  byModule: [
    { id: "web", pct: 81, files: 184, tested: 149, hot: true, trend: "+3.1" },
    { id: "checkout", pct: 92, files: 76, tested: 70, hot: true, trend: "+0.8" },
    { id: "auth", pct: 88, files: 48, tested: 42, hot: true, trend: "0.0" },
    { id: "billing", pct: 84, files: 52, tested: 44, trend: "+1.2" },
    { id: "tenant", pct: 79, files: 64, tested: 51, trend: "+2.0" },
    { id: "onboarding", pct: 71, files: 38, tested: 27, trend: "+4.5" },
    { id: "ui", pct: 62, files: 142, tested: 88, trend: "-1.3" },
    { id: "events", pct: 54, files: 41, tested: 22, trend: "+0.4" },
  ],
  gaps: [
    { fileId: "BillingPanel", reason: "Sin tests · maneja flujo a checkout", risk: "high" as const },
    { fileId: "Summary", reason: "Sin tests · cobra dinero", risk: "high" as const },
    { fileId: "useAuth", reason: "Sin tests · roles/permisos", risk: "high" as const },
    { fileId: "TenantInfo", reason: "Solo 2 tests · crea tenant en server", risk: "high" as const },
    { fileId: "Welcome", reason: "Sin tests · primer paso de onboarding", risk: "med" as const },
    { fileId: "FilterBar", reason: "Sin tests · debounce + URL sync", risk: "med" as const },
    { fileId: "useStepFlow", reason: "Sin tests · estado del wizard", risk: "med" as const },
    { fileId: "TenantHeader", reason: "Sin tests · pero es pure component", risk: "low" as const },
    { fileId: "Stepper", reason: "Sin tests · solo presentacion", risk: "low" as const },
  ],
};

export const RISKS = {
  lastScan: "hace 8 minutos",
  skill: "dguard-scan",
  totalIssues: 14,
  bySeverity: { high: 3, med: 6, low: 5 },
  issues: [
    {
      id: "r1", sev: "high" as const, kind: "decision-violation",
      file: "BillingPanel", line: 24,
      title: "Llama stripe.js directo · viola decision-022",
      detail: "Importa @stripe/stripe-js en vez de lib/stripeAdapter. Decision-022 prohibe tocar Stripe directamente.",
      suggestion: "Reemplazar import por import { adapter } from '@/lib/stripeAdapter'",
      detectedBy: "dguard-scan v1.4",
      decisions: ["decision-022"],
    },
    {
      id: "r2", sev: "high" as const, kind: "auth",
      file: "useSession", line: 41,
      title: "JWT en cookie sin httpOnly · viola decision-014",
      detail: "Linea 41 setea cookie con solo secure: true, falta httpOnly: true.",
      suggestion: "Anadir httpOnly: true al cookies.set()",
      detectedBy: "dguard-scan v1.4",
      decisions: ["decision-014"],
    },
    {
      id: "r3", sev: "high" as const, kind: "missing-tests",
      file: "Summary", line: null,
      title: "Pantalla de confirmacion sin tests · cobra dinero",
      detail: "Summary se muestra antes de crear la suscripcion y no tiene ningun test.",
      suggestion: "Anadir al menos: render con orden vacio, render con orden valida, click confirmar",
      detectedBy: "coverage-scan",
    },
    {
      id: "r4", sev: "med" as const, kind: "duplication",
      file: "TenantHeader", line: 12,
      title: "formatTenantId duplicado · ya existe en shared",
      detail: "Define formatTenantId localmente. Ya existe packages/shared/tenant.ts:18.",
      suggestion: "Importar desde @dguard/shared/tenant",
      detectedBy: "dguard-scan v1.4",
      decisions: ["decision-012"],
    },
    {
      id: "r5", sev: "med" as const, kind: "deprecated",
      file: "FilterBar", line: 8,
      title: "Usa @dguard/ui Button v1 (deprecado)",
      detail: "Importa Button de @dguard/ui. La v2 introduce nueva API.",
      suggestion: "Migrar a v2: import { Button } from '@dguard/ui/v2'",
      detectedBy: "dep-guardian",
    },
    {
      id: "r6", sev: "med" as const, kind: "perf",
      file: "RecentActivity", line: 34,
      title: "Polling sigue activo cuando tab no visible",
      detail: "useEffect con setInterval no escucha visibilitychange.",
      suggestion: "Pausar interval cuando document.hidden",
      detectedBy: "perf-scan",
    },
    {
      id: "r7", sev: "low" as const, kind: "import",
      file: "Dashboard", line: 4,
      title: "Import sin usar",
      detail: "useAuth importado pero nunca llamado.",
      suggestion: "Eliminar el import",
      detectedBy: "lint",
    },
    {
      id: "r8", sev: "low" as const, kind: "console",
      file: "StepBilling", line: 67,
      title: "console.log dejado en codigo",
      detail: "console.log('billing data', data) dentro de handleSubmit.",
      suggestion: "Borrar antes de merge",
      detectedBy: "lint",
    },
  ],
};
