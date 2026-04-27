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

test("notes routes keep the Notes tab active", () => {
	assert.equal(isNavbarLinkActive("/notes", "/notes"), true);
	assert.equal(isNavbarLinkActive("/notes", "/notes/field-notes"), true);
	assert.equal(isNavbarLinkActive("/work", "/notes/field-notes"), false);
});

test("sidequests routes keep the Sidequests tab active", () => {
	assert.equal(isNavbarLinkActive("/sidequests", "/sidequests"), true);
	assert.equal(isNavbarLinkActive("/sidequests", "/sidequests/co2"), true);
	assert.equal(isNavbarLinkActive("/notes", "/sidequests/co2"), false);
});
