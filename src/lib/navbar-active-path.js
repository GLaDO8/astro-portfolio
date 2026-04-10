const navbarAliases = {
	"/work": ["/case-studies"],
};

export function isNavbarLinkActive(href, pathname) {
	if (href === "/") {
		return pathname === href;
	}

	const candidatePrefixes = [href, ...(navbarAliases[href] ?? [])];

	return candidatePrefixes.some((prefix) => {
		return pathname === prefix || pathname.startsWith(`${prefix}/`);
	});
}
