const codeFencePattern = /(?:^|\n)[ \t]{0,3}(?:```|~~~)/;

export function hasCodeFence(content: string | undefined): boolean {
	return codeFencePattern.test(content ?? "");
}
