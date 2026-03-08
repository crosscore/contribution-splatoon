import { Cell, CellOwner, ContributionLevel, Grid } from "../types";

/** GraphQL query to fetch contribution calendar */
const CONTRIBUTION_QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
            color
          }
        }
      }
    }
  }
}
`;

/** Map GitHub color to contribution level */
function colorToLevel(color: string): ContributionLevel {
  const map: Record<string, ContributionLevel> = {
    "#ebedf0": 0,
    "#9be9a8": 1,
    "#40c463": 2,
    "#30a14e": 3,
    "#216e39": 4,
    // Dark mode colors
    "#161b22": 0,
    "#0e4429": 1,
    "#006d32": 2,
    "#26a641": 3,
    "#39d353": 4,
  };
  return map[color.toLowerCase()] ?? 0;
}

interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
  color: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface GraphQLResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: ContributionWeek[];
        };
      };
    };
  };
}

/**
 * Fetch contribution data from GitHub GraphQL API
 */
export async function fetchContributions(
  username: string,
  token?: string
): Promise<Grid> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `bearer ${token}`;
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: CONTRIBUTION_QUERY,
      variables: { login: username },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as GraphQLResponse;

  if (!json.data?.user) {
    throw new Error(`User "${username}" not found on GitHub`);
  }

  const weeks =
    json.data.user.contributionsCollection.contributionCalendar.weeks;
  return weeksToGrid(weeks);
}

/**
 * Convert GitHub API weeks data to our Grid format
 */
function weeksToGrid(weeks: ContributionWeek[]): Grid {
  const width = weeks.length;
  const height = 7;

  const cells: Cell[][] = [];

  for (let x = 0; x < width; x++) {
    cells[x] = [];
    const week = weeks[x];
    for (let y = 0; y < height; y++) {
      const day = week.contributionDays[y];
      cells[x][y] = {
        x,
        y,
        contributionLevel: day ? colorToLevel(day.color) : 0,
        owner: CellOwner.None,
      };
    }
  }

  return { cells, width, height };
}

/**
 * Create a mock grid for testing (no API call needed)
 */
export function createMockGrid(width: number = 52, height: number = 7): Grid {
  const cells: Cell[][] = [];

  for (let x = 0; x < width; x++) {
    cells[x] = [];
    for (let y = 0; y < height; y++) {
      cells[x][y] = {
        x,
        y,
        contributionLevel: Math.floor(Math.random() * 5) as ContributionLevel,
        owner: CellOwner.None,
      };
    }
  }

  return { cells, width, height };
}
