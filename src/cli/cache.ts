import { Command } from "commander";
import { clearCache, pruneCache } from "../cache/cache.ts";
import { LocalFsRegistry } from "../registry/localFs.ts";
import { logger } from "../utils/logger.ts";

export const registerCacheCommand = (program: Command): void => {
  const cache = program.command("cache").description("Manage the local cache");

  cache
    .command("clear [name]")
    .description("Remove cached payloads for one package or all")
    .action(async (name?: string) => {
      await clearCache(name);
      logger.success(name ? `cleared cache for ${name}` : "cleared entire cache");
    });

  cache
    .command("prune")
    .description("Remove cached payloads that no longer exist in the registry")
    .action(async () => {
      const registry = new LocalFsRegistry();
      const { removed } = await pruneCache(registry);
      if (removed.length === 0) {
        logger.info("nothing to prune");
        return;
      }
      logger.success(`pruned ${removed.length} entry(ies):`);
      for (const r of removed) logger.info(`  - ${r}`);
    });
};
