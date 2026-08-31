import { describe, expect, it } from "vitest";
import { isPublicRoute } from "./routes";

describe("isPublicRoute", () => {
  it.each([
    "/",
    "/entrar",
    "/entrar/factor-one",
    "/registro",
    "/registro/verify-email-address",
  ])("treats %s as public", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/inicio",
    "/perfil",
    "/invitar",
    "/coleccion/animes",
    "/api/webhooks/clerk",
  ])("treats %s as protected", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(false);
  });

  it("does not treat a path that merely starts with a public segment name as public", () => {
    expect(isPublicRoute("/entrarcosas")).toBe(false);
  });
});
