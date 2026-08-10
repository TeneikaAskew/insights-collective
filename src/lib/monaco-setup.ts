// ABOUTME: Points @monaco-editor/react at the bundled Monaco instead of a CDN.
// ABOUTME: Imported for its side effect by the one page that renders an editor.
//
// Why
// ---
// @monaco-editor/react ships only the React wrapper. Left alone, its loader
// fetches Monaco itself from https://cdn.jsdelivr.net at runtime, which made a
// third party a hard dependency of the code-practice page: when that host is
// unreachable — a blocked network, an offline user, jsdelivr having a bad day —
// the editor never appears, and the page offers no way to write the answer it
// is asking for. It also cost the e2e suite 22 failures here, all of them
// `ERR_PROXY_CONNECTION_FAILED` against that URL.
//
// Monaco is now a dependency like any other, so the editor is served from our
// own origin. CodePractice is lazily routed, so this rides in that route's
// chunk rather than the entry bundle.

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Monaco asks for a worker per language service. The editor only ever renders
 * python or javascript here, so those are the two that matter: javascript's
 * language features live in the typescript worker, and python has no worker at
 * all — Monaco tokenises it from a static grammar.
 *
 * Anything else falls back to the plain editor worker rather than throwing,
 * which is what Monaco does for a language whose worker was never registered.
 */
window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

export { monaco };
