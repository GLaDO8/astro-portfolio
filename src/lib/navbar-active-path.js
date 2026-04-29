export function isNavbarLinkActive(href, pathname) {
	if (href === "/") {
		return pathname === href;
	}

	return pathname === href || pathname.startsWith(`${href}/`);
}
