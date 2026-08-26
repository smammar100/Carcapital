import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EditableCard,
  parseByKind,
  toInputValue,
  type EditableField,
} from "./editable-card";
import { nonNegative, required, validYear } from "@/lib/field-edit";

interface Row extends Record<string, unknown> {
  colour: string | null;
  mileage: number | null;
  year: number | null;
  v5Received: boolean;
  stockId: string;
}

const record: Row = {
  colour: "Blue",
  mileage: 40000,
  year: 2019,
  v5Received: false,
  stockId: "STK-1",
};

const fields: EditableField<Row>[] = [
  {
    key: "colour",
    label: "Colour",
    kind: "text",
    validators: [required("Colour") as never],
  },
  {
    key: "mileage",
    label: "Mileage",
    kind: "integer",
    suffix: "mi",
    validators: [nonNegative("Mileage") as never],
  },
  {
    key: "year",
    label: "Year",
    kind: "integer",
    validators: [validYear(new Date("2026-08-25T00:00:00Z")) as never],
  },
  { key: "v5Received", label: "V5 Received", kind: "boolean" },
  { key: "stockId", label: "Stock ID", kind: "text", readOnly: true },
];

function setup(onSave = vi.fn().mockResolvedValue(undefined), canEdit = true) {
  const user = userEvent.setup();
  render(
    <EditableCard
      title="Identity"
      record={record}
      fields={fields}
      onSave={onSave}
      canEdit={canEdit}
    />,
  );
  return { user, onSave };
}

describe("EditableCard — read mode", () => {
  it("renders values with their suffix", () => {
    setup();
    expect(screen.getByText("40,000 mi")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("renders booleans as Yes/No", () => {
    setup();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  // GEN-99 UAT 18
  it("hides the edit control when the user lacks permission", () => {
    setup(vi.fn(), false);
    expect(screen.queryByRole("button", { name: /edit identity/i })).toBeNull();
  });

  it("shows the edit control when permitted", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /edit identity/i }),
    ).toBeInTheDocument();
  });
});

describe("EditableCard — editing", () => {
  it("swaps to inputs seeded with the current values", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    expect(screen.getByLabelText("Colour")).toHaveValue("Blue");
    expect(screen.getByLabelText("Mileage")).toHaveValue("40000");
  });

  // GEN-99 UAT 1 — read-only fields stay read-only in edit mode.
  it("does not offer an input for a read-only field", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    expect(screen.queryByLabelText("Stock ID")).toBeNull();
    expect(screen.getByText("STK-1")).toBeInTheDocument();
  });

  // GEN-99 UAT 2
  it("saves a changed value as a patch of only that key", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const colour = screen.getByLabelText("Colour");
    await user.clear(colour);
    await user.type(colour, "Red");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual({ colour: "Red" });
  });

  // GEN-99 UAT 16 — the audit trail needs old and new values.
  it("reports old and new values in the change record", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const colour = screen.getByLabelText("Colour");
    await user.clear(colour);
    await user.type(colour, "Red");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1]).toEqual([
      { key: "colour", label: "Colour", from: "Blue", to: "Red" },
    ]);
  });

  // GEN-99 UAT 3 — "45,000" must not save as 45.
  it("parses a thousands-separated number correctly", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const mileage = screen.getByLabelText("Mileage");
    await user.clear(mileage);
    await user.type(mileage, "45,000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual({ mileage: 45000 });
  });

  // GEN-99 UAT 17 — a no-op save must not write.
  it("does not call onSave when nothing changed", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit identity/i })).toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  // GEN-99 UAT 14
  it("discards changes on cancel", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const colour = screen.getByLabelText("Colour");
    await user.clear(colour);
    await user.type(colour, "Red");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("toggles a boolean field and saves it", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));
    await user.click(screen.getByLabelText("V5 Received"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual({ v5Received: true });
  });
});

describe("EditableCard — validation", () => {
  // GEN-99 UAT 4
  it("blocks the save and reports non-numeric input", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const mileage = screen.getByLabelText("Mileage");
    await user.clear(mileage);
    await user.type(mileage, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not a valid number/i,
    );
  });

  // GEN-99 UAT 5
  it("blocks a negative mileage", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const mileage = screen.getByLabelText("Mileage");
    await user.clear(mileage);
    await user.type(mileage, "-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /cannot be negative/i,
    );
  });

  // GEN-99 UAT 8
  it("blocks a year beyond next year", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const year = screen.getByLabelText("Year");
    await user.clear(year);
    await user.type(year, "2050");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Year must be/i);
  });

  it("rejects clearing a required field", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    await user.clear(screen.getByLabelText("Colour"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/is required/i);
  });

  it("marks an invalid input for assistive tech", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const mileage = screen.getByLabelText("Mileage");
    await user.clear(mileage);
    await user.type(mileage, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mileage).toHaveAttribute("aria-invalid", "true"));
  });

  // GEN-99 UAT 21 — a failed save must not look like success.
  it("stays in edit mode when the save throws", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    const { user } = setup(onSave);
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const colour = screen.getByLabelText("Colour");
    await user.clear(colour);
    await user.type(colour, "Red");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // Still editing, edits preserved, and the failure is visible.
    expect(screen.getByLabelText("Colour")).toHaveValue("Red");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be saved/i,
    );
  });

  it("clears the failure notice on a successful retry", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const { user } = setup(onSave);
    await user.click(screen.getByRole("button", { name: /edit identity/i }));

    const colour = screen.getByLabelText("Colour");
    await user.clear(colour);
    await user.type(colour, "Red");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("value conversion", () => {
  it("formats a date for a date input", () => {
    expect(toInputValue("2026-08-25T10:30:00Z", "date")).toBe("2026-08-25");
  });

  it("renders null as an empty input", () => {
    expect(toInputValue(null, "text")).toBe("");
  });

  it("coerces booleans", () => {
    expect(toInputValue(null, "boolean")).toBe(false);
    expect(toInputValue(true, "boolean")).toBe(true);
  });

  it("parses each kind", () => {
    expect(parseByKind("42", "integer")).toBe(42);
    expect(parseByKind("42.5", "integer")).toBeUndefined();
    expect(parseByKind("£1,000", "currency")).toBe(1000);
    expect(parseByKind("", "select")).toBeNull();
    expect(parseByKind("  x  ", "text")).toBe("x");
  });
});
