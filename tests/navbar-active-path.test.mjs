import assert from "node:assert/strict";
import test from "node:test";

import { isNavbarLinkActive } from "../src/lib/navbar-active-path.js";

test("work routes keep the Work tab active", () => {
	assert.equal(isNavbarLinkActive("/work", "/work"), true);
	assert.equal(isNavbarLinkActive("/work", "/work/wayground-creation"), true);
	assert.equal(isNavbarLinkActive("/", "/work/wayground-creation"), false);
});

test("notes routes keep the Notes tab active", () => {
	assert.equal(isNavbarLinkActive("/notes", "/notes"), true);
	assert.equal(isNavbarLinkActive("/notes", "/notes/field-notes"), true);
	assert.equal(isNavbarLinkActive("/work", "/notes/field-notes"), false);
});
