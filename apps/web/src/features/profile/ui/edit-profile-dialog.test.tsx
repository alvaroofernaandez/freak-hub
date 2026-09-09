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

    const message = await screen.findByRole("status");
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

  it("closes on cancel without sending anything", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
