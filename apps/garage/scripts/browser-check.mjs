import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This test submits synthetic requests and creates a listing. Never run it remotely.
const base = new URL(process.argv[2] ?? "http://localhost:4322");
assert.ok(
	["localhost", "127.0.0.1"].includes(base.hostname),
	"Browser checks only support local previews.",
);
const session = "garage";
function browser(args, input) {
	const result = spawnSync("agent-browser", ["--session", session, ...args], {
		encoding: "utf8",
		input,
	});
	assert.equal(result.status, 0, result.stdout + result.stderr);
	return result.stdout;
}
const evaluate = (code) => browser(["eval", "--stdin"], code);
const wait = (condition) => browser(["wait", "--fn", condition]);
const open = (path) => browser(["open", new URL(path, base).href]);
const fill = (name, value) =>
	browser(["fill", `input[name="${name}"],textarea[name="${name}"]`, value]);
const click = (selector) => browser(["click", selector]);
const stamp = Date.now();
try {
	browser(["set", "viewport", "390", "844"]);
	open(`/?qa=${stamp}`);
	wait("document.querySelectorAll('.product-card').length === 5");
	evaluate(`(() => {
		if (document.documentElement.scrollWidth > innerWidth) throw Error('Mobile page overflows');
		if (!/need\\.\\sSome/.test(document.querySelector('.intro-note p').innerText)) throw Error('Mobile sentences are joined');
		localStorage.removeItem('garage.box.v1');
		return 'Mobile layout passed';
	})()`);
	open(`/?qa=${stamp + 1}`);
	wait("document.querySelectorAll('.product-card').length === 5");
	evaluate(
		"[...document.querySelectorAll('.chip')].find(a=>a.textContent.startsWith('Coffee')).click()",
	);
	wait(
		"document.querySelectorAll('.product-card').length === 2 && location.search.includes('category=Coffee')",
	);
	evaluate(
		"[...document.querySelectorAll('.chip')].find(a=>a.textContent.startsWith('Tools')).click()",
	);
	wait(
		"document.querySelectorAll('.product-card').length === 4 && location.search.includes('category=Tools')",
	);
	click(".chip");
	wait("document.querySelectorAll('.product-card').length === 5");
	evaluate(
		"document.querySelector('a[aria-label=\"View A trusty claw hammer\"]').closest('article').querySelector('button').click()",
	);
	evaluate(
		"document.querySelector('a[aria-label=\"View V60 coffee dripper\"]').closest('article').querySelector('button').click()",
	);
	wait("document.querySelector('.box-count').textContent === '2'");
	open(`/?qa=${stamp + 2}`);
	wait(
		"document.querySelector('.box-count')?.textContent === '2' && document.querySelectorAll('.product-card').length === 5",
	);
	click('a[aria-label="View V60 coffee dripper"]');
	wait("Boolean(document.querySelector('dialog[open] .product-detail'))");
	evaluate(
		"(() => { if(!document.querySelector('dialog').contains(document.activeElement)) throw Error('Dialog did not receive focus'); return 'Dialog focus passed'; })()",
	);
	browser(["press", "Escape"]);
	wait("!document.querySelector('dialog')");
	click(".box-link");
	wait("Boolean(document.querySelector('input[name=name]'))");
	click("button[type=submit]");
	evaluate(
		"(() => { if(document.activeElement.name!=='name') throw Error('Missing name is not focused'); return 'Required name passed'; })()",
	);
	fill("name", "Local browser check");
	click("button[type=submit]");
	evaluate(
		"(() => { if(!document.querySelector('[name=whatsapp]').validationMessage) throw Error('Missing contact accepted'); return 'Required contact passed'; })()",
	);
	fill("email", "garage-browser-check@example.com");
	click("input[name=bangalore]");
	wait("Boolean(document.querySelector('[name=city]'))");
	fill("city", "Mumbai");
	browser(["screenshot", "/tmp/garage-box.png"]);
	click("button[type=submit]");
	wait("Boolean(document.querySelector('.request-success'))");
	evaluate(
		"(() => { if(document.querySelector('.box-count').textContent!=='0') throw Error('Sent box not cleared'); return 'Box request sent'; })()",
	);
	open(`/admin?qa=${stamp}`);
	wait("Boolean(document.querySelector('[name=password]'))");
	const password = readFileSync(
		new URL("../.local-admin-password", import.meta.url),
		"utf8",
	).trim();
	evaluate(
		`(() => { const input=document.querySelector('[name=password]'); input.value=${JSON.stringify(password)}; input.form.requestSubmit(); return 'Signing in'; })()`,
	);
	wait("Boolean(document.querySelector('.admin-toolbar'))");
	click(".admin-toolbar a.button");
	wait("Boolean(document.querySelector('[name=title]'))");
	fill("title", "Local browser test listing");
	fill(
		"description",
		"Synthetic listing used to verify photo uploads, free listings, and category visibility.",
	);
	fill("category", "Browser test category");
	fill("brand", "Test brand");
	fill("originalUrl", "https://example.com/product");
	click("input[name=free]");
	browser(["select", "[name=status]", "available"]);
	browser([
		"upload",
		"[name=photo]",
		fileURLToPath(new URL("../../../src/assets/widgets/hammer.webp", import.meta.url)),
	]);
	click("button[type=submit]");
	wait("Boolean(document.querySelector('.admin-toolbar'))");
	open(`/?qa=${stamp + 3}`);
	wait("document.querySelectorAll('.product-card').length === 6");
	evaluate(
		"(() => { const p=[...document.querySelectorAll('.product-card')].find(p=>p.textContent.includes('Local browser test listing')); if(!p.querySelector('img') || !p.textContent.includes('Free')) throw Error('Photo or free price missing'); if(![...document.querySelectorAll('.chip')].some(a=>a.textContent.includes('Browser test category'))) throw Error('New category missing'); return 'Listing published'; })()",
	);
	evaluate(
		"location.href='/admin?edit='+new URL([...document.querySelectorAll('.product-card')].find(p=>p.textContent.includes('Local browser test listing')).querySelector('a').href).searchParams.get('item')",
	);
	wait("Boolean(document.querySelector('[name=status]'))");
	browser(["select", "[name=status]", "reserved"]);
	click("button[type=submit]");
	wait("Boolean(document.querySelector('.admin-toolbar'))");
	open(`/?qa=${stamp + 4}`);
	wait("document.querySelectorAll('.product-card').length === 5");
	evaluate(
		"(() => { if([...document.querySelectorAll('.chip')].some(a=>a.textContent.includes('Browser test category'))) throw Error('Empty category is visible'); return 'Empty category hidden'; })()",
	);
	open("/admin?view=requests");
	wait("Boolean(document.querySelector('.request-card'))");
	evaluate(
		"(() => { const card=[...document.querySelectorAll('.request-card')].find(e=>e.textContent.includes('Local browser check')); if(!card || !card.textContent.includes('Mumbai') || card.querySelectorAll('li').length!==2 || !card.textContent.includes('₹900')) throw Error('Inbox request does not match the box'); return 'Request inbox passed'; })()",
	);
	browser(["screenshot", "/tmp/garage-admin.png"]);
	browser(["select", ".request-card select", "contacted"]);
	wait("document.querySelector('.status-tag')?.textContent === 'contacted'");
	evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign out').click()");
	wait("Boolean(document.querySelector('[name=password]'))");
	evaluate(
		"(async () => { if((await fetch('/api/admin/requests')).status!==401) throw Error('Private inbox accessible after logout'); return 'Sign out passed'; })()",
	);
	browser(["set", "viewport", "1440", "1000"]);
	open(`/?qa=${stamp + 5}`);
	wait("document.querySelectorAll('.product-card').length === 5");
	browser(["screenshot", "/tmp/garage-desktop.png"]);
	console.log(
		"Browser checks passed: mobile layout, category toggles, saved box, native dialog focus, form validation, alternate city, requests, login, photo upload, free listing, availability, private inbox, and logout.",
	);
} catch (error) {
	console.error(browser(["snapshot", "-i"]));
	console.error(
		evaluate(
			"JSON.stringify([...document.querySelectorAll('input,textarea,select')].filter(e=>!e.validity.valid).map(e=>({name:e.name,message:e.validationMessage})))",
		),
	);
	browser(["screenshot", "/tmp/garage-browser-failure.png"]);
	throw error;
} finally {
	browser(["close"]);
}
