import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileFormState } from "@/features/profile/actions/update-profile";

const updateProfile =
  vi.fn<
    (
      previous: ProfileFormState,
      formData: FormData,
    ) => Promise<ProfileFormState>
  >();
vi.mock("@/features/profile/actions/update-profile", () => ({
  updateProfile: (previous: ProfileFormState, formData: FormData) =>
    updateProfile(previous, formData),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { EditProfileDialog } = await import("./edit-profile-dialog");

const PROFILE = {
  firstName: "Álvaro",
  lastName: "Fernández",
  username: "alvaro",
  avatarUrl: null,
};

async function open() {
  const user = userEvent.setup();
  render(<EditProfileDialog {...PROFILE} />);
  await user.click(screen.getByRole("button", { name: /editar perfil/i }));
  return user;
}

describe("EditProfileDialog", () => {
  beforeEach(() => {
    updateProfile.mockReset();
    refresh.mockClear();
  });

  it("stays shut until asked", () => {
    render(<EditProfileDialog {...PROFILE} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with your current details already filled in", async () => {
    await open();

    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue("Álvaro");
    expect(screen.getByLabelText(/apellidos/i)).toHaveValue("Fernández");
    expect(screen.getByLabelText(/nombre de usuario/i)).toHaveValue("alvaro");
  });

  it("saves the edited details and refreshes the profile behind it", async () => {
    updateProfile.mockResolvedValue({
      status: "success",
      message: "Perfil actualizado.",
    });
    const user = await open();

    const firstName = screen.getByLabelText(/^nombre$/i);
    await user.clear(firstName);
    await user.type(firstName, "Alvarito");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Perfil actualizado.",
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says plainly when the username is already taken", async () => {
    updateProfile.mockResolvedValue({
      status: "error",
      message: "Ese nombre de usuario ya está cogido.",
    });
    const user = await open();

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("Ese nombre de usuario ya está cogido.");
    expect(message).toHaveClass("text-danger");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers a photo field that only accepts images", async () => {
    await open();

    const photo = screen.getByLabelText(/foto/i);
    expect(photo).toHaveAttribute("type", "file");
    expect(photo).toHaveAttribute("accept", "image/*");
  });

  it("states the backend's exact avatar limits", async () => {
    await open();

    expect(screen.getByText(/JPEG, PNG, WEBP o GIF/)).toBeInTheDocument();
    expect(screen.getByText(/5 MB/)).toBeInTheDocument();
  });

  it("closes on cancel without sending anything, when nothing changed", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("ties a server field error to the username field, focuses it, and keeps what was typed", async () => {
    updateProfile.mockResolvedValue({
      status: "error",
      message: "Ese nombre de usuario ya está en uso.",
      fieldErrors: [
        { field: "username", message: "Ese nombre de usuario ya está en uso." },
      ],
    });
    const user = await open();

    const username = screen.getByLabelText(/nombre de usuario/i);
    await user.clear(username);
    await user.type(username, "otro-nombre");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    const error = await screen.findByText(
      "Ese nombre de usuario ya está en uso.",
    );
    expect(username).toHaveAttribute("aria-invalid", "true");
    expect(username.getAttribute("aria-describedby")).toContain(error.id);
    await waitFor(() => expect(username).toHaveFocus());
    expect(username).toHaveValue("otro-nombre");
  });

  it("keeps the first and last name typed after a form-level server failure", async () => {
    updateProfile.mockResolvedValue({
      status: "error",
      message: "No se han podido guardar los cambios.",
    });
    const user = await open();

    const firstName = screen.getByLabelText(/^nombre$/i);
    await user.clear(firstName);
    await user.type(firstName, "Alvarito");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await screen.findByText("No se han podido guardar los cambios.");
    expect(firstName).toHaveValue("Alvarito");
  });

  it("rejects an avatar heavier than 5 MB client-side, without calling the API", async () => {
    const user = await open();
    const heavy = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "foto.png", {
      type: "image/png",
    });

    await user.upload(screen.getByLabelText(/foto/i), heavy);

    expect(await screen.findByText(/pesa más de 5 MB/)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("rejects an avatar of an unsupported type client-side, without calling the API", async () => {
    // A real OS file picker can still be told to show "All files", bypassing
    // the input's own `accept="image/*"` filter — the JS check is what
    // actually enforces the backend's own limit either way.
    const user = userEvent.setup({ applyAccept: false });
    render(<EditProfileDialog {...PROFILE} />);
    await user.click(screen.getByRole("button", { name: /editar perfil/i }));
    const notAnImage = new File(["x"], "documento.pdf", {
      type: "application/pdf",
    });

    await user.upload(screen.getByLabelText(/foto/i), notAnImage);

    expect(await screen.findByText(/formato|imagen/i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("keeps the selected photo after a recoverable upload failure", async () => {
    updateProfile.mockResolvedValue({
      status: "error",
      message: "No se ha podido completar la acción.",
    });
    const user = await open();
    const photo = new File(["x"], "foto.png", { type: "image/png" });
    const input = screen.getByLabelText(/foto/i) as HTMLInputElement;

    await user.upload(input, photo);
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await screen.findByText("No se ha podido completar la acción.");
    expect(input.files?.[0]?.name).toBe("foto.png");
  });

  it("asks for confirmation before closing with unsaved changes, and 'Seguir editando' keeps the dialog open", async () => {
    const user = await open();
    const firstName = screen.getByLabelText(/^nombre$/i);
    await user.type(firstName, "a");

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    const confirm = screen.getByRole("dialog", {
      name: /descartar los cambios/i,
    });
    expect(confirm).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /seguir editando/i }));
    expect(
      screen.queryByRole("dialog", { name: /descartar los cambios/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue("Álvaroa");
  });

  it("discards and closes both dialogs when the user confirms", async () => {
    const user = await open();
    const firstName = screen.getByLabelText(/^nombre$/i);
    await user.type(firstName, "a");

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await user.click(screen.getByRole("button", { name: /^descartar$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
