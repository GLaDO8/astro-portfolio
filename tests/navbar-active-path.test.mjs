import assert from "node:assert/strict";
import test from "node:test";

import { isNavbarLinkActive } from "../src/lib/navbar-active-path.js";

test("case study detail routes keep the Work tab active", () => {
	assert.equal(isNavbarLinkActive("/work", "/case-studies/wayground-creation"), true);
	assert.equal(isNavbarLinkActive("/", "/case-studies/wayground-creation"), false);
});

test("work index routes still match Work", () => {
	assert.equal(isNavbarLinkActive("/work", "/work"), true);
	assert.equal(isNavbarLinkActive("/work", "/work/archive"), true);
});
