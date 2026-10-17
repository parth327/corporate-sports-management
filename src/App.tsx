import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { ToastProvider } from '@/hooks/useToast';

/**
 * One site, three surfaces:
 *
 *   /              the public Corporate Sports Events Management portal
 *   /login …       authentication
 *   /console/*     the operating console
 *
 * There is no /register. Participants arrive from the HR feed rather than signing
 * themselves up, so the public registration route was removed rather than
 * hidden — a form nobody can reach is still a form someone can POST to.
 *
 * Every surface is lazy-loaded. The public page never downloads the console,
 * its forms library or the demo database, and signing into the console never
 * downloads the stadium renderer.
 */

const Landing = lazy(() => import('@/site/Landing'));
const TeamBuilderLab = lazy(() => import('@/lab/team-builder/TeamBuilderLab'));
const ConsoleLayout = lazy(() => import('@/console/ConsoleLayout'));
const RequireAuth = lazy(() => import('@/console/RequireAuth').then((m) => ({ default: m.RequireAuth })));
const Forbidden = lazy(() => import('@/console/RequireAuth').then((m) => ({ default: m.Forbidden })));
const Auth = {
  Login: lazy(() => import('@/console/pages/auth').then((m) => ({ default: m.LoginPage }))),
  Forgot: lazy(() => import('@/console/pages/auth').then((m) => ({ default: m.ForgotPasswordPage }))),
  Reset: lazy(() => import('@/console/pages/auth').then((m) => ({ default: m.ResetPasswordPage }))),
  Profile: lazy(() => import('@/console/pages/auth').then((m) => ({ default: m.ProfilePage }))),
};
const DashboardPage = lazy(() => import('@/console/pages/Dashboard'));
const AllocationPage = lazy(() => import('@/console/pages/Allocation'));
const SchedulePage = lazy(() => import('@/console/pages/Schedule'));
const ResultsPage = lazy(() => import('@/console/pages/Results'));
const ReportsPage = lazy(() => import('@/console/pages/Reports'));
const HistoryPage = lazy(() => import('@/console/pages/History'));
const EventHubPage = lazy(() => import('@/console/pages/EventHub').then((m) => ({ default: m.EventHubPage })));

const Masters = {
  Groups: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.GroupsPage }))),
  SubGroups: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.SubGroupsPage }))),
  PlayerTypes: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.PlayerTypesPage }))),
  PlayerTypeDetails: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.PlayerTypeDetailsPage }))),
  Rules: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.RulesPage }))),
  Events: lazy(() => import('@/console/pages/events').then((m) => ({ default: m.EventSchedulingPage }))),
  Users: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.UsersPage }))),
  Umpires: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.UmpiresPage }))),
  EventTeam: lazy(() => import('@/console/pages/masters').then((m) => ({ default: m.EventTeamPage }))),
};

const Participants = {
  List: lazy(() => import('@/console/pages/players').then((m) => ({ default: m.PlayersPage }))),
};

const Integration = {
  Groups: lazy(() =>
    import('@/console/pages/integration').then((m) => ({ default: m.GroupAssignmentPage })),
  ),
  SubGroups: lazy(() =>
    import('@/console/pages/integration').then((m) => ({ default: m.SubGroupAssignmentPage })),
  ),
  Types: lazy(() =>
    import('@/console/pages/integration').then((m) => ({ default: m.TypeAssignmentPage })),
  ),
  TypeDetails: lazy(() =>
    import('@/console/pages/integration').then((m) => ({ default: m.TypeDetailAssignmentPage })),
  ),
};

const Competition = {
  Teams: lazy(() => import('@/console/pages/competition').then((m) => ({ default: m.TeamsPage }))),
  TeamGroups: lazy(() => import('@/console/pages/competition').then((m) => ({ default: m.TeamGroupsPage }))),
  Formations: lazy(() =>
    import('@/console/pages/formations').then((m) => ({ default: m.FormationsPage })),
  ),
  Builder: lazy(() =>
    import('@/console/pages/teamBuilder').then((m) => ({ default: m.TeamBuilderPage })),
  ),
};

const Admin = {
  Permissions: lazy(() => import('@/console/pages/admin').then((m) => ({ default: m.PermissionsPage }))),
  Audit: lazy(() => import('@/console/pages/admin').then((m) => ({ default: m.AuditPage }))),
};

/* Inline rather than the console's Spinner, so the entry bundle does not carry the console UI kit. */
function RouteFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface" role="status">
      <div className="flex items-center gap-3 text-fg/70">
        <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-[13px]">Loading…</span>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
      <div className="max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-hud text-accent-solar">Error 404</p>
        <h1 className="mt-3 font-display text-3xl tracking-tightest text-fg">Page not found</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-fg/50">
          That address does not exist. It may have been renamed, or the link that brought you here
          may be out of date.
        </p>
        <a href="/" className="btn-solar mt-7 inline-flex !py-3 !text-[13px]">
          Back to the portal
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    /**
     * `reducedMotion="user"` is the one that matters.
     *
     * The CSS kill-switch in index.css stops CSS animations and transitions,
     * but Framer drives transforms from JavaScript as inline styles, which
     * that rule cannot reach. Without this, every `motion` component that does
     * not individually call `useReducedMotion` — the charts, the page
     * entrances, the standings rows, the funnel bars — kept animating for a
     * user who had explicitly asked it not to.
     *
     * Set here rather than per component so a new `motion` element is covered
     * the moment it is written, instead of only when someone remembers.
     */
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* ---------- Public ---------- */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Auth.Login />} />
              <Route path="/forgot-password" element={<Auth.Forgot />} />
              <Route path="/reset-password" element={<Auth.Reset />} />

              {/* ---------- Lab: front-end prototypes, no API behind them ---------- */}
              <Route path="/lab/team-builder" element={<TeamBuilderLab />} />

              {/* ---------- Console ---------- */}
              <Route
                path="/console"
                element={
                  <RequireAuth>
                    <ConsoleLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="profile" element={<Auth.Profile />} />

                <Route path="participants" element={<Participants.List />} />
                {/* The register moved to /console/participants with the rename.
                    Anyone holding an old link still lands in the right place. */}
                <Route path="players" element={<Navigate to="/console/participants" replace />} />
                <Route path="event-team" element={<Masters.EventTeam />} />

                {/* Classification pipeline — walked top down. */}
                <Route path="integration/groups" element={<Integration.Groups />} />
                <Route path="integration/sub-groups" element={<Integration.SubGroups />} />
                <Route path="integration/types" element={<Integration.Types />} />
                <Route path="integration/type-details" element={<Integration.TypeDetails />} />

                <Route path="teams" element={<Competition.Teams />} />
                <Route path="formations" element={<Competition.Formations />} />
                <Route path="team-builder" element={<Competition.Builder />} />
                <Route path="allocation" element={<AllocationPage />} />
                <Route path="team-groups" element={<Competition.TeamGroups />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="results" element={<ResultsPage />} />
                <Route path="rules" element={<Masters.Rules />} />

                <Route path="masters/groups" element={<Masters.Groups />} />
                <Route path="masters/sub-groups" element={<Masters.SubGroups />} />
                <Route path="masters/player-types" element={<Masters.PlayerTypes />} />
                <Route path="masters/player-type-details" element={<Masters.PlayerTypeDetails />} />
                <Route path="masters/umpires" element={<Masters.Umpires />} />

                {/* Event scheduling is its own surface now, not a master —
                    the Main Admin creates the event, Event Management runs it. */}
                <Route path="events" element={<Masters.Events />} />
                <Route path="events-hub" element={<EventHubPage />} />
                <Route path="masters/events" element={<Navigate to="/console/events" replace />} />

                <Route path="admin/users" element={<Masters.Users />} />
                <Route path="admin/permissions" element={<Admin.Permissions />} />
                <Route path="admin/audit" element={<Admin.Audit />} />

                <Route path="reports" element={<ReportsPage />} />
                <Route path="history" element={<HistoryPage />} />

                <Route path="forbidden" element={<Forbidden />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Legacy hash links from the old single-page build. */}
              <Route path="/dashboard" element={<Navigate to="/console" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
