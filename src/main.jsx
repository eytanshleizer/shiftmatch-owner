import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Demo-only preview routes (?demo=…) — render real components against an
// in-memory mock. Lazy-loaded so the mock modules only evaluate on the demo URL.
const demoParam =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("demo")
    : null;
const isJobsDemo = ["jobs", "wizard"].includes(demoParam);
const isTourDemo = demoParam === "tour";
const isScheduleDemo = demoParam === "schedule";

const JobsDemo = React.lazy(() => import("./demo/JobsDemo"));
const TourDemo = React.lazy(() => import("./demo/TourDemo"));
const ScheduleDemo = React.lazy(() => import("./demo/ScheduleDemo"));

function Root() {
  if (isTourDemo) {
    return (
      <Suspense fallback={null}>
        <TourDemo />
      </Suspense>
    );
  }
  if (isJobsDemo) {
    return (
      <Suspense fallback={null}>
        <JobsDemo />
      </Suspense>
    );
  }
  if (isScheduleDemo) {
    return (
      <Suspense fallback={null}>
        <ScheduleDemo />
      </Suspense>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Root />
  </ErrorBoundary>
);
