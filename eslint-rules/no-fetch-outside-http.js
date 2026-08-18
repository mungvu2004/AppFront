/**
 * The network is reached through `src/lib/http`, and nowhere else.
 *
 * `src/lib/http/client.ts` is the one module that holds a real transport: it
 * owns the timeout, the retry policy, the single-flight de-duplication and the
 * error shape the rest of the application reads. Code that calls `fetch`
 * directly gets none of that, and the gap is invisible at the call site — a
 * request written by hand looks exactly like a request that came through the
 * client, right up to the moment it hangs forever because nobody gave it a
 * timeout.
 *
 * What is refused:
 *
 * - Reaching for a network global: a free `fetch` or `XMLHttpRequest`, or one
 *   read off a global root (`globalThis.fetch`, `window.fetch`,
 *   `navigator.sendBeacon`). A bare reference counts, not just a call — a
 *   reference is how a direct call is smuggled past a rule that only watches
 *   calls, `globalThis.fetch.bind(globalThis)` being the short way to write it.
 * - Calling `.fetch(...)` on anything at all. The receiver may be a parameter
 *   rather than a global, but the call still opens a socket that `src/lib/http`
 *   never sees.
 *
 * What is deliberately left alone, because it is the pattern this rule exists
 * to push people towards:
 *
 * - An injected transport, whatever it is named: `fetchImpl(url, init)`,
 *   `config.fetchImpl(...)`, `options.sendBeacon()`. A unit that takes its
 *   transport as a parameter can be handed the http client in production and a
 *   fake in a test; that seam is the point. Only the globals are refused, and a
 *   receiver is judged a global by resolving it — a local named `navigator`
 *   shadows the global and is not one.
 * - Probing a capability through a parameter — `if (!windowObject?.fetch)` —
 *   which decides whether a transport exists rather than using it.
 * - Type positions. `readonly fetchImpl?: typeof fetch` names a shape; it opens
 *   nothing.
 */

/** Globals that reach the network, matched as free variables rather than by name at the call site. */
const FORBIDDEN_GLOBALS = new Map([
  [
    'fetch',
    'Cấm gọi fetch trực tiếp ngoài src/lib/http; đi qua client của src/lib/http hoặc nhận transport qua tham số.',
  ],
  ['XMLHttpRequest', 'Cấm dùng XMLHttpRequest; mọi truy cập mạng đi qua src/lib/http.'],
]);

/** Members that reach the network when read off a global root. */
const FORBIDDEN_MEMBERS = new Map([
  [
    'fetch',
    'Cấm gọi fetch trực tiếp ngoài src/lib/http; đi qua client của src/lib/http hoặc nhận transport qua tham số.',
  ],
  [
    'sendBeacon',
    'Cấm gọi navigator.sendBeacon ngoài src/lib/http; mọi truy cập mạng đi qua src/lib/http.',
  ],
]);

/** Objects that are the browser itself rather than something a caller passed in. */
const GLOBAL_ROOTS = new Set(['window', 'globalThis', 'self', 'global', 'navigator']);

/** The one folder allowed to hold a real transport. */
const TRANSPORT_FOLDER = 'src/lib/http/';

/**
 * Tests and stories stand up fake transports on purpose — a test that injects a
 * stub `fetch` is the rule working, not the rule being dodged.
 */
const TEST_FILE = /(?:^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$|\.stories\.[cm]?[jt]sx?$/;

/** The name a member is known by, written `x.fetch` or `x['fetch']`. */
function memberName(node) {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }

  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return null;
}

/** The identifier a member chain hangs off, looking through the wrappers. */
function rootIdentifier(node) {
  let current = node;

  while (current !== null && current !== undefined) {
    switch (current.type) {
      case 'Identifier':
        return current;
      case 'MemberExpression':
        current = current.object;
        break;
      case 'ChainExpression':
        current = current.expression;
        break;
      case 'TSNonNullExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
        current = current.expression;
        break;
      default:
        return null;
    }
  }

  return null;
}

/**
 * Is this identifier inside `typeof …` in a type position?
 *
 * `readonly fetchImpl?: typeof fetch` names the shape of an injected transport.
 * It cannot be checked off the reference flags: typescript-eslint resolves the
 * operand of a type query as a *value* reference — the type is read off the
 * value's binding — so `isTypeReference` is false here and the node itself is
 * the only thing that says this opens no socket.
 */
function isInsideTypeQuery(node) {
  let current = node.parent;

  while (current !== null && current !== undefined) {
    if (current.type === 'TSTypeQuery') {
      return true;
    }

    if (current.type !== 'TSQualifiedName') {
      return false;
    }

    current = current.parent;
  }

  return false;
}

/** Is this member expression the thing being called, `x.fetch(...)`? */
function isCallee(node) {
  let child = node;
  let parent = node.parent;

  // `a?.fetch(...)` wraps the callee in a ChainExpression.
  while (parent !== null && parent !== undefined && parent.type === 'ChainExpression') {
    child = parent;
    parent = parent.parent;
  }

  return parent !== null && parent !== undefined && parent.type === 'CallExpression' && parent.callee === child;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct network access (fetch, XMLHttpRequest, navigator.sendBeacon) outside src/lib/http',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename();
    const normalizedFilename = String(filename).replace(/\\/g, '/');

    if (normalizedFilename.includes(TRANSPORT_FOLDER) || TEST_FILE.test(normalizedFilename)) {
      return {};
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * Member reads are collected rather than reported on sight, because whether
     * `navigator.sendBeacon` is the browser's or a local's cannot be told until
     * the module's free variables are known, and those are only complete at the
     * end.
     */
    const memberCandidates = [];

    return {
      MemberExpression(node) {
        const name = memberName(node);

        if (name === null) {
          return;
        }

        const message = FORBIDDEN_MEMBERS.get(name);

        if (message === undefined) {
          return;
        }

        const root = rootIdentifier(node.object);

        memberCandidates.push({ node, root, name, message, called: isCallee(node) });
      },

      /**
       * Globals are worked out once, at the end, from the scope manager rather
       * than by matching `Identifier` nodes — that is what tells the browser's
       * `fetch` apart from a parameter someone happened to call `fetch`.
       *
       * Two kinds count as global, and missing the second is the easy mistake:
       * a name that resolves to nothing (`scope.through`), and a name that
       * resolves to a variable the environment declared rather than this
       * codebase. `env: { browser: true, es2020: true }` declares `fetch`,
       * `window`, `navigator` and `globalThis`, so every one of them resolves
       * cleanly and none of them ever appears in `through`. Checking only
       * `through` would leave this rule reporting nothing at all.
       */
      'Program:exit'(programNode) {
        const scope = sourceCode.getScope ? sourceCode.getScope(programNode) : context.getScope();
        const globalScope = sourceCode.scopeManager.globalScope ?? scope;

        /** Identifier nodes that name a global rather than anything declared here. */
        const globalIdentifiers = new Set();

        /** A name used as a type names a shape; it opens nothing. */
        const collect = (reference) => {
          if (reference.isTypeReference === true || isInsideTypeQuery(reference.identifier)) {
            return;
          }

          globalIdentifiers.add(reference.identifier);
        };

        for (const reference of globalScope.through) {
          collect(reference);
        }

        for (const variable of globalScope.variables) {
          // `defs` is empty exactly when nothing in this codebase declared it.
          if (variable.defs.length > 0) {
            continue;
          }

          for (const reference of variable.references) {
            collect(reference);
          }
        }

        for (const identifier of globalIdentifiers) {
          const message = FORBIDDEN_GLOBALS.get(identifier.name);

          if (message !== undefined) {
            context.report({ node: identifier, message });
          }
        }

        for (const candidate of memberCandidates) {
          const readOffTheBrowser =
            candidate.root !== null &&
            GLOBAL_ROOTS.has(candidate.root.name) &&
            globalIdentifiers.has(candidate.root);

          // A global transport is refused however it is used; one reached through
          // a parameter is refused only when it is actually called, so that
          // probing whether it exists stays allowed.
          if (readOffTheBrowser || (candidate.name === 'fetch' && candidate.called)) {
            context.report({ node: candidate.node, message: candidate.message });
          }
        }
      },
    };
  },
};
