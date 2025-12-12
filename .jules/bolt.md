## 2024-05-23 - Vanilla JS Rendering Patterns
**Learning:** This codebase relies heavily on Vanilla JS for DOM manipulation. A common anti-pattern found was `innerHTML +=` inside loops, which causes performance degradation due to repeated DOM parsing and layout thrashing (O(n^2) behavior).
**Action:** When working on this codebase, always accumulate HTML strings in a variable (e.g., `let html = ''; ... html += '...'`) and update `innerHTML` only once after the loop. This significantly improves rendering performance for lists and tables.
