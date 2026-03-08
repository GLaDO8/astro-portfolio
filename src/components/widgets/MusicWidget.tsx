const SONG = {
  artist: "Air",
  title: "Modular mix",
  label: "WEEKLY OBSESSIONS",
  // Swap this URL to change album art
  albumArt: "/vinyl-album-art.svg",
};

export default function MusicWidget() {
  return (
    <div className="w-[300px] h-[200px] shrink-0 relative rounded-2xl bg-white shadow-lg">
      <div className="flex flex-col pl-6 pb-4">
        <div className="font-inter font-bold text-[12px] text-green-label tracking-[-0.3px] uppercase">
          {SONG.label}
        </div>
        <div className="font-inter font-bold text-[30px] tracking-[-0.6px] text-black">
          {SONG.artist}
        </div>
        <div className="font-inter font-medium text-[24px] tracking-[-0.48px] text-black">
          {SONG.title}
        </div>
      </div>

      {/* Record player assembly */}
      <div className="absolute left-[140px] top-[-65px] w-[220px] h-[220px]">
        {/* Spinning record + album art */}
        <div className="relative w-full h-full animate-vinyl">
          <img
            src="/record content.png"
            alt=""
            className="w-full h-full"
            draggable={false}
          />
          <img
            src={SONG.albumArt}
            alt="Album art"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[82px] h-[82px]"
            draggable={false}
          />
        </div>

        {/* Specular highlight — static overlay */}
        <img
          src="/specular highlight.svg"
          alt=""
          className="absolute left-[35px] top-[31px] w-[80px] mix-blend-color-dodge pointer-events-none"
          draggable={false}
        />

        {/* Tonearm — static */}
        <img
          src="/tonearm.png"
          alt=""
          className="absolute left-[-44px] top-[45px] w-[130px] -rotate-[4deg] origin-[30%_15%] pointer-events-none z-10"
          draggable={false}
        />
      </div>
    </div>
  );
}
