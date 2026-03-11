const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export interface ContributionDay {
	count: number;
	level: number;
	date: string;
}

export interface PrivateRepo {
	name: string;
	totalCommits: number;
	pushedAt: string;
}

export interface GithubData {
	/** Last 40 days of contributions, sequential (filled column-wise in grid) */
	contributions: ContributionDay[];
	/** Up to 4 most recently active private repos */
	privateRepos: PrivateRepo[];
}

const QUERY = `{
  viewer {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
            contributionLevel
            date
          }
        }
      }
    }
    repositories(
      first: 10
      visibility: PRIVATE
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        name
        pushedAt
        defaultBranchRef {
          target {
            ... on Commit {
              history {
                totalCount
              }
            }
          }
        }
      }
    }
  }
}`;

interface GraphQLResponse {
	data: {
		viewer: {
			contributionsCollection: {
				contributionCalendar: {
					weeks: {
						contributionDays: {
							contributionCount: number;
							contributionLevel: string;
							date: string;
						}[];
					}[];
				};
			};
			repositories: {
				nodes: {
					name: string;
					pushedAt: string;
					defaultBranchRef: {
						target: {
							history: {
								totalCount: number;
							};
						};
					} | null;
				}[];
			};
		};
	};
}

const CONTRIBUTION_LEVELS: Record<string, number> = {
	NONE: 0,
	FIRST_QUARTILE: 1,
	SECOND_QUARTILE: 2,
	THIRD_QUARTILE: 3,
	FOURTH_QUARTILE: 4,
};

// biome-ignore lint/style/useConst: reassigned for caching
let cached: GithubData | null = null;

export async function getGithubData(): Promise<GithubData> {
	if (cached) return cached;

	const token = import.meta.env.GITHUB_TOKEN;
	if (!token) {
		console.warn("[github] GITHUB_TOKEN not set, using empty data");
		return { contributions: [], privateRepos: [] };
	}

	const res = await fetch(GITHUB_GRAPHQL, {
		method: "POST",
		headers: {
			Authorization: `bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query: QUERY }),
	});

	if (!res.ok) {
		console.warn(`[github] API error ${res.status}`);
		return { contributions: [], privateRepos: [] };
	}

	const json = (await res.json()) as GraphQLResponse;
	const viewer = json.data.viewer;

	// Flatten all contribution days and take the last 40
	const allDays = viewer.contributionsCollection.contributionCalendar.weeks.flatMap(
		(w) => w.contributionDays,
	);
	const recentDays = allDays.slice(-40).map((d) => ({
		count: d.contributionCount,
		level: CONTRIBUTION_LEVELS[d.contributionLevel] ?? 0,
		date: d.date,
	}));

	// Map private repos (skip repos with no default branch, take top 4)
	const privateRepos = viewer.repositories.nodes
		.filter((r) => r.defaultBranchRef !== null)
		.slice(0, 4)
		.map((r) => ({
			name: r.name,
			totalCommits: r.defaultBranchRef?.target.history.totalCount ?? 0,
			pushedAt: r.pushedAt,
		}));

	cached = { contributions: recentDays, privateRepos };
	return cached;
}

/** Format a date string as relative time (e.g. "2 hrs ago") */
export function relativeTime(dateStr: string): string {
	const diffMs = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diffMs / 60_000);
	const hrs = Math.floor(diffMs / 3_600_000);
	const days = Math.floor(diffMs / 86_400_000);

	if (mins < 60) return `${mins} min ago`;
	if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
	if (days === 1) return "1 day ago";
	return `${days} days ago`;
}
