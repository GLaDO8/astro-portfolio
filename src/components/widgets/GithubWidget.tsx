import {
  type ContributionDay,
  contributionLevel,
  type GithubData,
  type PrivateRepo,
  relativeTime,
} from "@/lib/github";
import { div } from "motion/react-client";

const ROWS = 5;
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
    <div className="flex flex-col gap-[5px]">
      {grid.map((row, ri) => (
        <div key={ri} className="flex gap-[6px]">
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
    <div className="flex flex-col gap-0.5">
      <div className="flex gap-2 items-center">
        <span className="font-sans font-medium text-sm tracking-[-0.28px] text-[#28363c]">
          {repo.name}
        </span>
        <span className="bg-[#e7efef] rounded-2xl px-2 pt-px pb-0.5 font-sans font-medium text-xs tracking-[-0.24px] text-[#465c66]">
          Private
        </span>
      </div>
      <span className="font-sans text-xs tracking-[-0.24px] text-[#465358]">
        {repo.totalCommits} commits, {relativeTime(repo.pushedAt)}
      </span>
    </div>
  );
}

const GITHUB_PROFILE = "https://github.com/GLaDO8";

export default function GithubWidget({ data }: { data: GithubData }) {
  return (
    <div className="px-8">
      <div className="shrink-0 bg-white rounded-xl shadow-lg flex flex-row gap-6 px-4 overflow-hidden">
        {/* Left: heading + grid */}
        <div className="flex flex-col justify-between shrink-0 w-[202px] pt-3 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex-1 font-sans font-bold text-[30px] tracking-[-0.6px] text-[#28363c]">
              Sneak peek
            </span>
            <a
              href={GITHUB_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#28363c]/40 hover:text-[#28363c] transition-colors shrink-0"
            >
              <svg
                width="24"
                height="22"
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
          <ContributionGrid days={data.contributions} />
        </div>

        {/* Right: repo list */}
        <div className="flex flex-col justify-center py-4 shrink-0">
          {data.privateRepos.length > 0 && (
            <div className="flex flex-col gap-2 w-[178px]">
              {data.privateRepos.map((repo) => (
                <RepoEntry key={repo.name} repo={repo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
