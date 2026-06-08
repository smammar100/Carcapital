// Registers the <nord-*> custom elements we use, via tree-shaken subpath
// imports. Each import is side-effectful: Lit calls `customElements.define()`
// at module-evaluation time.
//
// IMPORTANT: this module must only ever be evaluated in the browser. Lit's
// `customElements.define()` throws in Node, so importing this during SSR would
// crash the render. It is loaded lazily from <NordRegister> inside a useEffect,
// guaranteeing client-only execution. Do NOT import it from a module that runs
// on the server.

// Primitives
import "@nordhealth/components/lib/Button";
import "@nordhealth/components/lib/ButtonGroup";
import "@nordhealth/components/lib/Input";
import "@nordhealth/components/lib/Textarea";
import "@nordhealth/components/lib/Checkbox";
import "@nordhealth/components/lib/Radio";
import "@nordhealth/components/lib/Toggle";
import "@nordhealth/components/lib/Select";
import "@nordhealth/components/lib/Fieldset";
import "@nordhealth/components/lib/Card";
import "@nordhealth/components/lib/Badge";
import "@nordhealth/components/lib/Tag";
import "@nordhealth/components/lib/TagGroup";
import "@nordhealth/components/lib/Avatar";
import "@nordhealth/components/lib/Spinner";
import "@nordhealth/components/lib/Divider";
import "@nordhealth/components/lib/Tooltip";
import "@nordhealth/components/lib/Icon";
import "@nordhealth/components/lib/Skeleton";
import "@nordhealth/components/lib/ProgressBar";
import "@nordhealth/components/lib/Stack";
import "@nordhealth/components/lib/VisuallyHidden";

// Overlays & feedback
import "@nordhealth/components/lib/Modal";
import "@nordhealth/components/lib/Popout";
import "@nordhealth/components/lib/Dropdown";
import "@nordhealth/components/lib/DropdownGroup";
import "@nordhealth/components/lib/DropdownItem";
import "@nordhealth/components/lib/Banner";
import "@nordhealth/components/lib/Toast";
import "@nordhealth/components/lib/ToastGroup";
import "@nordhealth/components/lib/EmptyState";

// Layout & navigation shell
import "@nordhealth/components/lib/Layout";
import "@nordhealth/components/lib/Navigation";
import "@nordhealth/components/lib/NavGroup";
import "@nordhealth/components/lib/NavItem";
import "@nordhealth/components/lib/NavToggle";
import "@nordhealth/components/lib/TopBar";
import "@nordhealth/components/lib/Header";
import "@nordhealth/components/lib/Footer";

// Tabs & table
import "@nordhealth/components/lib/TabGroup";
import "@nordhealth/components/lib/Tab";
import "@nordhealth/components/lib/TabPanel";
import "@nordhealth/components/lib/Table";
