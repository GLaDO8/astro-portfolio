import { SoundProvider } from "@web-kits/audio/react";
import type { ReactNode } from "react";

type GlobalSoundProviderProps = {
	readonly children: ReactNode;
};

export default function GlobalSoundProvider({ children }: GlobalSoundProviderProps) {
	return (
		<SoundProvider enabled volume={0.8}>
			{children}
		</SoundProvider>
	);
}
