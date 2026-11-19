import { cn } from "cn";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, money, readBox } from "./lib";
import { QueryLink, useQuery } from "./navigation";
import type { BoxItem, Product } from "./types";
import { Arrow, BoxIcon, ErrorMessage, Modal, Photo } from "./ui";

export default function Marketplace() {
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [demo, setDemo] = useState(false);
	const [box, setBox] = useState<BoxItem[]>(readBox);
	const [notice, setNotice] = useState("");
	const { params, navigate } = useQuery();
	const selected = params.getAll("category");
	const categories = [...new Set(products.map((p) => p.category))].sort((a, b) =>
		a.localeCompare(b),
	);
	const active = selected.filter((c) => categories.includes(c));
	const filtered = active.length ? products.filter((p) => active.includes(p.category)) : products;
	const product = products.find((p) => p.id === params.get("item"));
	const showBox = params.get("box") === "open";
	const boxProducts = box.flatMap((item) => {
		const found = products.find((p) => p.id === item.id);
		return found ? [found] : [];
	});
	const load = useCallback(async () => {
		setError("");
		setLoading(true);
		try {
			const result = await api<{ products: Product[]; demo: boolean }>("/api/products");
			setProducts(result.products);
			setDemo(result.demo);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load the garage. Try again.");
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);
	useEffect(() => {
		try {
			localStorage.setItem("garage.box.v1", JSON.stringify(box));
		} catch {
			/* The box still works when storage is unavailable. */
		}
	}, [box]);
	const href = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null) next.delete(key);
			else next.set(key, value);
		}
		return next.size ? `/?${next}` : "/";
	};
	const categoryHref = (category?: string) => {
		const next = new URLSearchParams(params);
		next.delete("category");
		const values = category
			? active.includes(category)
				? active.filter((v) => v !== category)
				: [...active, category]
			: [];
		for (const value of values) next.append("category", value);
		return next.size ? `/?${next}` : "/";
	};
	const add = (p: Product) => {
		if (box.some((v) => v.id === p.id)) return;
		if (box.length >= 30) {
			setNotice("Your box is full. Send this request before starting another.");
			return;
		}
		setBox((items) => [...items, { id: p.id, title: p.title }]);
		setNotice(`${p.title} added to your box.`);
	};
	const remove = (id: string) => setBox((items) => items.filter((p) => p.id !== id));
	const close = () => navigate(href({ item: null, box: null }));

	return (
		<>
			{demo ? (
				<div className="preview-note">Local preview · Sample listings, not real inventory</div>
			) : null}
			<header className="site-header shell">
				<a href="/" className="wordmark" aria-label="Garage home">
					garage<span className="wordmark-dot">.</span>
				</a>
				<a className="byline" href="https://shrey.fyi">
					a little corner of shrey.fyi <span aria-hidden="true">↗</span>
				</a>
				<QueryLink
					navigate={navigate}
					href={href({ box: "open", item: null })}
					className="box-link"
				>
					<BoxIcon />
					<span>Your box</span>
					<span className="box-count">{box.length}</span>
				</QueryLink>
			</header>
			<main id="main-content" className="shell marketplace">
				<section className="intro">
					<div>
						<p className="eyebrow">
							<span className="location-dot" /> Shreyas’s garage · Bangalore
						</p>
						<h1>
							Good things,
							<br />
							ready for a new home.
						</h1>
					</div>
					<div className="intro-note">
						<p>
							A few things I no longer need. <br />
							Some for sale. Some to give away. <br />
							All with a little life left in them.
						</p>
						<p className="small text-secondary">
							Find something you like? Add it to your box
							<br className="desktop-break" /> and send me a request. We’ll take it from there.
						</p>
					</div>
				</section>
				<nav aria-label="Product categories" className="category-nav">
					<QueryLink
						navigate={navigate}
						href={categoryHref()}
						aria-current={!active.length ? "true" : undefined}
						className={cn("chip", !active.length && "chip-active")}
					>
						All things <span>{products.length}</span>
					</QueryLink>
					{categories.map((category) => (
						<QueryLink
							key={category}
							navigate={navigate}
							href={categoryHref(category)}
							aria-current={active.includes(category) ? "true" : undefined}
							className={cn("chip", active.includes(category) && "chip-active")}
						>
							{category} <span>{products.filter((p) => p.category === category).length}</span>
						</QueryLink>
					))}
				</nav>
				<div className="catalog-caption">
					<p>
						{loading
							? "Opening the garage…"
							: `${filtered.length} ${filtered.length === 1 ? "thing" : "things"} looking for a new home`}
					</p>
					<p>Good finds. Less waste.</p>
				</div>
				{error ? (
					<div className="empty-state">
						<ErrorMessage message={error} />
						<button type="button" className="button" onClick={load}>
							Try again
						</button>
					</div>
				) : loading ? (
					<div
						className="product-grid"
						role="status"
						aria-label="Loading products"
						aria-busy="true"
					>
						{[0, 1, 2].map((key) => (
							<div key={key} className="loading-card" />
						))}
					</div>
				) : products.length ? (
					<div className="product-grid">
						{filtered.map((p, index) => {
							const added = box.some((v) => v.id === p.id);
							return (
								<article className="product-card" key={p.id}>
									<QueryLink
										navigate={navigate}
										href={href({ item: p.id, box: null })}
										className="photo-link"
										aria-label={`View ${p.title}`}
									>
										<Photo product={p} eager={index < 3} />
										{p.pricePaise === 0 ? <span className="free-tag">Yours for free</span> : null}
										<span className="photo-arrow">
											<Arrow />
										</span>
									</QueryLink>
									<div className="card-meta">
										<span>
											{p.category} <span aria-hidden="true">/</span> {p.brand}
										</span>
										<span className="card-price">{money(p.pricePaise)}</span>
									</div>
									<h2>
										<QueryLink navigate={navigate} href={href({ item: p.id, box: null })}>
											{p.title}
										</QueryLink>
									</h2>
									<p className="card-description">{p.description}</p>
									<button
										type="button"
										className={cn("add-button", added && "added")}
										onClick={() => (added ? navigate(href({ box: "open", item: null })) : add(p))}
									>
										<span aria-hidden="true">{added ? "✓" : "+"}</span>
										{added ? "In your box" : "Add to box"}
									</button>
								</article>
							);
						})}
					</div>
				) : (
					<div className="empty-state">
						<BoxIcon className="size-10" />
						<h2>A little space for what’s next.</h2>
						<p>The garage is empty for now. Check back for the next clear-out.</p>
						<a className="text-link" href="https://shrey.fyi">
							Visit shrey.fyi <Arrow />
						</a>
					</div>
				)}
				<section className="how-it-works">
					<p className="eyebrow">Nothing complicated.</p>
					<div>
						<p>
							<span>01</span> Find your things.
						</p>
						<p>
							<span>02</span> Put a box together.
						</p>
						<p>
							<span>03</span> Send me a request.
						</p>
					</div>
					<p className="small text-secondary">
						No checkout. No payment here.
						<br />
						I’ll get in touch to confirm availability and work out the handover.
					</p>
				</section>
			</main>
			<footer className="site-footer shell">
				<p>A little less clutter. A little more use.</p>
				<div>
					<a href="https://shrey.fyi">
						Made personal, by Shreyas <span aria-hidden="true">↗</span>
					</a>
					<a href="/admin">Admin</a>
				</div>
			</footer>
			<p className="sr-only" role="status" aria-live="polite">
				{notice}
			</p>
			{product && !showBox ? (
				<Modal title="A closer look" close={close}>
					<div className="product-detail">
						<Photo product={product} eager />
						<div className="detail-copy">
							<p className="eyebrow">
								{product.category} / {product.brand}
							</p>
							<h2>{product.title}</h2>
							<p className="detail-price">{money(product.pricePaise)}</p>
							<p className="description">{product.description}</p>
							<a
								className="text-link"
								href={product.originalUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								View original product <span aria-hidden="true">↗</span>
							</a>
							<button
								type="button"
								className="button full-width"
								onClick={() => {
									add(product);
									navigate(href({ item: null, box: "open" }));
								}}
							>
								{box.some((v) => v.id === product.id) ? "View your box" : "Add to your box"}
								<BoxIcon />
							</button>
							<p className="small text-secondary">
								A request starts a conversation. I’ll confirm the details with you.
							</p>
						</div>
					</div>
				</Modal>
			) : null}
			{!loading && params.has("item") && !product && !showBox ? (
				<Modal title="This thing has moved on" close={close}>
					<div className="empty-state">
						<p>This listing is no longer available.</p>
						<button type="button" className="button" onClick={close}>
							Back to the garage
						</button>
					</div>
				</Modal>
			) : null}
			{showBox ? (
				<Modal title={`Your box (${box.length})`} close={close} drawer>
					<RequestBox
						box={box}
						products={boxProducts}
						loading={loading}
						loadError={error}
						remove={remove}
						close={close}
						clear={() => setBox([])}
						refresh={load}
					/>
				</Modal>
			) : null}
		</>
	);
}

function RequestBox({
	box,
	products,
	loading,
	loadError,
	remove,
	close,
	clear,
	refresh,
}: {
	box: BoxItem[];
	products: Product[];
	loading: boolean;
	loadError: string;
	remove: (id: string) => void;
	close: () => void;
	clear: () => void;
	refresh: () => Promise<void>;
}) {
	const [bangalore, setBangalore] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState("");
	const requestId = useRef(crypto.randomUUID());
	const total = products.reduce((sum, p) => sum + p.pricePaise, 0);
	const unavailable = box.filter((item) => !products.some((p) => p.id === item.id));
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const email = String(data.get("email") ?? "").trim();
		const whatsapp = String(data.get("whatsapp") ?? "").trim();
		if (!email && !whatsapp) {
			const input = form.elements.namedItem("whatsapp") as HTMLInputElement;
			input.setCustomValidity("Add your WhatsApp number or email address.");
			input.reportValidity();
			return;
		}
		setSending(true);
		setError("");
		try {
			const result = await api<{ id: string }>("/api/requests", {
				method: "POST",
				body: JSON.stringify({
					id: requestId.current,
					name: data.get("name"),
					email,
					whatsapp,
					bangalore,
					city: data.get("city") ?? "",
					company: data.get("company"),
					productIds: products.map((p) => p.id),
				}),
			});
			setSent(result.id);
			clear();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not send your request. Try again.");
		} finally {
			setSending(false);
		}
	}
	if (sent)
		return (
			<div className="request-success">
				<span className="success-icon" aria-hidden="true">
					✓
				</span>
				<p className="eyebrow">Box request received</p>
				<h3>Thanks. I’ll be in touch.</h3>
				<p>
					I’ll confirm what’s available and work out the handover with you using the details you
					shared.
				</p>
				<p className="small text-secondary">Your reference: {sent.slice(0, 8)}</p>
				<button type="button" className="button" onClick={close}>
					Back to the garage <Arrow />
				</button>
			</div>
		);
	if (loading)
		return (
			<p className="empty-state" role="status">
				Checking your box…
			</p>
		);
	if (loadError)
		return (
			<div className="empty-state">
				<p>We couldn’t check availability.</p>
				<button type="button" className="button" onClick={refresh}>
					Try again
				</button>
			</div>
		);
	if (!box.length)
		return (
			<div className="empty-state">
				<BoxIcon className="size-12" />
				<h3>Room for something good.</h3>
				<p>Add a few things you like, then send me a request.</p>
				<button type="button" className="button" onClick={close}>
					Explore the garage <Arrow />
				</button>
			</div>
		);
	return (
		<div className="box-content">
			<p className="small text-secondary">
				A box of possibilities. Nothing is reserved until I confirm it with you.
			</p>
			<ul className="box-items">
				{box.map((item) => {
					const product = products.find((p) => p.id === item.id);
					return (
						<li key={item.id}>
							{product ? (
								<Photo product={product} />
							) : (
								<div className="unavailable-photo">
									<BoxIcon />
								</div>
							)}
							<div>
								<h3>{item.title}</h3>
								<p className="small text-secondary">
									{product ? money(product.pricePaise) : "No longer available"}
								</p>
								<button type="button" className="text-button small" onClick={() => remove(item.id)}>
									Remove<span className="sr-only"> {item.title}</span>
								</button>
							</div>
						</li>
					);
				})}
			</ul>
			{unavailable.length ? (
				<p className="form-error">Remove unavailable things before sending your request.</p>
			) : null}
			<div className="box-total">
				<span>Box total</span>
				<strong>{money(total)}</strong>
			</div>
			{products.length ? (
				<form
					className="request-form"
					onSubmit={submit}
					onInput={(event) => {
						const form = event.currentTarget;
						(form.elements.namedItem("whatsapp") as HTMLInputElement).setCustomValidity("");
					}}
				>
					<h3>Let’s get this to you.</h3>
					<p className="small text-secondary">Leave your name and at least one way to reach you.</p>
					<label>
						Your name
						<input
							name="name"
							autoComplete="name"
							required
							maxLength={120}
							placeholder="e.g. Aditi…"
						/>
					</label>
					<label>
						WhatsApp number <span className="label-hint">with country code</span>
						<input
							name="whatsapp"
							type="tel"
							inputMode="tel"
							autoComplete="tel"
							maxLength={30}
							placeholder="+91 98765 43210…"
						/>
					</label>
					<label>
						Email address
						<input
							name="email"
							type="email"
							autoComplete="email"
							spellCheck={false}
							maxLength={254}
							placeholder="you@example.com…"
						/>
					</label>
					<label className="checkbox-label">
						<input
							name="bangalore"
							type="checkbox"
							checked={bangalore}
							onChange={(e) => setBangalore(e.target.checked)}
						/>
						I’m in Bangalore
					</label>
					{!bangalore ? (
						<label>
							Your city
							<input
								name="city"
								required
								autoComplete="address-level2"
								maxLength={100}
								placeholder="e.g. Mumbai…"
							/>
						</label>
					) : null}
					<div className="honeypot" aria-hidden="true">
						<label>
							Company
							<input name="company" tabIndex={-1} autoComplete="off" />
						</label>
					</div>
					<ErrorMessage message={error} />
					{error ? (
						<button type="button" className="text-button small" onClick={refresh}>
							Refresh availability
						</button>
					) : null}
					<button
						type="submit"
						className="button full-width"
						disabled={sending || unavailable.length > 0}
					>
						{sending ? "Sending your request…" : "Send box request"}
						<Arrow />
					</button>
					<p className="small text-secondary">
						Your details are only used to arrange this request. No payment is collected here.
					</p>
				</form>
			) : (
				<button type="button" className="button full-width" onClick={close}>
					Back to the garage
				</button>
			)}
		</div>
	);
}
