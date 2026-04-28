import { createApp } from "./app";
import { runScheduledTasks } from "./scheduler";

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled: runScheduledTasks
};
