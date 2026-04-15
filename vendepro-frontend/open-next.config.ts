import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "direct",
    },
  },
};

export default config;
