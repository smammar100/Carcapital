import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only auto-registers its cleanup when the test framework
 * exposes globals, and this project runs vitest without `globals: true`.
 * Without this, every render stays mounted and queries start matching
 * elements left behind by earlier tests in the same file.
 */
afterEach(cleanup);

/**
 * The app's <Button> renders Nord's <nord-button> web component. Nord's real
 * definitions need a browser (adoptedStyleSheets, ElementInternals) and are
 * never loaded under jsdom, so the element would otherwise render as an
 * unknown tag with no role — making `getByRole("button")` fail in every
 * component test that touches a button.
 *
 * These stubs give the custom elements the accessibility semantics testing
 * queries rely on, without pulling in the real implementation. Behaviour is
 * deliberately minimal: role, disabled handling, and nothing else.
 */
function defineRoleStub(tag: string, role: string) {
  if (customElements.get(tag)) return;

  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = ["disabled"];

      connectedCallback() {
        if (!this.hasAttribute("role")) this.setAttribute("role", role);
        this.syncDisabled();
      }

      attributeChangedCallback() {
        this.syncDisabled();
      }

      private syncDisabled() {
        // Nord reflects `disabled` as an attribute; mirror it onto ARIA so
        // queries and user-event's pointer-events check both behave.
        const disabled =
          this.hasAttribute("disabled") &&
          this.getAttribute("disabled") !== "false";
        if (disabled) {
          this.setAttribute("aria-disabled", "true");
        } else {
          this.removeAttribute("aria-disabled");
        }
      }
    },
  );
}

defineRoleStub("nord-button", "button");
