// Vitest alias target for the "server-only" package: Next's bundler uses it
// to fail client imports at build time; in tests it's a harmless no-op.
export {};
