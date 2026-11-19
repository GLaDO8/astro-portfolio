import type { AnchorHTMLAttributes } from "react";
import { useEffect, useState } from "react";

export function useQuery() {
	const [query, setQuery] = useState(() => window.location.search);
	useEffect(() => {
		const sync = () => setQuery(window.location.search);
		window.addEventListener("popstate", sync);
		return () => window.removeEventListener("popstate", sync);
	}, []);
	const navigate = (href: string) => {
		window.history.pushState(null, "", href);
		setQuery(window.location.search);
	};
	return { params: new URLSearchParams(query), navigate };
}
export function QueryLink({
	navigate,
	href,
	onClick,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { navigate: (href: string) => void; href: string }) {
	return (
		<a
			{...props}
			href={href}
			onClick={(event) => {
				onClick?.(event);
				if (
					event.defaultPrevented ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					event.button !== 0
				)
					return;
				event.preventDefault();
				navigate(href);
			}}
		/>
	);
}
