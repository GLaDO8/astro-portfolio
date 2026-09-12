import assert from "node:assert/strict";
import test from "node:test";

import { proximityStrength, widgetRotation } from "../src/lib/widgetProximity.ts";

const bounds = { left: 100, right: 500, top: 200, bottom: 400 };
const center = { x: 300, y: 300 };
const epsilon = 1e-12;

function assertClose(actual, expected) {
	assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test("proximityStrength is full inside the group, including edges and corners", () => {
	for (const x of [bounds.left, center.x, bounds.right]) {
		for (const y of [bounds.top, center.y, bounds.bottom]) {
			assert.equal(proximityStrength({ x, y }, bounds), 1);
		}
	}
});

test("proximityStrength is zero at and beyond 280px from every edge", () => {
	for (const distance of [280, 281, 1000]) {
		for (const pointer of [
			{ x: bounds.left - distance, y: center.y },
			{ x: bounds.right + distance, y: center.y },
			{ x: center.x, y: bounds.top - distance },
			{ x: center.x, y: bounds.bottom + distance },
		]) {
			assert.equal(proximityStrength(pointer, bounds), 0);
		}
	}
});

test("proximityStrength follows a smooth, monotonic falloff", () => {
	const strengthAt = (distance) =>
		proximityStrength({ x: bounds.right + distance, y: center.y }, bounds);

	for (const [distance, expected] of [
		[0, 1],
		[70, 0.84375],
		[140, 0.5],
		[210, 0.15625],
		[280, 0],
	]) {
		assertClose(strengthAt(distance), expected);
	}

	let previous = 1;
	for (let distance = 1; distance <= 280; distance++) {
		const strength = strengthAt(distance);
		assert.ok(strength >= 0 && strength < previous, `falloff at ${distance}px`);
		previous = strength;
	}

	// Smoothstep flattens near both endpoints rather than cutting off linearly.
	assert.ok(1 - strengthAt(1) < 0.0001);
	assert.ok(strengthAt(279) < 0.0001);
});

test("proximityStrength measures Euclidean distance from the nearest corner", () => {
	for (const xSign of [-1, 1]) {
		for (const ySign of [-1, 1]) {
			const corner = {
				x: xSign < 0 ? bounds.left : bounds.right,
				y: ySign < 0 ? bounds.top : bounds.bottom,
			};
			// The 84/112/140 triangle is halfway through the proximity range.
			assertClose(
				proximityStrength(
					{
						x: corner.x + xSign * 84,
						y: corner.y + ySign * 112,
					},
					bounds,
				),
				0.5,
			);
			assert.equal(
				proximityStrength(
					{
						x: corner.x + xSign * 200,
						y: corner.y + ySign * 200,
					},
					bounds,
				),
				0,
			);
		}
	}
});

test("widgets left of the cursor rotate counterclockwise and those right rotate clockwise", () => {
	for (const [dx, dy, expected] of [
		[210, 0, -7],
		[-210, 0, 7],
		[210, -210, -3.5],
		[-210, -210, 3.5],
		[0, 210, 0],
		[0, -210, 0],
	]) {
		assertClose(widgetRotation({ x: center.x + dx, y: center.y + dy }, center, 1), expected);
	}
});

test("widgetRotation stays within 7 degrees and scales with proximity strength", () => {
	for (const strength of [0.25, 0.5, 1]) {
		for (const distance of [210, 420, 840, 10000]) {
			for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
				const radians = (angle * Math.PI) / 180;
				const pointer = {
					x: center.x + Math.cos(radians) * distance,
					y: center.y + Math.sin(radians) * distance,
				};
				const rotation = widgetRotation(pointer, center, strength);
				assert.ok(Math.abs(rotation) <= 7 * strength + epsilon);
				assertClose(rotation, widgetRotation(pointer, center, 1) * strength);
			}
		}
	}
});

test("widgetRotation is neutral at the center or with zero strength", () => {
	for (const strength of [0, 0.5, 1]) assertClose(widgetRotation(center, center, strength), 0);
	assertClose(widgetRotation({ x: 900, y: -700 }, center, 0), 0);
});

test("widgetRotation does not flip direction as the cursor crosses below a card", () => {
	for (const dx of [-210, 210]) {
		assertClose(
			widgetRotation({ x: center.x + dx, y: center.y - 100 }, center, 1),
			widgetRotation({ x: center.x + dx, y: center.y + 100 }, center, 1),
		);
	}
});

test("all four widget centers respond distinctly under the same group strength", () => {
	const groupBounds = { left: 100, right: 900, top: 100, bottom: 300 };
	const pointer = { x: 500, y: -40 };
	const strength = proximityStrength(pointer, groupBounds);
	assertClose(strength, 0.5);

	const centers = [200, 400, 600, 800].map((x) => ({ x, y: 200 }));
	const rotations = centers.map((widgetCenter) => widgetRotation(pointer, widgetCenter, strength));
	for (const [index, rotation] of rotations.entries()) {
		assert.equal(Math.sign(rotation), index < 2 ? -1 : 1);
		assert.ok(Math.abs(rotation) > 0);
	}
	assert.equal(new Set(rotations).size, 4);
	assert.ok(Math.abs(rotations[0]) > Math.abs(rotations[1]));
	assertClose(rotations[0], -rotations[3]);
	assertClose(rotations[1], -rotations[2]);
});

test("rotation follows the angle from the vertical centerline", () => {
	const magnitudeAt = (dx, dy) =>
		Math.abs(widgetRotation({ x: center.x + dx, y: center.y + dy }, center, 1));
	assert.ok(magnitudeAt(100, -200) < magnitudeAt(200, -200));
	assert.ok(magnitudeAt(200, -200) < magnitudeAt(300, -200));
	assert.ok(magnitudeAt(200, -400) < magnitudeAt(200, -200));
	assertClose(magnitudeAt(200, -200), 3.5);
});

test("rotation eases through the center rather than flipping abruptly", () => {
	assertClose(widgetRotation({ x: center.x + 60, y: center.y }, center, 1), -3.5);
	assertClose(widgetRotation({ x: center.x - 60, y: center.y }, center, 1), 3.5);
	assert.ok(Math.abs(widgetRotation({ x: center.x + 0.01, y: center.y }, center, 1)) < 0.001);
});
