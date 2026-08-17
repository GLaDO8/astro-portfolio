import type { MedicalMetricCode } from "./medicalMetrics";

export type ReferenceBandTone = "low" | "reference" | "caution" | "high";

export interface ReferenceBand {
	label: string;
	min?: number;
	max?: number;
	tone: ReferenceBandTone;
}

interface MedicalReferenceRange {
	unit: string;
	basis: "guideline" | "adult-male" | "source-lab-consensus";
	summary: string;
	bands: readonly ReferenceBand[];
}

const interval = (
	min: number,
	max: number,
	labels: [string, string, string] = ["Below reference", "Reference interval", "Above reference"],
): ReferenceBand[] => [
	{ label: labels[0], max: min, tone: "low" },
	{ label: labels[1], min, max, tone: "reference" },
	{ label: labels[2], min: max, tone: "high" },
];

const upperLimit = (
	max: number,
	labels: [string, string] = ["Reference", "Above reference"],
): ReferenceBand[] => [
	{ label: labels[0], max, tone: "reference" },
	{ label: labels[1], min: max, tone: "high" },
];

// These generalized chart bands do not replace the interval printed on a source report.
// Guideline bands come from NIDDK, NHLBI, NKF, and NIH ODS. Other intervals are adult-male
// examples selected after comparing the imported Tata 1mg, Vijaya, and Orange Health reports
// with the clinical references listed in workers/health-ingest/MEDICAL_METRICS.md.
export const medicalReferenceRanges = {
	cholesterol_total: {
		unit: "mg/dL",
		basis: "guideline",
		summary: "Desirable <200 · borderline 200–239 · high ≥240",
		bands: [
			{ label: "Desirable", max: 200, tone: "reference" },
			{ label: "Borderline high", min: 200, max: 240, tone: "caution" },
			{ label: "High", min: 240, tone: "high" },
		],
	},
	cholesterol_hdl: {
		unit: "mg/dL",
		basis: "guideline",
		summary: "Low <40 · typical 40–59 · favorable ≥60",
		bands: [
			{ label: "Low", max: 40, tone: "low" },
			{ label: "Typical", min: 40, max: 60, tone: "reference" },
			{ label: "Favorable", min: 60, tone: "reference" },
		],
	},
	cholesterol_ldl_calculated: {
		unit: "mg/dL",
		basis: "guideline",
		summary:
			"Optimal <100 · near optimal 100–129 · borderline 130–159 · high 160–189 · very high ≥190",
		bands: [
			{ label: "Optimal", max: 100, tone: "reference" },
			{ label: "Near optimal", min: 100, max: 130, tone: "reference" },
			{ label: "Borderline high", min: 130, max: 160, tone: "caution" },
			{ label: "High", min: 160, max: 190, tone: "high" },
			{ label: "Very high", min: 190, tone: "high" },
		],
	},
	cholesterol_vldl_calculated: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab upper limit 30; calculation method varies",
		bands: upperLimit(30),
	},
	cholesterol_non_hdl: {
		unit: "mg/dL",
		basis: "guideline",
		summary: "General goal <130; individual targets depend on cardiovascular risk",
		bands: upperLimit(130, ["General goal", "Above general goal"]),
	},
	triglycerides: {
		unit: "mg/dL",
		basis: "guideline",
		summary: "Normal <150 · borderline 150–199 · high 200–499 · very high ≥500",
		bands: [
			{ label: "Normal", max: 150, tone: "reference" },
			{ label: "Borderline high", min: 150, max: 200, tone: "caution" },
			{ label: "High", min: 200, max: 500, tone: "high" },
			{ label: "Very high", min: 500, tone: "high" },
		],
	},
	hba1c: {
		unit: "%",
		basis: "guideline",
		summary:
			"Normal <5.7 · prediabetes 5.7–6.4 · diabetes ≥6.5; diagnosis usually requires confirmation",
		bands: [
			{ label: "Normal", max: 5.7, tone: "reference" },
			{ label: "Prediabetes", min: 5.7, max: 6.5, tone: "caution" },
			{ label: "Diabetes threshold", min: 6.5, tone: "high" },
		],
	},
	rbc_count: {
		unit: "million/mm3",
		basis: "adult-male",
		summary: "Adult male reference example 4.35–5.65",
		bands: interval(4.35, 5.65),
	},
	hemoglobin: {
		unit: "g/dL",
		basis: "adult-male",
		summary: "Adult male reference example 13.2–16.6",
		bands: interval(13.2, 16.6),
	},
	hematocrit: {
		unit: "%",
		basis: "adult-male",
		summary: "Adult male reference example 38.3–48.6",
		bands: interval(38.3, 48.6),
	},
	mcv: {
		unit: "fL",
		basis: "adult-male",
		summary: "Adult reference example 78.2–97.9; analyzer intervals vary",
		bands: interval(78.2, 97.9),
	},
	mch: {
		unit: "pg",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 27–32",
		bands: interval(27, 32),
	},
	mchc: {
		unit: "g/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 32–36",
		bands: interval(32, 36),
	},
	rdw_cv: {
		unit: "%",
		basis: "adult-male",
		summary: "Adult male reference example 11.8–14.5; analyzer intervals vary",
		bands: interval(11.8, 14.5),
	},
	wbc_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 3,400–9,600",
		bands: interval(3400, 9600),
	},
	neutrophils_percent: {
		unit: "%",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 40–80; absolute count is more portable",
		bands: interval(40, 80),
	},
	lymphocytes_percent: {
		unit: "%",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 20–40; absolute count is more portable",
		bands: interval(20, 40),
	},
	monocytes_percent: {
		unit: "%",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 2–10; absolute count is more portable",
		bands: interval(2, 10),
	},
	eosinophils_percent: {
		unit: "%",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 1–6; absolute count is more portable",
		bands: interval(1, 6),
	},
	basophils_percent: {
		unit: "%",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 0–2; absolute count is more portable",
		bands: interval(0, 2),
	},
	absolute_neutrophil_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 1,560–6,450",
		bands: interval(1560, 6450),
	},
	absolute_lymphocyte_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 950–3,070",
		bands: interval(950, 3070),
	},
	absolute_monocyte_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 260–810",
		bands: interval(260, 810),
	},
	absolute_eosinophil_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 30–480",
		bands: interval(30, 480),
	},
	absolute_basophil_count: {
		unit: "cells/mm3",
		basis: "adult-male",
		summary: "Adult reference example 10–80",
		bands: interval(10, 80),
	},
	platelet_count: {
		unit: "10^3/uL",
		basis: "source-lab-consensus",
		summary: "Broad adult source-lab consensus 150–400",
		bands: interval(150, 400),
	},
	mean_platelet_volume: {
		unit: "fL",
		basis: "source-lab-consensus",
		summary: "Source-lab consensus 6.5–12; analyzer-specific",
		bands: interval(6.5, 12),
	},
	alt: {
		unit: "U/L",
		basis: "adult-male",
		summary: "ACG healthy adult male ceiling 33; source-lab upper limits are method-specific",
		bands: upperLimit(33, ["At or below ACG ceiling", "Above ACG ceiling"]),
	},
	ast: {
		unit: "U/L",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 5–34",
		bands: interval(5, 34),
	},
	alkaline_phosphatase: {
		unit: "U/L",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 40–150; assay and bone context matter",
		bands: interval(40, 150),
	},
	ggt: {
		unit: "U/L",
		basis: "source-lab-consensus",
		summary: "Common adult male source-lab interval 12–55; assays vary",
		bands: interval(12, 55),
	},
	bilirubin_total: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 0.3–1.2",
		bands: interval(0.3, 1.2),
	},
	bilirubin_direct: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 0–0.5",
		bands: interval(0, 0.5),
	},
	bilirubin_indirect: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 0–1.8; often calculated",
		bands: interval(0, 1.8),
	},
	albumin: {
		unit: "g/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 3.5–5.0",
		bands: interval(3.5, 5),
	},
	globulin: {
		unit: "g/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 1.8–3.6",
		bands: interval(1.8, 3.6),
	},
	protein_total: {
		unit: "g/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 6.4–8.3",
		bands: interval(6.4, 8.3),
	},
	creatinine_serum: {
		unit: "mg/dL",
		basis: "adult-male",
		summary: "Common adult male source-lab interval 0.6–1.2; interpret with eGFR",
		bands: interval(0.6, 1.2),
	},
	egfr: {
		unit: "mL/min/1.73m2",
		basis: "guideline",
		summary: "NKF G5 <15 · G4 15–29 · G3b 30–44 · G3a 45–59 · G2 60–89 · G1 ≥90",
		bands: [
			{ label: "G5", max: 15, tone: "high" },
			{ label: "G4", min: 15, max: 30, tone: "high" },
			{ label: "G3b", min: 30, max: 45, tone: "caution" },
			{ label: "G3a", min: 45, max: 60, tone: "caution" },
			{ label: "G2", min: 60, max: 90, tone: "reference" },
			{ label: "G1", min: 90, tone: "reference" },
		],
	},
	bun: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 8.9–20.6",
		bands: interval(8.9, 20.6),
	},
	urea: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 19–44",
		bands: interval(19, 44),
	},
	uric_acid: {
		unit: "mg/dL",
		basis: "adult-male",
		summary: "Common adult male source-lab interval 3.7–7.7",
		bands: interval(3.7, 7.7),
	},
	sodium: {
		unit: "mmol/L",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 136–145",
		bands: interval(136, 145),
	},
	potassium: {
		unit: "mmol/L",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 3.5–5.1; specimen handling matters",
		bands: interval(3.5, 5.1),
	},
	chloride: {
		unit: "mmol/L",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 98–107",
		bands: interval(98, 107),
	},
	calcium: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common source-lab interval 8.4–10.2; albumin affects total calcium",
		bands: interval(8.4, 10.2),
	},
	phosphorus: {
		unit: "mg/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 2.5–4.5",
		bands: interval(2.5, 4.5),
	},
	tsh: {
		unit: "uIU/mL",
		basis: "source-lab-consensus",
		summary: "Common adult assay interval 0.4–4.5; age, pregnancy, and assay matter",
		bands: interval(0.4, 4.5),
	},
	t3_total: {
		unit: "ng/mL",
		basis: "source-lab-consensus",
		summary: "Common adult assay interval 0.60–1.81",
		bands: interval(0.6, 1.81),
	},
	t4_total: {
		unit: "ug/dL",
		basis: "source-lab-consensus",
		summary: "Common adult assay interval 4.5–12.6",
		bands: interval(4.5, 12.6),
	},
	iron_serum: {
		unit: "ug/dL",
		basis: "adult-male",
		summary: "Adult male reference example 50–150; timing and intake matter",
		bands: interval(50, 150),
	},
	tibc: {
		unit: "ug/dL",
		basis: "source-lab-consensus",
		summary: "Common adult source-lab interval 250–400",
		bands: interval(250, 400),
	},
	uibc: {
		unit: "ug/dL",
		basis: "source-lab-consensus",
		summary: "Source-lab interval 69–240; interpret with iron and TIBC",
		bands: interval(69, 240),
	},
	transferrin_saturation: {
		unit: "%",
		basis: "adult-male",
		summary: "Adult reference example 14–50; interpret with ferritin and iron studies",
		bands: interval(14, 50),
	},
	vitamin_b12: {
		unit: "pg/mL",
		basis: "guideline",
		summary:
			"Subnormal <200 · confirmation zone 200–399 · ≥400 above confirmation zone; assays vary",
		bands: [
			{ label: "Subnormal", max: 200, tone: "low" },
			{ label: "MMA confirmation zone", min: 200, max: 400, tone: "caution" },
			{ label: "Above confirmation zone", min: 400, tone: "reference" },
		],
	},
	vitamin_d_25_oh: {
		unit: "ng/mL",
		basis: "guideline",
		summary:
			"Deficiency risk <12 · generally inadequate 12–19 · adequate for most 20–50 · potential adverse effects >50",
		bands: [
			{ label: "Deficiency risk", max: 12, tone: "low" },
			{ label: "Generally inadequate", min: 12, max: 20, tone: "caution" },
			{ label: "Adequate for most", min: 20, max: 50, tone: "reference" },
			{ label: "Potential adverse effects", min: 50, tone: "high" },
		],
	},
} as const satisfies Record<MedicalMetricCode, MedicalReferenceRange>;
