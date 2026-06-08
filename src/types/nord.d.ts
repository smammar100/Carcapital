// Nord Design System — JSX intrinsic element types for the <nord-*> web
// components. We pull these in via a triple-slash reference (picked up by the
// existing `**/*.ts` include) instead of adding to tsconfig `compilerOptions.types`,
// which would narrow away the ambient @types/* the project relies on.
/// <reference types="@nordhealth/components/lib/react.d.ts" />

export {};
