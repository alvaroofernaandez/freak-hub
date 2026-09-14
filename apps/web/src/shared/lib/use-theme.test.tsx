import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_COLOR, THEME_STORAGE_KEY } from "./theme";
import { useTheme } from "./use-theme";

function Harness({ name }: { name: string }) {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <p>
        {name}: {theme}
      </p>
      <button type="button" onClick={() => setTheme("light")}>
        {name} claro
      </button>
      <button type="button" onClick={toggleTheme}>
        {name} alternar
      </button>
    </div>
  );
}

describe("useTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="whatever" />';
  });

  it("starts from whatever the inline script already put on the document", () => {
    document.documentElement.dataset.theme = "light";

    render(<Harness name="a" />);

    expect(screen.getByText("a: light")).toBeInTheDocument();
  });

  it("defaults to dark when nothing set the attribute", () => {
    render(<Harness name="a" />);

    expect(screen.getByText("a: dark")).toBeInTheDocument();
  });

  it("moves the document, the browser chrome and the stored choice together", async () => {
    const user = userEvent.setup();
    render(<Harness name="a" />);

    await user.click(screen.getByRole("button", { name: "a claro" }));

    expect(screen.getByText("a: light")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(
      document.head.querySelector('meta[name="theme-color"]'),
    ).toHaveAttribute("content", THEME_COLOR.light);
  });

  it("alternates between the two themes", async () => {
    const user = userEvent.setup();
    render(<Harness name="a" />);

    await user.click(screen.getByRole("button", { name: "a alternar" }));
    expect(screen.getByText("a: light")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "a alternar" }));
    expect(screen.getByText("a: dark")).toBeInTheDocument();
  });

  it("keeps every subscriber in step, so a second control never shows a stale theme", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness name="a" />
        <Harness name="b" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "a claro" }));

    expect(screen.getByText("b: light")).toBeInTheDocument();
  });
});
