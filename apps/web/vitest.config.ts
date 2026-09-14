import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    /**
     * Call history of every spy is wiped between tests. Module-scope `vi.fn()`
     * spies are the norm in this suite (a `vi.mock` factory cannot close over
     * a per-test variable), and their history otherwise survives from one test
     * to the next: an `expect(spy).not.toHaveBeenCalled()` then passes or
     * fails depending on the order the file happens to run in, which
     * `--sequence.shuffle` makes visible and CI makes intermittent.
     *
     * Only the history — implementations and return values set with
     * `mockReturnValue`/`mockResolvedValue` survive, so a file that configures
     * its mocks once at module scope keeps working.
     */
    clearMocks: true,
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/app/**/layout.tsx"],
    },
  },
});
