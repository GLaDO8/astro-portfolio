# Medical metric glossary

This file documents every `metric_code` currently stored in the `medical_metrics` D1 table. It is a lookup guide for dashboard labels and tooltips, not a diagnostic reference.

- **Unit** is the unit stored in D1, not a universal unit for the test.
- **Calculated** means the lab derived the result from other measurements. Formulae can differ between labs.
- A stored `qualifier` such as `<` or `>` means the numeric value is an assay boundary, not an exact measurement.
- **Reference / interpretation range** gives guideline categories where they exist. Otherwise it says to use the source laboratory's interval because method, age, sex, fasting state, and clinical context can change the valid range.
- Terms such as *high*, *low*, and *diabetes* are interpretation categories, not diagnoses. A result may need repeat testing and clinical review.
- Similar-looking tests are kept separate when they answer different questions, such as fasting versus random glucose and CRP versus hs-CRP.

## Glucose and insulin

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `glucose_fasting` | Fasting glucose | mg/dL | Blood glucose after the report's required fasting period; a point-in-time measurement. | Normal ≤99; prediabetes 100–125; diabetes ≥126 (confirm on another day unless unequivocal symptoms). |
| `glucose_random` | Random glucose | mg/dL | Blood glucose collected without a defined fasting period; a point-in-time measurement affected by recent food and activity. | No healthy/prediabetes band. ≥200 with classic hyperglycemia symptoms supports diabetes; otherwise do not diagnose from this alone. |
| `hba1c` | HbA1c | % | Percentage of hemoglobin with glucose attached; reflects average blood glucose over roughly the previous two to three months. | Normal <5.7%; prediabetes 5.7–6.4%; diabetes ≥6.5% (usually confirm). Individual treatment targets differ. |
| `estimated_average_glucose` | Estimated average glucose | mg/dL | Calculated translation of HbA1c into an estimated average glucose value; not a separately measured glucose result. | No independent diagnostic bands; derived from HbA1c. Interpret through the corresponding HbA1c. |
| `insulin_fasting` | Fasting insulin | uU/mL | Insulin concentration after fasting; interpretation depends on glucose, fasting conditions, medicines, and clinical context. | No standardized universal cutoff; use the source-lab interval with fasting glucose and clinical context. |

## Lipids and apolipoproteins

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `cholesterol_total` | Total cholesterol | mg/dL | Total cholesterol carried across the major lipoprotein particles in blood. | Desirable <200; borderline high 200–239; high ≥240. |
| `cholesterol_hdl` | HDL cholesterol | mg/dL | Cholesterol carried in high-density lipoprotein particles. | Low: <40 (men) or <50 (women); ≥60 is favorable. Higher is generally better, but not a treatment target by itself. |
| `cholesterol_ldl_calculated` | Calculated LDL cholesterol | mg/dL | Estimated cholesterol carried in low-density lipoprotein particles; accuracy depends on the lab's formula and triglyceride level. | Optimal <100; near optimal 100–129; borderline high 130–159; high 160–189; very high ≥190. Personal targets are risk-based. |
| `cholesterol_vldl_calculated` | Calculated VLDL cholesterol | mg/dL | Estimated cholesterol carried in very-low-density lipoprotein particles, usually derived from triglycerides. | No universal clinical band; calculated by a lab-specific formula. Use the source-lab interval. |
| `cholesterol_non_hdl` | Non-HDL cholesterol | mg/dL | Calculated total cholesterol minus HDL cholesterol; includes cholesterol in LDL and other atherogenic particles. | General healthy goal <130; treatment targets are lower for higher cardiovascular risk. |
| `triglycerides` | Triglycerides | mg/dL | Concentration of circulating triglyceride fats; meals, alcohol, and fasting status can affect it. | Desirable <150; borderline high 150–199; high 200–499; very high ≥500. |
| `apolipoprotein_a1` | Apolipoprotein A1 | mg/dL | Main structural protein in HDL particles. | Sex-, population-, and assay-specific; use the source-lab interval. |
| `apolipoprotein_b` | Apolipoprotein B | mg/dL | Structural protein present once on most atherogenic lipoprotein particles; approximates their particle count. | No universal healthy band; cardiovascular targets depend on overall risk. Use the source-lab interval or clinician-set target. |
| `apob_apoa1_ratio` | ApoB/ApoA1 ratio | ratio | Calculated ratio of apolipoprotein B to apolipoprotein A1. | No universal diagnostic or treatment cutoff; trend or use the source-lab interval. |
| `cholesterol_total_hdl_ratio` | Total cholesterol/HDL ratio | ratio | Calculated total cholesterol divided by HDL cholesterol. | No current universal clinical cutoff; trend only or use the source-lab interval. |
| `cholesterol_ldl_hdl_ratio` | LDL/HDL ratio | ratio | Calculated LDL cholesterol divided by HDL cholesterol. | No current universal clinical cutoff; trend only or use the source-lab interval. |
| `cholesterol_hdl_ldl_ratio` | HDL/LDL ratio | ratio | Calculated HDL cholesterol divided by LDL cholesterol; the inverse orientation of `cholesterol_ldl_hdl_ratio`. | No current universal clinical cutoff; trend only or use the source-lab interval. |

## Liver, bile, and blood proteins

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `alt` | Alanine aminotransferase (ALT) | U/L | Enzyme concentrated in liver cells. A rise can accompany liver-cell injury, but ALT does not identify a cause by itself. | Healthy adult ceiling suggested by ACG: 29–33 (men), 19–25 (women); for clinical interpretation use the report's upper limit. |
| `ast` | Aspartate aminotransferase (AST) | U/L | Enzyme found in liver, muscle, and other tissues; liver or muscle injury and strenuous exercise can affect it. | No universal cutoff; use the source-lab interval. Muscle injury and hard exercise can also raise AST. |
| `ast_alt_ratio` | AST/ALT ratio | ratio | Calculated AST divided by ALT; meaningful only alongside the underlying enzyme values and clinical context. | No universal normal/abnormal cutoff; never classify without the component values and context. |
| `alkaline_phosphatase` | Alkaline phosphatase (ALP) | U/L | Enzyme associated mainly with bile ducts and bone; the total test does not identify which tissue produced it. | Age-, sex-, and assay-specific; use the source-lab interval. High values can arise from liver/bile duct or bone sources. |
| `ggt` | Gamma-glutamyl transferase (GGT) | U/L | Enzyme associated mainly with the liver and bile ducts; alcohol and some medicines can also affect it. | Sex- and assay-specific; use the source-lab interval. |
| `bilirubin_total` | Total bilirubin | mg/dL | Total bilirubin from red-cell breakdown circulating in blood. | Use the source-lab interval; method-specific. Interpret with direct and indirect fractions. |
| `bilirubin_direct` | Direct bilirubin | mg/dL | Bilirubin that has been processed by the liver into a water-soluble form. | Use the source-lab interval; method-specific. |
| `bilirubin_indirect` | Indirect bilirubin | mg/dL | Calculated or measured unconjugated bilirubin, before liver processing. | Use the source-lab interval; often calculated and method-specific. |
| `albumin` | Albumin | g/dL | Major blood protein made by the liver; also influenced by hydration, nutrition, kidney loss, and inflammation. | Common adult example 3.4–5.4; use the source-lab interval. |
| `globulin` | Globulin | g/dL | Combined concentration of several non-albumin blood proteins, including many antibodies. | No portable universal cutoff; use the source-lab interval. |
| `protein_total` | Total protein | g/dL | Combined albumin and globulin concentration in blood. | Common adult example 6.5–8.1; use the source-lab interval. |
| `albumin_globulin_ratio` | Albumin/globulin ratio | ratio | Calculated albumin divided by globulin. | No universal diagnostic cutoff; use the source-lab interval. |

## Kidney function, electrolytes, and minerals

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `creatinine_serum` | Serum creatinine | mg/dL | Waste product related to muscle metabolism that kidneys clear; muscle mass, meat, supplements, hydration, and exercise can affect it. | Sex-, age-, muscle-mass-, diet-, and assay-dependent; use the source-lab interval and eGFR. |
| `egfr` | Estimated glomerular filtration rate (eGFR) | mL/min/1.73m2 | Calculated estimate of kidney filtration, usually based on serum creatinine plus demographic inputs; equations can differ by report. | G1 ≥90; G2 60–89; G3a 45–59; G3b 30–44; G4 15–29; G5 <15. G1/G2 alone do not establish CKD. |
| `bun` | Blood urea nitrogen (BUN) | mg/dL | Nitrogen portion of urea in blood; influenced by kidney handling, hydration, protein intake, and tissue breakdown. | Hydration-, diet-, and lab-dependent; use the source-lab interval. |
| `urea` | Urea | mg/dL | Total urea concentration in blood; related to BUN but reported on a different scale. | Hydration-, diet-, and lab-dependent; use the source-lab interval. |
| `bun_creatinine_ratio` | BUN/creatinine ratio | ratio | Calculated BUN divided by serum creatinine. | No universal diagnostic cutoff; use the source-lab interval and component values. |
| `uric_acid` | Uric acid | mg/dL | End product of purine breakdown, cleared mainly through the kidneys. | Sex- and lab-specific; use the source-lab interval and condition-specific target if applicable. |
| `sodium` | Sodium | mmol/L | Main extracellular electrolyte, central to fluid balance and nerve and muscle function. | Use the source-lab interval; clinically important abnormalities require prompt contextual interpretation. |
| `potassium` | Potassium | mmol/L | Electrolyte important for nerve, muscle, and heart electrical function; specimen handling can alter a result. | Use the source-lab interval; specimen hemolysis can falsely elevate it and marked abnormalities can be urgent. |
| `chloride` | Chloride | mmol/L | Electrolyte that helps maintain fluid and acid-base balance. | Use the source-lab interval and interpret with the rest of the electrolyte/acid-base panel. |
| `calcium` | Total calcium | mg/dL | Total calcium in blood, including protein-bound and free calcium; albumin can affect the total value. | Use the source-lab interval; total calcium depends on albumin. |
| `phosphorus` | Phosphorus | mg/dL | Blood phosphate concentration, involved in bone, energy metabolism, and cell function. | Age-, diet-, kidney-, and lab-dependent; use the source-lab interval. |
| `magnesium` | Magnesium | mg/dL | Blood magnesium concentration; serum levels do not directly measure total body stores. | Use the source-lab interval; serum magnesium does not measure total body stores. |

## Red blood cells and red-cell indices

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `rbc_count` | Red blood cell count | million/mm3 | Number of red blood cells per blood volume. | Adult example: men 4.35–5.65; women 3.92–5.13. Use the source-lab interval. |
| `hemoglobin` | Hemoglobin | g/dL | Concentration of the oxygen-carrying protein in red blood cells. | Adult example: men 13.2–16.6; women 11.6–15.0. Use the source-lab interval. |
| `hematocrit` | Hematocrit | % | Percentage of blood volume occupied by red blood cells. | Adult example: men 38.3–48.6%; women 35.5–44.9%. Use the source-lab interval. |
| `mcv` | Mean corpuscular volume (MCV) | fL | Average red blood cell size. | Adult example 78.2–97.9; <80 is commonly called microcytic and >100 macrocytic. Use the source-lab interval. |
| `mch` | Mean corpuscular hemoglobin (MCH) | pg | Average amount of hemoglobin per red blood cell. | Common adult example 27–32; use the source-lab interval. |
| `mchc` | Mean corpuscular hemoglobin concentration (MCHC) | g/dL | Average hemoglobin concentration within red blood cells. | Common adult example 32–36; use the source-lab interval. |
| `rdw_cv` | Red cell distribution width (RDW-CV) | % | Variation in red blood cell size. | Adult example: men 11.8–14.5%; women 12.2–16.1%. Analyzer-specific; use the source-lab interval. |
| `mentzer_index` | Mentzer index | ratio | Calculated red-cell screening index, commonly MCV divided by RBC count, used as a clue when evaluating small red cells; not a diagnosis. | Screening clue only. This report uses <14 for thalassemia-trait pattern and ≥14 for iron-deficiency pattern; not a healthy/bad scale. |
| `sehgal_index` | Sehgal index | ratio | Lab-calculated red-cell screening index used as a clue in evaluating microcytosis; formula and cutoffs should be taken from the source laboratory. | Report-specific screening clue: <972 versus ≥972; not a standardized healthy/bad scale. |

## White blood cells

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `wbc_count` | White blood cell count | cells/mm3 | Total number of white blood cells per blood volume. | Adult example 3,400–9,600; use the source-lab interval. |
| `neutrophils_percent` | Neutrophils | % | Percentage of white blood cells classified as neutrophils. | Source-lab interval only; absolute neutrophil count is more portable than percentage. |
| `lymphocytes_percent` | Lymphocytes | % | Percentage of white blood cells classified as lymphocytes. | Source-lab interval only; absolute lymphocyte count is more portable than percentage. |
| `monocytes_percent` | Monocytes | % | Percentage of white blood cells classified as monocytes. | Source-lab interval only; absolute monocyte count is more portable than percentage. |
| `eosinophils_percent` | Eosinophils | % | Percentage of white blood cells classified as eosinophils. | Source-lab interval only; absolute eosinophil count is more portable than percentage. |
| `basophils_percent` | Basophils | % | Percentage of white blood cells classified as basophils. | Source-lab interval only; absolute basophil count is more portable than percentage. |
| `absolute_neutrophil_count` | Absolute neutrophil count | cells/mm3 | Number of neutrophils per blood volume; more directly reflects the count than the percentage alone. | Adult example 1,560–6,450; use the source-lab interval and clinical context. |
| `absolute_lymphocyte_count` | Absolute lymphocyte count | cells/mm3 | Number of lymphocytes per blood volume. | Adult example 950–3,070; use the source-lab interval. |
| `absolute_monocyte_count` | Absolute monocyte count | cells/mm3 | Number of monocytes per blood volume. | Adult example 260–810; use the source-lab interval. |
| `absolute_eosinophil_count` | Absolute eosinophil count | cells/mm3 | Number of eosinophils per blood volume. | Adult example 30–480; use the source-lab interval. |
| `absolute_basophil_count` | Absolute basophil count | cells/mm3 | Number of basophils per blood volume. | Adult example 10–80; use the source-lab interval. |
| `neutrophil_lymphocyte_ratio` | Neutrophil/lymphocyte ratio (NLR) | ratio | Calculated absolute or percentage neutrophils divided by lymphocytes; a nonspecific contextual marker. | No standardized healthy or disease cutoff; trend/context only. |

## Platelets, inflammation, and immune markers

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `platelet_count` | Platelet count | 10^3/uL | Number of platelets per blood volume; platelets help form blood clots. | Adult Mayo example: men 135–317; women 157–371. A common broader interval is 150–400; use the source lab. |
| `mean_platelet_volume` | Mean platelet volume (MPV) | fL | Average platelet size. | Analyzer-specific; use the source-lab interval. |
| `platelet_distribution_width` | Platelet distribution width (PDW) | fL | Variation in platelet size. | Analyzer-specific; use the source-lab interval. |
| `platelet_hematocrit` | Plateletcrit (PCT) | % | Estimated percentage of blood volume occupied by platelets; calculated from platelet count and size. | Calculated and analyzer-specific; use the source-lab interval. |
| `crp` | C-reactive protein (CRP) | mg/L | Protein made by the liver in response to inflammation; nonspecific and does not identify the cause. | Common standard-CRP reference <5; assay-specific. Higher means more inflammation, not a specific diagnosis. |
| `hscrp` | High-sensitivity CRP (hs-CRP) | mg/L | More sensitive CRP assay that measures lower concentrations, often used in cardiovascular-risk context; keep separate from standard CRP. | Cardiovascular context: <2 lower risk; ≥2 risk-enhancing; >10 suggests acute inflammation and should be repeated when well. |
| `esr` | Erythrocyte sedimentation rate (ESR) | mm/h | Rate at which red blood cells settle in a tube; an indirect, nonspecific marker influenced by inflammation and blood-cell factors. | Westergren examples: men <50 years <15, ≥50 <20; women <50 <20, ≥50 <30. Use the source-lab method/range. |
| `immunoglobulin_e` | Total immunoglobulin E (IgE) | kU/L | Total IgE antibody concentration; can be associated with allergic or parasitic responses but is nonspecific. | Adult Mayo example ≤214; age- and assay-specific. High is nonspecific and normal does not exclude allergy. |

## Iron, vitamins, and homocysteine

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `iron_serum` | Serum iron | ug/dL | Iron circulating in blood, mostly bound to transferrin; varies with time of day, food, and recent supplementation. | Adult Mayo example: men 50–150; women 35–145. Timing and intake matter; use with ferritin/TIBC, not alone. |
| `tibc` | Total iron-binding capacity (TIBC) | ug/dL | Estimated total capacity of transferrin and related proteins to bind iron. | Adult Mayo example 250–400; method-specific and best interpreted with iron and ferritin. |
| `uibc` | Unsaturated iron-binding capacity (UIBC) | ug/dL | Remaining iron-binding capacity not occupied by iron. | No portable standalone interval; use the source-lab range and interpret with TIBC and serum iron. |
| `transferrin_saturation` | Transferrin saturation | % | Calculated percentage of iron-binding sites occupied by iron, usually serum iron divided by TIBC. | Adult Mayo example 14–50%; use with ferritin and the source-lab interval. |
| `vitamin_b12` | Vitamin B12 | pg/mL | Blood concentration of cobalamin, a vitamin needed for red-cell formation and nervous-system function. | <200–250 is commonly subnormal; 150–399 may warrant methylmalonic-acid confirmation. Lab methods vary. |
| `vitamin_d_25_oh` | 25-hydroxy vitamin D | ng/mL | Main circulating vitamin D metabolite used to assess vitamin D status. | <12 deficient; 12–<20 generally inadequate; 20–50 adequate for most; >50 may be associated with adverse effects. |
| `homocysteine` | Homocysteine | not_reported | Amino-acid intermediate affected by folate, vitamin B12, vitamin B6, kidney function, genetics, and other factors. The source report did not print a unit. | No range can be safely applied because this report omitted the unit. Method-, age-, and sex-specific. |

## Thyroid and sex hormones

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `tsh` | Thyroid-stimulating hormone (TSH) | uIU/mL | Pituitary hormone that signals the thyroid to produce thyroid hormones. | Common adult example about 0.4–4.5; use the assay-, age-, and context-specific source-lab interval with free T4. |
| `t3_total` | Total triiodothyronine (T3) | ng/mL | Total protein-bound plus free T3 thyroid hormone in blood. | Adult Mayo assay example 0.80–2.00; binding-protein and assay dependent. |
| `t4_total` | Total thyroxine (T4) | ug/dL | Total protein-bound plus free T4 thyroid hormone in blood. | Adult Mayo assay example 4.5–11.7; binding-protein and assay dependent. |
| `testosterone_total` | Total testosterone | ng/dL | Total circulating testosterone, including protein-bound and free fractions; time of collection matters. | Adult men: <300 is an AUA clinical cutoff only with symptoms and two low early-morning tests; assay example 240–950. |

## Pancreatic enzymes and tumor marker

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `amylase` | Amylase | U/L | Digestive enzyme made mainly by the pancreas and salivary glands; not specific to one organ. | Adult Mayo assay example 28–100; >3× the lab upper limit is one criterion for acute pancreatitis, not a diagnosis alone. |
| `lipase` | Lipase | U/L | Fat-digesting enzyme made mainly by the pancreas; usually interpreted with symptoms and other tests. | Adult Mayo assay example 13–60; >3× the lab upper limit is one criterion for acute pancreatitis, not a diagnosis alone. |
| `cea` | Carcinoembryonic antigen (CEA) | ng/mL | Nonspecific tumor marker used mainly to help monitor certain known cancers; it is not a stand-alone cancer screening or diagnostic test. | Mayo assay example: nonsmoker ≤3.0; smokers often <5.0. Method-specific; not a cancer screening or diagnostic threshold. |

## Urine measurements

| Metric code | Display name | Unit | What it represents | Reference / interpretation range |
| --- | --- | --- | --- | --- |
| `urine_ph` | Urine pH | ratio | Acidity or alkalinity of the urine sample on the pH scale. | Source-lab interval only; specimen timing, diet, infection, and storage can affect it. |
| `urine_specific_gravity` | Urine specific gravity | ratio | Density of urine relative to water; reflects urine concentration and is influenced by hydration and dissolved substances. | Source-lab interval only; strongly affected by hydration and dissolved substances. |
| `urine_sample_volume` | Submitted urine sample volume | mL | Volume of the specimen received by the lab; this is not automatically a timed or 24-hour urine-output measurement. | No health range: this is submitted specimen volume, not timed urine output. |
| `urine_microalbumin` | Urine microalbumin | mg/dL | Albumin concentration in a urine sample. “Microalbumin” refers to a small amount, not a different protein. | Do not classify the concentration alone; dilution-dependent. Prefer UACR. |
| `urine_creatinine` | Urine creatinine | mg/dL | Creatinine concentration in urine, commonly used to adjust urine albumin for sample concentration. | Do not classify alone; dilution-dependent and primarily used to calculate UACR. |
| `urine_albumin_creatinine_ratio` | Urine albumin/creatinine ratio (UACR) | mg/g | Calculated urine albumin relative to urine creatinine; reduces the effect of how dilute or concentrated a spot sample is. | A1 <30 normal-to-mildly increased; A2 30–300 moderately increased; A3 >300 severely increased. Persistence matters. |
| `urinalysis_pus_cells_lower` | Urine pus cells, lower bound | /hpf | Lower endpoint of the lab-reported white-cell range per high-power microscope field; not a separate test from the upper bound. | Range endpoint, not independently classifiable; use the paired bounds and source-lab microscopy interval. |
| `urinalysis_pus_cells_upper` | Urine pus cells, upper bound | /hpf | Upper endpoint of the lab-reported white-cell range per high-power microscope field; pair with the lower bound. | Range endpoint, not independently classifiable; use the paired bounds and source-lab microscopy interval. |
| `urinalysis_epithelial_cells_lower` | Urine epithelial cells, lower bound | /hpf | Lower endpoint of the lab-reported epithelial-cell range per high-power microscope field. | Range endpoint, not independently classifiable; use the paired bounds and source-lab microscopy interval. |
| `urinalysis_epithelial_cells_upper` | Urine epithelial cells, upper bound | /hpf | Upper endpoint of the lab-reported epithelial-cell range per high-power microscope field; pair with the lower bound. | Range endpoint, not independently classifiable; use the paired bounds and source-lab microscopy interval. |

## Reference sources

Descriptions are summarized from these patient-facing clinical references and from the labels in the imported reports:

- [Complete Blood Count (CBC) — MedlinePlus](https://medlineplus.gov/lab-tests/complete-blood-count-cbc/)
- [Liver Function Tests — MedlinePlus](https://medlineplus.gov/lab-tests/liver-function-tests/)
- [Cholesterol Levels — MedlinePlus](https://medlineplus.gov/lab-tests/cholesterol-levels/)
- [Hemoglobin A1C Test — MedlinePlus](https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/)
- [Iron Tests — MedlinePlus](https://medlineplus.gov/lab-tests/iron-tests/)
- [C-Reactive Protein Test — MedlinePlus](https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/)
- [Erythrocyte Sedimentation Rate — MedlinePlus](https://medlineplus.gov/lab-tests/erythrocyte-sedimentation-rate-esr/)
- [Urine Albumin-to-Creatinine Ratio — NIDDK](https://www.niddk.nih.gov/-/media/Files/Health-Information/Health-Professionals/Kidney-Disease/UACRQuickReferenceSheet.pdf)
- [Amylase Test — MedlinePlus](https://medlineplus.gov/lab-tests/amylase-test/)
- [CEA Test — MedlinePlus](https://medlineplus.gov/lab-tests/cea-test/)
- [Testosterone Levels Test — MedlinePlus](https://medlineplus.gov/lab-tests/testosterone-levels-test/)
- [Diabetes Tests and Diagnosis — NIDDK](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis)
- [Blood Cholesterol Diagnosis — NHLBI](https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis)
- [High Blood Triglycerides — NHLBI](https://www.nhlbi.nih.gov/health/high-blood-triglycerides)
- [How to Classify CKD — National Kidney Foundation](https://www.kidney.org/how-to-classify-ckd)
- [Complete Blood Count reference values — Mayo Clinic Laboratories](https://www.mayocliniclabs.com/test-catalog/Overview/42120)
- [Vitamin B12 — NIH Office of Dietary Supplements](https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/)
- [Vitamin D — NIH Office of Dietary Supplements](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/)
- [ACG guideline: Evaluation of Abnormal Liver Chemistries](https://acgcdn.gi.org/wp-content/uploads/2018/04/ACG-Abnormal-Liver-Chemistries-Guideline-Summary.pdf)
- [Thyroid Function Tests — American Thyroid Association](https://www.thyroid.org/thyroid-function-tests/)
- [Testosterone Deficiency guideline — American Urological Association](https://www.auanet.org/Documents/Guidelines/PDF/Testosterone%20Website%20Final%280%29.pdf)
- [How to Understand Your Lab Results — MedlinePlus](https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/)
