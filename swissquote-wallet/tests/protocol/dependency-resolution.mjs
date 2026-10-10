// Reviewer-only import hook. Resolve direct test imports from the protocol package's
// declared dependencies, without installing or changing lead-owned root dependencies.
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const requireFromProtocol = createRequire(new URL('../../packages/protocol/package.json', import.meta.url));
const resolved = new Map(['viem', 'viem/accounts'].map(name => [name, pathToFileURL(requireFromProtocol.resolve(name)).href]));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'viem' || specifier === 'viem/accounts') {
      return { url: resolved.get(specifier), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
