import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Demo-only preview route (?demo=jobs) — renders JobsTab against an in-memory
// mock. Lazy-loaded so the mock module only evaluates on the demo URL.
const isJobsDemo =
  typeof window !== "undefined" &&
  ["jobs", "wizard"].includes(new URLSearchParams(window.location.search).get("demo"));

const JobsDemo = React.lazy(() => import("./demo/JobsDemo"));

function Root() {
  if (isJobsDemo) {
    return (
      <Suspense fallback={null}>
        <JobsDemo />
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
