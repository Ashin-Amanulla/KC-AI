/**
 * Sandboxed module runtime.
 *
 * Compiles uploaded JSX with sucrase, rewrites bare imports to a require()
 * registry backed by the app's own bundled dependencies, and evaluates the
 * result inside this dedicated iframe document. The iframe has no access to
 * parent window objects beyond postMessage; the host passes the source in and
 * receives ready/error signals back.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { transform } from 'sucrase';

// ─── Import registry ─────────────────────────────────────────────────────────
// Only modules already bundled with the host app can be provided. Anything
// else throws at compile-eval time with a clear message.

import * as ReactNamespace from 'react';
import * as ReactDOMNamespace from 'react-dom';
import * as XLSX from 'xlsx';
import * as LucideIcons from 'lucide-react';

const REGISTRY = {
  react: ReactNamespace,
  'react-dom': ReactDOMNamespace,
  xlsx: XLSX,
  'lucide-react': LucideIcons,
};

/** Virtual aliases so uploaded code can reach shared app pieces. */
const ALIASES = {
  '@app/react': 'react',
  '@app/xlsx': 'xlsx',
  '@app/icons': 'lucide-react',
};

function resolveImport(spec) {
  const mapped = ALIASES[spec] || spec;
  if (REGISTRY[mapped]) return REGISTRY[mapped];
  // Sub-path imports like "react-dom/client"
  for (const key of Object.keys(REGISTRY)) {
    if (mapped === key || mapped.startsWith(`${key}/`)) {
      const mod = REGISTRY[key];
      if (!mapped.includes('/')) return mod;
      const sub = mapped.split('/')[1];
      if (mod[sub]) return mod[sub];
    }
  }
  throw new Error(
    `Import "${spec}" is not available in the sandbox. Available: ${Object.keys(REGISTRY).join(', ')}, plus @app/* aliases.`
  );
}

function makeRequire(sourceSpec) {
  return (spec) => resolveImport(spec);
}

// ─── Compile + evaluate ──────────────────────────────────────────────────────

export function compileModuleSource(sourceCode) {
  const importedSpecs = [];

  // Sucrase keeps ESM imports; we need CJS so we can inject our require().
  // jsxImportSource stays default; production runtime is fine here.
  const { code } = transform(sourceCode, {
    transforms: ['jsx', 'typescript', 'imports'],
    filePath: 'module.jsx',
    production: true,
  });

  // Collect import specifiers by regex over the original source for messaging,
  // then let the CJS wrapper's require() do real resolution.
  const importRe = /(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(sourceCode))) importedSpecs.push(m[1]);

  return { code, importedSpecs };
}

export function evaluateModule(code, requireFn) {
  const exportsObj = {};
  const moduleObj = { exports: exportsObj };

  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'require',
    'module',
    'exports',
    'React',
    `"use strict";\n${code}\n//# sourceURL=custom-module.jsx`
  );

  factory(requireFn, moduleObj, exportsObj, React);
  return moduleObj.exports;
}

/** Pick the component to render: default export, or exported function named like a component. */
export function pickComponent(moduleExports) {
  if (!moduleExports) return null;
  if (React.isValidElement(moduleExports.default)) return () => moduleExports.default;
  if (typeof moduleExports.default === 'function') return moduleExports.default;
  for (const key of Object.keys(moduleExports)) {
    const val = moduleExports[key];
    if (typeof val === 'function' && /^[A-Z]/.test(key)) return val;
  }
  return null;
}

export async function bootModule(sourceCode, mountEl) {
  try {
    const { code } = compileModuleSource(sourceCode);
    const exports = evaluateModule(code, makeRequire());
    const Component = pickComponent(exports);

    if (!Component) {
      throw new Error(
        'No React component found. Export a default component or a capitalized named export.'
      );
    }

    const root = createRoot(mountEl);
    root.render(React.createElement(Component));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
