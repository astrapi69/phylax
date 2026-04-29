/**
 * Verbatim copy of the repo-root LICENSE file (MIT, Copyright 2025
 * Asterios Raptis).
 *
 * Inlined as a TypeScript string constant rather than fetched at
 * runtime or globbed via Vite so:
 *   - the bundle size cost is exactly the byte count of the text,
 *     no runtime fetch round-trip, no chunk-split overhead;
 *   - offline-first PWA users see the license without depending on
 *     a workbox precache entry for the text file;
 *   - test harnesses do not need fixture wiring.
 *
 * If the LICENSE file is ever amended, update this constant in the
 * same commit. Mismatch is a soft drift but should not be allowed
 * to grow.
 */
export const LICENSE_TEXT = `MIT License

Copyright (c) 2025 Asterios Raptis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
