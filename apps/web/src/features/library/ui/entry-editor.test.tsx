import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";

const updateLibraryEntry = vi.fn();
vi.mock("@/features/library/actions/update-entry", () => ({
  updateLibraryEntry: (...args: unknown[]) => updateLibraryEntry(...args),
}));

const removeLibraryEntry = vi.fn();
vi.mock("@/features/library/actions/remove-entry", () => ({
  removeLibraryEntry: (...args: unknown[]) => removeLibraryEntry(...args),
}));

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

const { EntryEditor } = await import("./entry-editor");

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-fma",
    workId: "work-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    status: "in_progress",
    progress: 12,
    progressTotal: 64,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: 2009,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function save() {
  return userEvent.click(screen.getByRole("button", { name: /guardar/i }));
}

function sentPatch(): Record<string, unknown> {
  const [, payload] = updateLibraryEntry.mock.calls.at(-1) as [
    unknown,
    { patch: Record<string, unknown> },
  ];
  return payload.patch;
}

describe("EntryEditor", () => {
  beforeEach(() => {
    updateLibraryEntry.mockResolvedValue({
      status: "success",
      message: "Entrada actualizada.",
    });
    removeLibraryEntry.mockResolvedValue({
      status: "success",
      message: "Entrada quitada de tu biblioteca.",
    });
  });

  describe("the status the state machine allows", () => {
    it("offers only the moves docs/domain.md draws out of the current status", () => {
      render(<EntryEditor item={item({ status: "in_progress" })} />);

      for (const label of ["En pausa", "Terminado", "Abandonado"]) {
        expect(screen.getByRole("radio", { name: label })).toBeEnabled();
      }
      for (const label of ["Wishlist", "Pendiente"]) {
        expect(screen.getByRole("radio", { name: label })).toBeDisabled();
      }
    });

    it("keeps the current status pressable, since re-sending it is a no-op and not an illegal move", () => {
      render(<EntryEditor item={item({ status: "wishlist" })} />);

      const current = screen.getByRole("radio", { name: "Wishlist" });
      expect(current).toBeEnabled();
      expect(current).toBeChecked();
      expect(screen.getByRole("radio", { name: "Pendiente" })).toBeEnabled();
      expect(screen.getByRole("radio", { name: "Terminado" })).toBeDisabled();
    });

    it("offers no move at all out of dropped, because the diagram draws none", () => {
      render(<EntryEditor item={item({ status: "dropped" })} />);

      for (const label of [
        "Wishlist",
        "Pendiente",
        "En curso",
        "Terminado",
        "En pausa",
      ]) {
        expect(screen.getByRole("radio", { name: label })).toBeDisabled();
      }
      expect(screen.getByRole("radio", { name: "Abandonado" })).toBeChecked();
    });

    it("says in words why the other statuses are not offered, rather than leaving them dimmed and mute", () => {
      render(<EntryEditor item={item({ status: "pending" })} />);

      expect(
        screen.getByText(/desde .?pendiente.? solo puedes pasar a/i),
      ).toBeVisible();
    });
  });

  describe("the rating, which survives", () => {
    it("does not let you score something you have not finished or abandoned", () => {
      render(<EntryEditor item={item({ status: "in_progress" })} />);

      expect(screen.getByLabelText("Valoración")).toBeDisabled();
      expect(
        screen.getByText(/solo puedes valorar lo que has terminado/i),
      ).toBeVisible();
    });

    it("lets you score something you finished", () => {
      render(<EntryEditor item={item({ status: "completed" })} />);

      expect(screen.getByLabelText("Valoración")).toBeEnabled();
    });

    it("never sends a rating alongside a status change, so a rewatch keeps its score", async () => {
      render(<EntryEditor item={item({ status: "completed", rating: 8 })} />);

      await userEvent.click(screen.getByRole("radio", { name: "En curso" }));
      await save();

      await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalled());
      expect(sentPatch()).toEqual({ status: "in_progress" });
    });

    it("still shows the score it keeps after such a change, rather than blanking it", async () => {
      render(<EntryEditor item={item({ status: "completed", rating: 8 })} />);

      await userEvent.click(screen.getByRole("radio", { name: "En curso" }));

      expect(screen.getByLabelText("Valoración")).toHaveValue(8);
      expect(screen.getByLabelText("Valoración")).toBeDisabled();
    });

    it("sends an explicit null when you clear a score on purpose", async () => {
      render(<EntryEditor item={item({ status: "completed", rating: 8 })} />);

      await userEvent.click(
        screen.getByRole("button", { name: /quitar la valoración/i }),
      );
      await save();

      await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalled());
      expect(sentPatch()).toEqual({ rating: null });
    });
  });

  describe("the progress, which is a count and not a percentage", () => {
    it("counts in the category's own unit and says what the total is", () => {
      render(<EntryEditor item={item({ progress: 12, progressTotal: 64 })} />);

      expect(screen.getByRole("spinbutton", { name: /progreso/i })).toHaveValue(
        12,
      );
      expect(
        screen.getByRole("spinbutton", { name: /progreso/i }),
      ).toHaveAttribute("max", "64");
      expect(screen.getByText(/de 64 episodios/i)).toBeVisible();
    });

    it("sets no ceiling when the catalogue never said one, rather than inventing it", () => {
      render(
        <EntryEditor
          item={item({ progress: 13, progressTotal: null, category: "anime" })}
        />,
      );

      expect(
        screen.getByRole("spinbutton", { name: /progreso/i }),
      ).not.toHaveAttribute("max");
      expect(screen.getByText(/no sabemos cuántos episodios/i)).toBeVisible();
    });

    it("steps by one, both ways", async () => {
      render(<EntryEditor item={item({ progress: 12 })} />);

      await userEvent.click(screen.getByRole("button", { name: /sumar uno/i }));
      expect(screen.getByRole("spinbutton", { name: /progreso/i })).toHaveValue(
        13,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /restar uno/i }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: /restar uno/i }),
      );
      expect(screen.getByRole("spinbutton", { name: /progreso/i })).toHaveValue(
        11,
      );
    });

    it("never steps below zero", async () => {
      render(<EntryEditor item={item({ progress: 0 })} />);

      expect(
        screen.getByRole("button", { name: /restar uno/i }),
      ).toBeDisabled();
    });

    it("never steps past a total the catalogue did give", async () => {
      render(<EntryEditor item={item({ progress: 64, progressTotal: 64 })} />);

      expect(screen.getByRole("button", { name: /sumar uno/i })).toBeDisabled();
    });
  });

  describe("saving only what changed", () => {
    it("has nothing to save until something changes", () => {
      render(<EntryEditor item={item()} />);

      expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    });

    it("sends the flags that moved and nothing else", async () => {
      render(<EntryEditor item={item({ isFavourite: false, owned: false })} />);

      await userEvent.click(screen.getByRole("button", { name: /favorito/i }));
      await save();

      await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalled());
      expect(sentPatch()).toEqual({ is_favourite: true });
    });

    it("sends a flag turned off, which is a value and not an absence", async () => {
      render(<EntryEditor item={item({ owned: true })} />);

      await userEvent.click(
        screen.getByRole("checkbox", { name: /en propiedad/i }),
      );
      await save();

      await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalled());
      expect(sentPatch()).toEqual({ owned: false });
    });

    it("refreshes the page from the server once the save has answered", async () => {
      render(<EntryEditor item={item()} />);

      await userEvent.click(screen.getByRole("button", { name: /sumar uno/i }));
      await save();

      await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it("keeps the edit and says why when the save fails, instead of silently reverting", async () => {
      updateLibraryEntry.mockResolvedValue({
        status: "error",
        message: "No se puede pasar a ese estado desde el actual.",
      });
      render(<EntryEditor item={item()} />);

      await userEvent.click(screen.getByRole("button", { name: /sumar uno/i }));
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No se puede pasar a ese estado desde el actual.",
      );
      expect(screen.getByRole("spinbutton", { name: /progreso/i })).toHaveValue(
        13,
      );
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("removing the entry", () => {
    it("asks before removing, since a delete cannot be undone by repeating it", async () => {
      render(<EntryEditor item={item()} />);

      await userEvent.click(screen.getByRole("button", { name: /quitar de/i }));

      expect(
        await screen.findByRole("dialog", {
          name: /quitar .+ de tu biblioteca/i,
        }),
      ).toBeInTheDocument();
      expect(removeLibraryEntry).not.toHaveBeenCalled();
    });

    it("removes the entry by its own id once confirmed, and leaves the page it was on", async () => {
      render(
        <EntryEditor item={item({ id: "entry-fma", category: "anime" })} />,
      );

      await userEvent.click(screen.getByRole("button", { name: /quitar de/i }));
      await userEvent.click(
        await screen.findByRole("button", { name: "Quitar la entrada" }),
      );

      await waitFor(() =>
        expect(removeLibraryEntry).toHaveBeenCalledWith(
          expect.anything(),
          "entry-fma",
        ),
      );
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/biblioteca/anime"),
      );
    });

    it("stays put and says why when the removal fails", async () => {
      removeLibraryEntry.mockResolvedValue({
        status: "error",
        message: "Esa entrada ya no está en tu biblioteca.",
      });
      render(<EntryEditor item={item()} />);

      await userEvent.click(screen.getByRole("button", { name: /quitar de/i }));
      await userEvent.click(
        await screen.findByRole("button", { name: "Quitar la entrada" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Esa entrada ya no está en tu biblioteca.",
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
