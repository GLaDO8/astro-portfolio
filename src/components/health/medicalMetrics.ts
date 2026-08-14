interface MedicalDefinition {
	title: string;
	description: string;
	color: string;
}

export const medicalDefinitions = {
	cholesterol_total: {
		title: "Total cholesterol",
		description: "Cholesterol carried across the major lipoprotein particles.",
		color: "var(--color-health-warm)",
	},
	cholesterol_hdl: {
		title: "HDL cholesterol",
		description: "Cholesterol carried in high-density lipoprotein particles.",
		color: "var(--color-health-green)",
	},
	cholesterol_ldl_calculated: {
		title: "Calculated LDL cholesterol",
		description: "Lab-estimated cholesterol carried in LDL particles.",
		color: "var(--color-health-blue)",
	},
	cholesterol_vldl_calculated: {
		title: "Calculated VLDL cholesterol",
		description: "Lab-estimated cholesterol carried in very-low-density lipoprotein particles.",
		color: "var(--color-health-gold)",
	},
	cholesterol_non_hdl: {
		title: "Non-HDL cholesterol",
		description: "Total cholesterol minus HDL, including LDL and other atherogenic particles.",
		color: "var(--color-health-teal)",
	},
	triglycerides: {
		title: "Triglycerides",
		description: "Circulating triglyceride concentration; meals and fasting status can affect it.",
		color: "var(--color-health-warm)",
	},
	hba1c: {
		title: "HbA1c",
		description: "Estimated average glucose exposure over roughly two to three months.",
		color: "var(--color-health-warm)",
	},
	rbc_count: {
		title: "Red blood cell count",
		description: "The number of red blood cells per blood volume.",
		color: "var(--color-health-warm)",
	},
	hemoglobin: {
		title: "Hemoglobin",
		description: "Concentration of the oxygen-carrying protein in red blood cells.",
		color: "var(--color-health-warm)",
	},
	hematocrit: {
		title: "Hematocrit",
		description: "Percentage of blood volume occupied by red blood cells.",
		color: "var(--color-health-warm)",
	},
	mcv: {
		title: "Mean corpuscular volume",
		description: "Average red blood cell size.",
		color: "var(--color-health-blue)",
	},
	mch: {
		title: "Mean corpuscular hemoglobin",
		description: "Average amount of hemoglobin in each red blood cell.",
		color: "var(--color-health-blue)",
	},
	mchc: {
		title: "Mean corpuscular hemoglobin concentration",
		description: "Average hemoglobin concentration within red blood cells.",
		color: "var(--color-health-blue)",
	},
	rdw_cv: {
		title: "Red cell distribution width",
		description: "Variation in red blood cell size.",
		color: "var(--color-health-gold)",
	},
	wbc_count: {
		title: "White blood cell count",
		description: "Total number of white blood cells per blood volume.",
		color: "var(--color-health-teal)",
	},
	neutrophils_percent: {
		title: "Neutrophils",
		description: "Neutrophils as a percentage of white blood cells.",
		color: "var(--color-health-blue)",
	},
	lymphocytes_percent: {
		title: "Lymphocytes",
		description: "Lymphocytes as a percentage of white blood cells.",
		color: "var(--color-health-green)",
	},
	monocytes_percent: {
		title: "Monocytes",
		description: "Monocytes as a percentage of white blood cells.",
		color: "var(--color-health-gold)",
	},
	eosinophils_percent: {
		title: "Eosinophils",
		description: "Eosinophils as a percentage of white blood cells.",
		color: "var(--color-health-warm)",
	},
	basophils_percent: {
		title: "Basophils",
		description: "Basophils as a percentage of white blood cells.",
		color: "var(--color-health-teal)",
	},
	absolute_neutrophil_count: {
		title: "Absolute neutrophil count",
		description: "Number of neutrophils per blood volume.",
		color: "var(--color-health-blue)",
	},
	absolute_lymphocyte_count: {
		title: "Absolute lymphocyte count",
		description: "Number of lymphocytes per blood volume.",
		color: "var(--color-health-green)",
	},
	absolute_monocyte_count: {
		title: "Absolute monocyte count",
		description: "Number of monocytes per blood volume.",
		color: "var(--color-health-gold)",
	},
	absolute_eosinophil_count: {
		title: "Absolute eosinophil count",
		description: "Number of eosinophils per blood volume.",
		color: "var(--color-health-warm)",
	},
	absolute_basophil_count: {
		title: "Absolute basophil count",
		description: "Number of basophils per blood volume.",
		color: "var(--color-health-teal)",
	},
	platelet_count: {
		title: "Platelet count",
		description: "Number of platelets per blood volume.",
		color: "var(--color-health-gold)",
	},
	mean_platelet_volume: {
		title: "Mean platelet volume",
		description: "Average platelet size; the valid interval depends on the analyzer.",
		color: "var(--color-health-blue)",
	},
	alt: {
		title: "Alanine aminotransferase",
		description: "Liver-associated enzyme that can rise with liver-cell injury.",
		color: "var(--color-health-warm)",
	},
	ast: {
		title: "Aspartate aminotransferase",
		description: "Enzyme found in liver, muscle, and other tissues.",
		color: "var(--color-health-warm)",
	},
	alkaline_phosphatase: {
		title: "Alkaline phosphatase",
		description: "Enzyme associated mainly with bile ducts and bone.",
		color: "var(--color-health-gold)",
	},
	ggt: {
		title: "Gamma-glutamyl transferase",
		description: "Enzyme associated mainly with the liver and bile ducts.",
		color: "var(--color-health-teal)",
	},
	bilirubin_total: {
		title: "Total bilirubin",
		description: "Total circulating bilirubin from red-cell breakdown.",
		color: "var(--color-health-gold)",
	},
	bilirubin_direct: {
		title: "Direct bilirubin",
		description: "Bilirubin processed by the liver into a water-soluble form.",
		color: "var(--color-health-green)",
	},
	bilirubin_indirect: {
		title: "Indirect bilirubin",
		description: "Unconjugated bilirubin before liver processing.",
		color: "var(--color-health-warm)",
	},
	albumin: {
		title: "Albumin",
		description: "Major blood protein made by the liver and affected by several other factors.",
		color: "var(--color-health-blue)",
	},
	globulin: {
		title: "Globulin",
		description: "Combined concentration of several non-albumin blood proteins.",
		color: "var(--color-health-green)",
	},
	protein_total: {
		title: "Total protein",
		description: "Combined albumin and globulin concentration.",
		color: "var(--color-health-teal)",
	},
	creatinine_serum: {
		title: "Serum creatinine",
		description: "A muscle-metabolism waste product cleared by the kidneys.",
		color: "var(--color-health-warm)",
	},
	egfr: {
		title: "Estimated glomerular filtration rate",
		description: "Calculated estimate of kidney filtration; the equation can vary by report.",
		color: "var(--color-health-blue)",
	},
	bun: {
		title: "Blood urea nitrogen",
		description: "Nitrogen from urea in blood, influenced by kidney handling and hydration.",
		color: "var(--color-health-gold)",
	},
	urea: {
		title: "Urea",
		description: "Total blood urea concentration, reported on a different scale from BUN.",
		color: "var(--color-health-gold)",
	},
	uric_acid: {
		title: "Uric acid",
		description: "End product of purine breakdown, cleared mainly through the kidneys.",
		color: "var(--color-health-teal)",
	},
	sodium: {
		title: "Sodium",
		description: "An electrolyte involved in fluid balance and nerve and muscle function.",
		color: "var(--color-health-blue)",
	},
	potassium: {
		title: "Potassium",
		description: "An electrolyte involved in nerve, muscle, and heart electrical function.",
		color: "var(--color-health-green)",
	},
	chloride: {
		title: "Chloride",
		description: "An electrolyte involved in fluid and acid-base balance.",
		color: "var(--color-health-teal)",
	},
	calcium: {
		title: "Total calcium",
		description: "Total blood calcium, including protein-bound and free calcium.",
		color: "var(--color-health-gold)",
	},
	phosphorus: {
		title: "Phosphorus",
		description: "Blood phosphate involved in bone, energy metabolism, and cell function.",
		color: "var(--color-health-blue)",
	},
	tsh: {
		title: "Thyroid-stimulating hormone",
		description: "Pituitary hormone that signals the thyroid to produce thyroid hormones.",
		color: "var(--color-health-warm)",
	},
	t3_total: {
		title: "Total T3",
		description: "Total protein-bound and free triiodothyronine in blood.",
		color: "var(--color-health-green)",
	},
	t4_total: {
		title: "Total T4",
		description: "Total protein-bound and free thyroxine in blood.",
		color: "var(--color-health-blue)",
	},
	iron_serum: {
		title: "Serum iron",
		description: "Iron circulating in blood, affected by timing, food, and supplements.",
		color: "var(--color-health-warm)",
	},
	tibc: {
		title: "Total iron-binding capacity",
		description: "Estimated total capacity of blood proteins to bind iron.",
		color: "var(--color-health-blue)",
	},
	uibc: {
		title: "Unsaturated iron-binding capacity",
		description: "Iron-binding capacity that is not occupied by iron.",
		color: "var(--color-health-teal)",
	},
	transferrin_saturation: {
		title: "Transferrin saturation",
		description: "Calculated percentage of iron-binding sites occupied by iron.",
		color: "var(--color-health-gold)",
	},
	vitamin_b12: {
		title: "Vitamin B12",
		description: "Blood concentration of a vitamin needed for red-cell formation and nerves.",
		color: "var(--color-health-green)",
	},
	vitamin_d_25_oh: {
		title: "25-hydroxy vitamin D",
		description: "The main circulating measurement used to assess vitamin D status.",
		color: "var(--color-health-gold)",
	},
} as const satisfies Record<string, MedicalDefinition>;

export type MedicalMetricCode = keyof typeof medicalDefinitions;

interface MedicalGroup {
	title?: string;
	codes: readonly MedicalMetricCode[];
}

interface MedicalSection {
	title: string;
	groups: readonly MedicalGroup[];
}

export const medicalSections = [
	{
		title: "Lipid Profile",
		groups: [
			{
				codes: [
					"cholesterol_total",
					"cholesterol_hdl",
					"cholesterol_ldl_calculated",
					"cholesterol_vldl_calculated",
					"cholesterol_non_hdl",
					"triglycerides",
				],
			},
		],
	},
	{
		title: "Complete Blood Count",
		groups: [
			{
				title: "Red blood cells",
				codes: ["rbc_count", "hemoglobin", "hematocrit", "mcv", "mch", "mchc", "rdw_cv"],
			},
			{
				title: "White blood cells",
				codes: [
					"wbc_count",
					"neutrophils_percent",
					"lymphocytes_percent",
					"monocytes_percent",
					"eosinophils_percent",
					"basophils_percent",
					"absolute_neutrophil_count",
					"absolute_lymphocyte_count",
					"absolute_monocyte_count",
					"absolute_eosinophil_count",
					"absolute_basophil_count",
				],
			},
			{
				title: "Platelets",
				codes: ["platelet_count", "mean_platelet_volume"],
			},
		],
	},
	{
		title: "Liver Function",
		groups: [
			{
				title: "Enzymes",
				codes: ["alt", "ast", "alkaline_phosphatase", "ggt"],
			},
			{
				title: "Bilirubin",
				codes: ["bilirubin_total", "bilirubin_direct", "bilirubin_indirect"],
			},
			{
				title: "Blood proteins",
				codes: ["albumin", "globulin", "protein_total"],
			},
		],
	},
	{
		title: "Kidney Function and Minerals",
		groups: [
			{
				title: "Filtration and waste products",
				codes: ["creatinine_serum", "egfr", "bun", "urea", "uric_acid"],
			},
			{
				title: "Electrolytes and minerals",
				codes: ["sodium", "potassium", "chloride", "calcium", "phosphorus"],
			},
		],
	},
	{
		title: "Thyroid",
		groups: [{ codes: ["tsh", "t3_total", "t4_total"] }],
	},
	{
		title: "Iron and Vitamins",
		groups: [
			{
				codes: [
					"iron_serum",
					"tibc",
					"uibc",
					"transferrin_saturation",
					"vitamin_b12",
					"vitamin_d_25_oh",
				],
			},
		],
	},
	{
		title: "Glucose",
		groups: [{ codes: ["hba1c"] }],
	},
] as const satisfies readonly MedicalSection[];
