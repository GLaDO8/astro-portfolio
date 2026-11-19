export interface Database {
	query<T = Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<{ rows: T[]; rowCount?: number | null }>;
}
export interface PhotoStore {
	put(key: string, data: Uint8Array, contentType: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	get(key: string): Promise<Response | null>;
}
export interface GarageEnv {
	db: Database;
	photos: PhotoStore;
	passwordHash?: string;
	demo?: boolean;
	clientIp: (request: Request) => string;
}
