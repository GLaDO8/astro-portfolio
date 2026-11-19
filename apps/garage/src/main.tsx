import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Marketplace from "./Marketplace";
import "./style.css";

const Admin = lazy(() => import("./Admin"));
const isAdmin = window.location.pathname.replace(/\/$/, "") === "/admin";
if (isAdmin) document.title = "Garage admin — Shreyas";
const root = document.getElementById("root");
if (root)
	createRoot(root).render(
		<>
			<a href="#main-content" className="skip-link">
				Skip to content
			</a>
			{isAdmin ? (
				<Suspense fallback={<p className="shell empty-state">Opening admin…</p>}>
					<Admin />
				</Suspense>
			) : window.location.pathname !== "/" ? (
				<main id="main-content" className="shell empty-state">
					<h1>Nothing in this corner.</h1>
					<a href="/" className="text-link">
						Back to the garage
					</a>
				</main>
			) : (
				<Marketplace />
			)}
		</>,
	);
