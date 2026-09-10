import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

function Harness() {
  const [show, setShow] = useState(true);

  return (
    <div>
      <button type="button" onClick={() => setShow(false)}>
        Ocultar
      </button>
      <AnimatePresence>
        {show ? (
          <m.p key="content" exit={{ opacity: 0 }}>
            Contenido
          </m.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * This is not app behaviour, it proves the test-environment fix in
 * vitest.setup.ts: an `m.*` element inside `AnimatePresence`, rendered with NO
 * `LazyMotion` ancestor in this test's own tree (unit tests render components
 * directly, never wrapped in the app's MotionProvider), must still actually
 * unmount once its exit animation resolves. If Motion's animation features
 * were never registered for this test file, `exit` never completes and
 * `AnimatePresence` never calls `safeToRemove`, so the element stays in the
 * DOM forever and this test times out.
 */
describe("motion feature registration for tests", () => {
  it("unmounts an AnimatePresence exit once its animation completes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("Contenido")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar" }));

    await waitFor(() =>
      expect(screen.queryByText("Contenido")).not.toBeInTheDocument(),
    );
  });
});
