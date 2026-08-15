export const METRIC_AGGREGATION_VERSION = 1;

export const METRIC_DEFINITIONS = Object.freeze(
	[
		["active_energy", "kJ", "sum"],
		["apple_exercise_time", "min", "sum"],
		["apple_sleeping_wrist_temperature", "degC", "latest"],
		["apple_stand_hour", "count", "sum"],
		["apple_stand_time", "min", "sum"],
		["basal_energy_burned", "kJ", "sum"],
		["blood_glucose", "mmol/L", "latest"],
		["blood_oxygen_saturation", "%", "average"],
		["body_fat_percentage", "%", "latest"],
		["body_mass_index", "count", "latest"],
		["carbohydrates", "g", "sum"],
		["dietary_energy", "kJ", "sum"],
		["environmental_audio_exposure", "dBASPL", "none"],
		["fiber", "g", "sum"],
		["flights_climbed", "count", "sum"],
		["headphone_audio_exposure", "dBASPL", "none"],
		["heart_rate", "count/min", "range"],
		["heart_rate_variability", "ms", "average"],
		["lean_body_mass", "kg", "latest"],
		["physical_effort", "kcal/hr·kg", "average"],
		["protein", "g", "sum"],
		["respiratory_rate", "count/min", "average"],
		["resting_heart_rate", "count/min", "average"],
		["stair_speed_down", "m/s", "average"],
		["stair_speed_up", "m/s", "average"],
		["step_count", "count", "sum"],
		["vo2_max", "ml/(kg·min)", "latest"],
		["walking_asymmetry_percentage", "%", "average"],
		["walking_double_support_percentage", "%", "average"],
		["walking_heart_rate_average", "count/min", "average"],
		["walking_running_distance", "km", "sum"],
		["walking_speed", "km/hr", "average"],
		["walking_step_length", "cm", "average"],
		["weight_body_mass", "kg", "latest"],
	].map(([code, unit, rollupMethod]) => Object.freeze({ code, unit, rollupMethod })),
);

export const METRIC_DEFINITIONS_BY_CODE = new Map(
	METRIC_DEFINITIONS.map((definition) => [definition.code, definition]),
);

export const SLEEP_DEFINITION = Object.freeze({ code: "sleep_analysis", unit: "hr" });
