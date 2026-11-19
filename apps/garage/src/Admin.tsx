import { cn } from "cn";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api, money } from "./lib";
import { QueryLink, useQuery } from "./navigation";
import type { GarageRequest, Product, ProductStatus } from "./types";
import { Arrow, BoxIcon, ErrorMessage, Photo } from "./ui";

export default function Admin() {
	const [authenticated, setAuthenticated] = useState<boolean | null>(null);
	const [products, setProducts] = useState<Product[]>([]);
	const [requests, setRequests] = useState<GarageRequest[]>([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const { params, navigate } = useQuery();
	const view = params.get("view") === "requests" ? "requests" : "listings";
	const edit = params.get("edit");
	const editing = products.find((p) => p.id === edit);
	const handleError = useCallback((e: unknown) => {
		if (e instanceof ApiError && e.status === 401) setAuthenticated(false);
		setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
	}, []);
	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [p, r] = await Promise.all([
				api<{ products: Product[] }>("/api/admin/products"),
				api<{ requests: GarageRequest[] }>("/api/admin/requests"),
			]);
			setProducts(p.products);
			setRequests(r.requests);
		} catch (e) {
			handleError(e);
		} finally {
			setLoading(false);
		}
	}, [handleError]);
	useEffect(() => {
		api<{ authenticated: boolean }>("/api/session")
			.then((result) => setAuthenticated(result.authenticated))
			.catch(handleError);
	}, [handleError]);
	useEffect(() => {
		if (authenticated) void load();
	}, [authenticated, load]);
	async function logout() {
		try {
			await api("/api/logout", { method: "POST" });
			setAuthenticated(false);
			setProducts([]);
			setRequests([]);
		} catch (e) {
			handleError(e);
		}
	}
	return (
		<>
			<header className="site-header shell">
				<a href="/" className="wordmark">
					garage<span className="wordmark-dot">.</span>
				</a>
				<span className="byline">The back room</span>
				<a href="/" className="text-link small">
					View garage <span aria-hidden="true">↗</span>
				</a>
			</header>
			<main id="main-content" className="shell admin-main">
				{authenticated === null ? (
					<div className="empty-state">
						<p>Checking your session…</p>
						<ErrorMessage message={error} />
						{error ? (
							<button type="button" className="button" onClick={() => window.location.reload()}>
								Try again
							</button>
						) : null}
					</div>
				) : !authenticated ? (
					<Login onLogin={() => setAuthenticated(true)} />
				) : (
					<>
						<div className="admin-heading">
							<div>
								<p className="eyebrow">Just for you</p>
								<h1>Your garage.</h1>
							</div>
							<button type="button" className="text-button" onClick={logout}>
								Sign out
							</button>
						</div>
						<nav className="category-nav" aria-label="Admin sections">
							<QueryLink
								navigate={navigate}
								href="/admin"
								className={cn("chip", view === "listings" && "chip-active")}
								aria-current={view === "listings" ? "page" : undefined}
							>
								Listings <span>{products.length}</span>
							</QueryLink>
							<QueryLink
								navigate={navigate}
								href="/admin?view=requests"
								className={cn("chip", view === "requests" && "chip-active")}
								aria-current={view === "requests" ? "page" : undefined}
							>
								Requests <span>{requests.filter((r) => r.status === "new").length} new</span>
							</QueryLink>
						</nav>
						<ErrorMessage message={error} />
						{loading ? (
							<p className="empty-state" role="status">
								Loading your garage…
							</p>
						) : error ? (
							<button type="button" className="button" onClick={load}>
								Reload your garage
							</button>
						) : edit === "new" || editing ? (
							<ProductEditor
								key={edit}
								product={editing}
								categories={[...new Set(products.map((p) => p.category))]}
								cancel={() => navigate("/admin")}
								saved={async () => {
									navigate("/admin");
									await load();
								}}
								sessionExpired={() => setAuthenticated(false)}
							/>
						) : view === "listings" ? (
							<>
								<div className="admin-toolbar">
									<p className="small text-secondary">
										Only available listings appear in the garage.
									</p>
									<QueryLink navigate={navigate} href="/admin?edit=new" className="button">
										New listing <span aria-hidden="true">+</span>
									</QueryLink>
								</div>
								{products.length ? (
									<div className="admin-list">
										{products.map((p) => (
											<article key={p.id} className="admin-product">
												<Photo product={p} />
												<div>
													<p className="small text-secondary">
														{p.category} / {p.brand}
													</p>
													<h2>{p.title}</h2>
													<p className="small">
														{money(p.pricePaise)}{" "}
														<span className="text-secondary">· {p.status}</span>
													</p>
												</div>
												<QueryLink
													navigate={navigate}
													href={`/admin?edit=${p.id}`}
													className="text-link"
												>
													Edit <span className="sr-only">{p.title}</span>
													<Arrow />
												</QueryLink>
											</article>
										))}
									</div>
								) : (
									<div className="empty-state">
										<BoxIcon className="size-10" />
										<h2>Make a little room.</h2>
										<p>List your first thing. Its category will appear automatically.</p>
										<QueryLink navigate={navigate} href="/admin?edit=new" className="button">
											Create your first listing <Arrow />
										</QueryLink>
									</div>
								)}
							</>
						) : (
							<>
								<div className="admin-toolbar">
									<p className="small text-secondary">
										Requests don’t reserve items. Confirm availability before arranging a handover.
									</p>
									<button type="button" className="text-button" onClick={load}>
										Refresh
									</button>
								</div>
								{requests.length ? (
									<div className="requests-list">
										{requests.map((request) => (
											<RequestCard
												key={request.id}
												request={request}
												updated={load}
												sessionExpired={() => setAuthenticated(false)}
											/>
										))}
									</div>
								) : (
									<div className="empty-state">
										<BoxIcon className="size-10" />
										<h2>No boxes waiting yet.</h2>
										<p>Requests will appear here when someone sends their box.</p>
										<a href="/" className="text-link">
											View your garage <Arrow />
										</a>
									</div>
								)}
							</>
						)}
					</>
				)}
			</main>
		</>
	);
}

function Login({ onLogin }: { onLogin: () => void }) {
	const [error, setError] = useState("");
	const [sending, setSending] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setSending(true);
		setError("");
		try {
			await api("/api/login", {
				method: "POST",
				body: JSON.stringify({ password: new FormData(form).get("password") }),
			});
			form.reset();
			onLogin();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Sign in failed. Try again.");
		} finally {
			setSending(false);
		}
	}
	return (
		<section className="login-panel">
			<BoxIcon className="size-8" />
			<p className="eyebrow">The back room</p>
			<h1>Hello, Shreyas.</h1>
			<p className="text-secondary">Sign in to list things and look through requests.</p>
			<form onSubmit={submit}>
				<input
					type="text"
					name="username"
					autoComplete="username"
					value="Shreyas"
					readOnly
					hidden
				/>
				<label>
					Password
					<input
						name="password"
						type="password"
						autoComplete="current-password"
						required
						maxLength={256}
					/>
				</label>
				<ErrorMessage message={error} />
				<button type="submit" className="button full-width" disabled={sending}>
					{sending ? "Signing in…" : "Sign in"}
					<Arrow />
				</button>
			</form>
			<a href="/" className="text-link small">
				Back to the garage
			</a>
		</section>
	);
}

function ProductEditor({
	product,
	categories,
	cancel,
	saved,
	sessionExpired,
}: {
	product?: Product;
	categories: string[];
	cancel: () => void;
	saved: () => Promise<void>;
	sessionExpired: () => void;
}) {
	const [free, setFree] = useState(product ? product.pricePaise === 0 : false);
	const [imageKey, setImageKey] = useState(product?.imageKey ?? null);
	const [file, setFile] = useState<File | null>(null);
	const [filePreview, setFilePreview] = useState("");
	const [error, setError] = useState("");
	const [sending, setSending] = useState(false);
	useEffect(() => {
		if (!file) {
			setFilePreview("");
			return;
		}
		const url = URL.createObjectURL(file);
		setFilePreview(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const price = String(data.get("price") ?? "");
		if (!free && !/^\d+(\.\d{1,2})?$/.test(price)) {
			setError("Enter a price with up to 2 decimal places, or choose free.");
			return;
		}
		setSending(true);
		setError("");
		try {
			let key = imageKey;
			if (file) {
				const result = await api<{ key: string }>("/api/admin/photos", {
					method: "POST",
					body: file,
				});
				key = result.key;
				setImageKey(key);
				setFile(null);
			}
			await api(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
				method: product ? "PUT" : "POST",
				body: JSON.stringify({
					title: data.get("title"),
					description: data.get("description"),
					category: data.get("category"),
					brand: data.get("brand"),
					originalUrl: data.get("originalUrl"),
					pricePaise: free ? 0 : Math.round(Number(price) * 100),
					imageKey: key,
					status: data.get("status") as ProductStatus,
				}),
			});
			await saved();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) sessionExpired();
			setError(e instanceof Error ? e.message : "Could not save your listing. Try again.");
		} finally {
			setSending(false);
		}
	}
	return (
		<section className="editor">
			<div className="editor-heading">
				<h2>{product ? "Edit this thing" : "Something to pass on"}</h2>
				<button type="button" className="text-button" onClick={cancel}>
					Back to listings
				</button>
			</div>
			<form onSubmit={submit}>
				<div className="editor-grid">
					<div className="editor-photo">
						<div className="product-photo">
							{filePreview || imageKey ? (
								<img
									src={filePreview || `/api/images/${imageKey}`}
									alt="Listing preview"
									width={800}
									height={800}
								/>
							) : (
								<div className="photo-placeholder">
									<BoxIcon className="size-12" />
									<span>A photo makes all the difference.</span>
								</div>
							)}
						</div>
						<label>
							Product photo
							<input
								type="file"
								name="photo"
								accept="image/jpeg,image/png,image/webp"
								onChange={(e) => {
									const next = e.target.files?.[0] ?? null;
									if (
										next &&
										(next.size > 4 * 1024 * 1024 ||
											!["image/jpeg", "image/png", "image/webp"].includes(next.type))
									) {
										setError("Choose a JPG, PNG, or WebP photo under 4 MB.");
										e.target.value = "";
										return;
									}
									setFile(next);
									setError("");
								}}
							/>
						</label>
						<p className="small text-secondary">
							JPG, PNG, or WebP. Up to 4 MB. Photos are optional.
						</p>
						{imageKey || file ? (
							<button
								type="button"
								className="text-button small"
								onClick={() => {
									setImageKey(null);
									setFile(null);
								}}
							>
								Remove photo
							</button>
						) : null}
					</div>
					<div className="editor-fields">
						<label>
							Product name
							<input
								name="title"
								defaultValue={product?.title}
								required
								maxLength={120}
								autoComplete="off"
								placeholder="e.g. V60 coffee dripper…"
							/>
						</label>
						<label>
							Description
							<textarea
								name="description"
								defaultValue={product?.description}
								required
								maxLength={4000}
								rows={5}
								placeholder="Condition, what’s included, and anything worth knowing…"
							/>
						</label>
						<div className="form-row">
							<label>
								Category
								<input
									name="category"
									defaultValue={product?.category}
									required
									maxLength={50}
									list="categories"
									autoComplete="off"
									placeholder="e.g. Coffee…"
								/>
								<datalist id="categories">
									{categories.map((c) => (
										<option value={c} key={c} />
									))}
								</datalist>
							</label>
							<label>
								Original brand
								<input
									name="brand"
									defaultValue={product?.brand}
									required
									maxLength={80}
									autoComplete="off"
									placeholder="e.g. Hario…"
								/>
							</label>
						</div>
						<label>
							Original product link
							<input
								name="originalUrl"
								type="url"
								defaultValue={product?.originalUrl}
								required
								pattern="https://.*"
								maxLength={2000}
								autoComplete="off"
								placeholder="https://…"
							/>
						</label>
						<div className="form-row">
							<label>
								Price (₹)
								<input
									name="price"
									type="number"
									min="0.01"
									max="10000000"
									step="0.01"
									inputMode="decimal"
									disabled={free}
									required={!free}
									defaultValue={product ? product.pricePaise / 100 : ""}
									placeholder="0…"
								/>
							</label>
							<label className="checkbox-label free-checkbox">
								<input
									name="free"
									type="checkbox"
									checked={free}
									onChange={(e) => setFree(e.target.checked)}
								/>
								Give it away for free
							</label>
						</div>
						<label>
							Availability
							<select name="status" defaultValue={product?.status ?? "draft"}>
								<option value="draft">Draft — only visible to you</option>
								<option value="available">Available — show in the garage</option>
								<option value="reserved">Reserved — hide from the garage</option>
								<option value="gone">Gone — hide from the garage</option>
							</select>
						</label>
					</div>
				</div>
				<ErrorMessage message={error} />
				<div className="editor-actions">
					<button type="button" className="text-button" onClick={cancel}>
						Cancel
					</button>
					<button type="submit" className="button" disabled={sending}>
						{sending ? "Saving your listing…" : "Save listing"}
						<Arrow />
					</button>
				</div>
			</form>
		</section>
	);
}

function RequestCard({
	request,
	updated,
	sessionExpired,
}: {
	request: GarageRequest;
	updated: () => Promise<void>;
	sessionExpired: () => void;
}) {
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	async function update(status: string) {
		setSending(true);
		setError("");
		try {
			await api(`/api/admin/requests/${request.id}`, {
				method: "PATCH",
				body: JSON.stringify({ status }),
			});
			await updated();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) sessionExpired();
			setError(e instanceof Error ? e.message : "Could not update the request. Try again.");
		} finally {
			setSending(false);
		}
	}
	return (
		<article className="request-card">
			<div className="request-card-heading">
				<div>
					<p className="small text-secondary">
						{new Intl.DateTimeFormat("en-IN", {
							dateStyle: "medium",
							timeStyle: "short",
							timeZone: "Asia/Kolkata",
						}).format(new Date(request.createdAt))}{" "}
						IST · #{request.id.slice(0, 8)}
					</p>
					<h2>{request.name}</h2>
					<p className="text-secondary">{request.city}</p>
				</div>
				<span className={cn("status-tag", request.status === "new" && "status-new")}>
					{request.status}
				</span>
			</div>
			<ul>
				{request.items.map((p) => (
					<li key={p.id}>
						<span>{p.title}</span>
						<span>{money(p.pricePaise)}</span>
					</li>
				))}
			</ul>
			<p className="request-total">
				Requested total{" "}
				<strong>{money(request.items.reduce((sum, p) => sum + p.pricePaise, 0))}</strong>
			</p>
			<div className="request-contacts">
				{request.whatsapp ? (
					<a
						href={`https://wa.me/${request.whatsapp.replace(/\D/g, "")}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-link"
					>
						WhatsApp: {request.whatsapp} <span aria-hidden="true">↗</span>
					</a>
				) : null}
				{request.email ? (
					<a href={`mailto:${request.email}`} className="text-link">
						{request.email} <span aria-hidden="true">↗</span>
					</a>
				) : null}
			</div>
			<label className="request-status">
				Request status
				<select value={request.status} onChange={(e) => update(e.target.value)} disabled={sending}>
					<option value="new">New</option>
					<option value="contacted">Contacted</option>
					<option value="closed">Closed</option>
				</select>
			</label>
			<ErrorMessage message={error} />
		</article>
	);
}
