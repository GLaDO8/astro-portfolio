export type ProductStatus = "draft" | "available" | "reserved" | "gone";
export interface Product {
	id: string;
	title: string;
	description: string;
	category: string;
	brand: string;
	originalUrl: string;
	pricePaise: number;
	imageKey: string | null;
	status: ProductStatus;
}
export interface BoxItem {
	id: string;
	title: string;
}
export interface GarageRequest {
	id: string;
	name: string;
	email: string;
	whatsapp: string;
	city: string;
	items: { id: string; title: string; pricePaise: number }[];
	status: "new" | "contacted" | "closed";
	createdAt: string;
}
