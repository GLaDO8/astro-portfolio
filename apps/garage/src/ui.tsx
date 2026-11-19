import { cn } from "cn";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import type { Product } from "./types";

export function BoxIcon({ className }: { className?: string }) {
	return (
		<svg
			className={cn("size-5", className)}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5" />
		</svg>
	);
}
export function Arrow({ className }: { className?: string }) {
	return (
		<svg
			className={cn("size-4", className)}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			aria-hidden="true"
		>
			<path d="M5 12h14m-6-6 6 6-6 6" />
		</svg>
	);
}
export function ErrorMessage({ message }: { message: string }) {
	const ref = useRef<HTMLParagraphElement>(null);
	useEffect(() => {
		if (message) ref.current?.focus();
	}, [message]);
	return message ? (
		<p ref={ref} tabIndex={-1} role="alert" className="form-error">
			{message}
		</p>
	) : null;
}
export function Photo({
	product,
	className,
	eager = false,
}: {
	product: Pick<Product, "imageKey" | "title">;
	className?: string;
	eager?: boolean;
}) {
	return (
		<div className={cn("product-photo", className)}>
			{product.imageKey ? (
				<img
					src={`/api/images/${product.imageKey}`}
					alt={product.title}
					width={800}
					height={800}
					loading={eager ? "eager" : "lazy"}
				/>
			) : (
				<div className="photo-placeholder">
					<BoxIcon className="size-12" />
					<span>Photo coming soon</span>
				</div>
			)}
		</div>
	);
}
export function Modal({
	children,
	title,
	close,
	drawer = false,
}: {
	children: ReactNode;
	title: string;
	close: () => void;
	drawer?: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const dialog = ref.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, []);
	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			className={cn("modal", drawer && "drawer")}
			onCancel={(event) => {
				event.preventDefault();
				close();
			}}
		>
			<div className="modal-header">
				<h2 id={titleId}>{title}</h2>
				<button type="button" className="icon-button" onClick={close} aria-label="Close">
					<span aria-hidden="true">×</span>
				</button>
			</div>
			{children}
		</dialog>
	);
}
