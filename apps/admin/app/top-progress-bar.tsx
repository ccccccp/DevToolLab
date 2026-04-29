"use client";

import { useEffect, useState } from "react";
import { getProgressState, subscribeProgress } from "@devtoollab/shared";

export function TopProgressBar() {
  const [state, setState] = useState(getProgressState());

  useEffect(() => {
    return subscribeProgress(setState);
  }, []);

  return (
    <div
      className="top-progress-shell"
      aria-hidden="true"
      data-visible={state.visible ? "true" : "false"}
    >
      <div
        className="top-progress-bar"
        style={{
          width: `${Math.max(0, Math.min(state.progress, 100))}%`,
          opacity: state.visible ? 1 : 0
        }}
      />
    </div>
  );
}
