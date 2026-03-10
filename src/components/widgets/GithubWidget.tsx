import {
  type ContributionDay,
  contributionLevel,
  type GithubData,
  type PrivateRepo,
  relativeTime,
} from "@/lib/github";

const ROWS = 3;
const COLS = 8;

const LEVEL_COLORS = [
  "bg-[#f5f5f5]",
  "bg-[#a2ffc7]",
  "bg-[#5cde90]",
  "bg-[#0dc155]",
  "bg-[#0d7336]",
] as const;

function cellRadius(row: number, col: number): string {
  const tl = row === 0 && col === 0 ? "rounded-tl-[8px]" : "rounded-tl-[4px]";
  const tr =
    row === 0 && col === COLS - 1 ? "rounded-tr-[8px]" : "rounded-tr-[4px]";
  const bl =
    row === ROWS - 1 && col === 0 ? "rounded-bl-[8px]" : "rounded-bl-[4px]";
  const br =
    row === ROWS - 1 && col === COLS - 1
      ? "rounded-br-[8px]"
      : "rounded-br-[4px]";
  return `${tl} ${tr} ${bl} ${br}`;
}

function ContributionGrid({ days }: { days: ContributionDay[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const grid: ContributionDay[][] = Array.from({ length: ROWS }, () => []);
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const idx = col * ROWS + row;
      grid[row].push(days[idx] ?? { count: 0, date: "" });
    }
  }

  return (
    <div className="flex flex-col gap-[5px] w-full">
      {grid.map((row, ri) => (
        <div key={ri} className="flex gap-[6px] w-full">
          {row.map((day, ci) => {
            const level = contributionLevel(day.count, max);
            return (
              <div
                key={ci}
                className={`size-5 shrink-0 ${LEVEL_COLORS[level]} ${cellRadius(ri, ci)}`}
                title={
                  day.date
                    ? `${day.date}: ${day.count} contributions`
                    : undefined
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RepoEntry({ repo }: { repo: PrivateRepo }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2 items-center">
        <span className="font-inter font-medium text-sm tracking-[-0.28px] text-[#353535]">
          {repo.name}
        </span>
        <span className="bg-[#f2f2f2] rounded-2xl px-2 pt-px pb-0.5 font-inter font-medium text-xs tracking-[-0.24px] text-[#6a6a6a]">
          Private
        </span>
      </div>
      <span className="font-inter text-sm tracking-[-0.28px] text-[#737373]">
        {repo.totalCommits} commits, {relativeTime(repo.pushedAt)}
      </span>
    </div>
  );
}

const GITHUB_PROFILE = "https://github.com/GLaDO8";

export default function GithubWidget({ data }: { data: GithubData }) {
  return (
    <div className="w-[230px] shrink-0 bg-white rounded-2xl shadow-lg flex flex-col gap-4 items-center pt-3 pb-4 px-3">
      <ContributionGrid days={data.contributions} />
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center gap-2.5 w-full">
          <span className="flex-1 font-inter font-bold text-xl tracking-[-0.4px] text-black">
            Sneak peek
          </span>
          <a
            href={GITHUB_PROFILE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black hover:text-[#353535] transition-colors"
          >
            <svg
              width="20"
              height="19"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-label="GitHub profile"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"
              />
            </svg>
          </a>
        </div>
        {data.privateRepos.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.privateRepos.map((repo) => (
              <RepoEntry key={repo.name} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
