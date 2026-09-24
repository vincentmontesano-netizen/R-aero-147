import { describe, expect, it } from "vitest";
import { readableError } from "../mobile/src/errors";

describe("native form error presentation", () => {
  it("shows field guidance without validators, patterns or serialization", () => {
    const error = new Error(
      JSON.stringify([
        {
          code: "invalid_format",
          pattern: "internal-regex",
          message: "Email invalide.",
        },
        {
          code: "too_small",
          message: "Le mot de passe doit comporter au moins 8 caractères.",
        },
      ])
    );
    expect(readableError(error, "Réessayez.")).toBe(
      "Email invalide.\nLe mot de passe doit comporter au moins 8 caractères."
    );
  });
  it("preserves business guidance but hides internal server failures", () => {
    expect(
      readableError(
        new Error("Nombre maximal de tentatives atteint."),
        "Réessayez."
      )
    ).toBe("Nombre maximal de tentatives atteint.");
    expect(
      readableError(
        {
          message: "database internal detail",
          data: { code: "INTERNAL_SERVER_ERROR" },
        },
        "Service indisponible."
      )
    ).toBe("Service indisponible.");
    expect(readableError(new Error("{invalid"), "Réessayez.")).toBe(
      "Réessayez."
    );
  });
});
