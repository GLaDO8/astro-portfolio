const entries = [
	[
		"2026-01-01-2026-01-15",
		9161099,
		"7537175c47a816fc6ac5f4fd923261b92f690798d564eb75c9ffd397aededc84",
	],
	[
		"2026-01-16-2026-01-31",
		11560396,
		"2c443b8e69410a7656c0d770e28f746dc82529fcf29c87db2bb9ee242a1bcec6",
	],
	[
		"2026-02-01-2026-02-15",
		11284877,
		"7ceefd96ce312b53d8f73cad01689b587da0a03f3479a7034001eddd8c372057",
	],
	[
		"2026-02-16-2026-02-28",
		9176881,
		"61dd99e1313b744aaac796071c181513ce87a559e63459b72f0b0a98cbf199d8",
	],
	[
		"2026-03-01-2026-03-15",
		10036382,
		"dc81a56b3bf8bce677d7a602291b5508acb0f2ba7dd6f1ba23ccc98b30767308",
	],
	[
		"2026-03-16-2026-03-31",
		11368970,
		"5a9b7b7265b21357b9abb1d4db018192423d3517ada1cfc5cd80d0a4865161a7",
	],
	[
		"2026-04-01-2026-04-15",
		10906682,
		"c94499b9f17c78f0b4785862b7c48a97ca1c69da74cab805a1c8491165197e09",
	],
	[
		"2026-04-16-2026-04-30",
		8959474,
		"c7812ced550379fe9fe478b593d92d6d34817cc36ea3cc3abd4464e51dff9356",
	],
	[
		"2026-05-01-2026-05-15",
		10499997,
		"f1da223496caca4617adf395793dda481123092e2c665dd5d260d19df5ef9dcf",
	],
	[
		"2026-05-16-2026-05-31",
		12028447,
		"2b363a398039486dbc2cc523487db27477ce59a4f0a6c5fb68e9682d1dc9fc35",
	],
	[
		"2026-06-01-2026-06-15",
		10917703,
		"f195cefc0f9770ef32efb6d2479884b27357f4ffa34838f2f053a23a8a9cb1b4",
	],
	[
		"2026-06-16-2026-06-30",
		12661265,
		"aa6a2f1a47eb758605adfddb9ea2f1a399c65e7b2076d6a8e32b613928ecb64f",
	],
	[
		"2026-07-01-2026-07-15",
		13474287,
		"61fdada58bf12763c8056a4f94872632717c22f32b9ba42c3adb9a6ed0281c70",
	],
	[
		"2026-07-16-2026-07-31",
		13301430,
		"14c40ec7d242b4b201b2ee0137153746cf26eecf0c62eb0b49174affc5f298a4",
	],
	[
		"2026-01-01-2026-07-31",
		5861,
		"c0ac50ae2fceeef997a70a4aa47f28c5c199f91d230117c8e2a214a191cb39cb",
		1786638077097,
	],
];

export const HEALTH_EXPORT_MANIFEST = Object.freeze(
	entries.map(([range, sizeBytes, payloadSha256, receivedAtMs]) => {
		const basename = `HealthAutoExport-${range}`;
		return Object.freeze({
			basename,
			sizeBytes,
			payloadSha256,
			receivedAtMs,
			objectKey: `manual-import-${basename}-${payloadSha256.slice(0, 16)}.json`,
		});
	}),
);

export const HEALTH_EXPORT_MANIFEST_BY_HASH = new Map(
	HEALTH_EXPORT_MANIFEST.map((entry) => [entry.payloadSha256, entry]),
);
