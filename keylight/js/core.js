"use strict";
/* Shared helpers used by every module */
const isBlack = p => [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0][p % 12] === 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fifthsHue = p => ((p % 12) * 7 % 12) * 30; // harmonically related notes get neighbouring colours
function lowerBound(a, t) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].start < t) lo = m + 1; else hi = m; } return lo; }
const fmt = s => { s = Math.max(0, s); return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };
