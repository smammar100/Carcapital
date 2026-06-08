"use client";

import { useEffect } from "react";

/**
 * Defines the Nord <nord-*> custom elements on the client.
 *
 * Registration is deferred to a useEffect dynamic import so the side-effectful
 * `customElements.define()` calls (which throw in Node) never run during SSR.
 * Until they run, `@nordhealth/css` keeps undefined custom elements hidden, so
 * there is no flash of unstyled content. Mount this once, high in the tree.
 */
export function NordRegister(): null {
  useEffect(() => {
    void import("./register");
  }, []);
  return null;
}
