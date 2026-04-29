type ProgressState = {
  activeCount: number;
  progress: number;
  visible: boolean;
};

type ProgressListener = (state: ProgressState) => void;

const initialState: ProgressState = {
  activeCount: 0,
  progress: 0,
  visible: false
};

let state: ProgressState = { ...initialState };
let listeners: ProgressListener[] = [];
let progressTimer: number | null = null;
let hideTimer: number | null = null;

function isClient() {
  return typeof window !== "undefined";
}

function notify() {
  if (!isClient()) {
    return;
  }

  listeners.forEach((listener) => listener(state));
}

function startTimer() {
  if (!isClient() || progressTimer) {
    return;
  }

  progressTimer = window.setInterval(() => {
    if (state.activeCount <= 0) {
      return;
    }

    const nextProgress = state.progress < 25 ? 25 : state.progress < 60 ? state.progress + 12 : state.progress + 4;
    state = {
      ...state,
      visible: true,
      progress: Math.min(nextProgress, 90)
    };
    notify();
  }, 180);
}

function stopTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function finishProgress() {
  if (!isClient()) {
    return;
  }

  clearHideTimer();
  state = {
    ...state,
    activeCount: 0,
    progress: 100,
    visible: true
  };
  notify();
  stopTimer();

  hideTimer = window.setTimeout(() => {
    state = { ...initialState };
    notify();
  }, 220);
}

export function subscribeProgress(listener: ProgressListener) {
  if (!isClient()) {
    return () => undefined;
  }

  listeners = [...listeners, listener];
  listener(state);

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function beginRequest() {
  if (!isClient()) {
    return () => undefined;
  }

  clearHideTimer();
  const nextCount = state.activeCount + 1;
  state = {
    ...state,
    activeCount: nextCount,
    visible: true,
    progress: state.progress > 0 ? Math.min(state.progress, 90) : 12
  };
  notify();
  startTimer();

  let ended = false;
  return () => {
    if (ended) {
      return;
    }

    ended = true;
    state = {
      ...state,
      activeCount: Math.max(0, state.activeCount - 1)
    };

    if (state.activeCount <= 0) {
      finishProgress();
    } else {
      notify();
    }
  };
}

export function getProgressState() {
  return state;
}
