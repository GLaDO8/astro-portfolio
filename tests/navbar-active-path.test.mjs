import assert from "node:assert/strict";
import test from "node:test";

import { isNavbarLinkActive } from "../src/lib/navbar-active-path.js";

test("work routes keep the Work tab active", () => {
	assert.equal(isNavbarLinkActive("/work", "/work"), true);
	assert.equal(isNavbarLinkActive("/work", "/work/wayground-creation"), true);
	assert.equal(isNavbarLinkActive("/", "/work/wayground-creation"), false);
});

test("writings routes keep the Writings tab active", () => {
	assert.equal(isNavbarLinkActive("/writings", "/writings"), true);
	assert.equal(isNavbarLinkActive("/writings", "/writings/field-notes"), true);
	assert.equal(isNavbarLinkActive("/work", "/writings/field-notes"), false);
});
