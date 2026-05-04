const DEV_OVERLAY_STYLE_IDS = new Set(["agentation-color-tokens", "mesurer-styles"]);
const DEV_OVERLAY_STYLE_PREFIXES = ["feedback-tool-styles-"];

const isDevOverlayStyle = (node) => {
	const id = node?.id;

	if (!id) {
		return false;
	}

	return (
		DEV_OVERLAY_STYLE_IDS.has(id) ||
		DEV_OVERLAY_STYLE_PREFIXES.some((prefix) => id.startsWith(prefix))
	);
};

const getDocument = () => (typeof document === "undefined" ? undefined : document);

const getDevOverlayStyles = (sourceDocument = getDocument()) => {
	const styles = sourceDocument?.head?.querySelectorAll?.("style[id]");

	if (!styles) {
		return [];
	}

	return Array.from(styles).filter(isDevOverlayStyle);
};

const createStyleElement = (targetDocument, id, textContent) => {
	const style = targetDocument.createElement("style");
	style.id = id;
	style.textContent = textContent;
	style.dataset.devOverlayStyle = "true";
	return style;
};

export const createDevOverlayStylePreserver = () => {
	const styleTextById = new Map();

	const snapshot = (sourceDocument = getDocument()) => {
		for (const style of getDevOverlayStyles(sourceDocument)) {
			styleTextById.set(style.id, style.textContent ?? "");
		}

		return styleTextById.size;
	};

	const restore = (targetDocument = getDocument()) => {
		if (!targetDocument?.head) {
			return 0;
		}

		let restoredCount = 0;

		for (const [id, textContent] of styleTextById) {
			if (targetDocument.getElementById(id)) {
				continue;
			}

			targetDocument.head.appendChild(createStyleElement(targetDocument, id, textContent));
			restoredCount += 1;
		}

		return restoredCount;
	};

	const copy = ({ sourceDocument = getDocument(), targetDocument = getDocument() } = {}) => {
		snapshot(sourceDocument);
		return restore(targetDocument);
	};

	return {
		copy,
		restore,
		snapshot,
	};
};

export const devOverlayStylePreserver = createDevOverlayStylePreserver();
