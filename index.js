require("dotenv").config({ path: __dirname + "/.env" });
const Mustache = require("mustache");
const fs = require("fs/promises");
const { Octokit } = require("@octokit/rest");

const CTF_TEAM_ID = 170324;
const COLORS = ["200c0e", "513308", "9b7c15", "f9d2ba", "fbf4ec"];

const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN,
  userAgent: "readme v1.0.0",
  log: {
    warn: console.warn,
    error: console.error,
  },
});

async function grabDataFromAllRepositories() {
  const repos = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
    });

    repos.push(...data);

    if (data.length < 100) {
      break;
    }

    page += 1;
  }

  return repos;
}

function calculateTotalStars(repos) {
  return repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
}

async function calculateTotalCommits(repos, username) {
  let totalCommits = 0;

  for (const repo of repos) {
    try {
      const { data } = await octokit.rest.repos.listContributors({
        owner: repo.owner.login,
        repo: repo.name,
        per_page: 100,
      });

      const contributor = data.find((entry) => entry.login === username);
      if (contributor) {
        totalCommits += contributor.contributions;
      }
    } catch (error) {
      if (error.status !== 404) {
        console.warn(`Skipping ${repo.full_name}: ${error.message}`);
      }
    }
  }

  return totalCommits;
}

async function fetchCTFTIME(teamId) {
  const response = await fetch(`https://ctftime.org/api/v1/teams/${teamId}/`);
  if (!response.ok) {
    throw new Error(`CTFtime API error: ${response.status}`);
  }

  const team = await response.json();
  const latestRatedYear = Object.keys(team.rating)
    .filter((year) => team.rating[year].rating_place != null)
    .map(Number)
    .sort((a, b) => b - a)[0];

  if (!latestRatedYear) {
    const latestCountryYear = Object.keys(team.rating)
      .filter((year) => team.rating[year].country_place != null)
      .map(Number)
      .sort((a, b) => b - a)[0];

    return {
      ratingPlace: "N/A",
      countryPlace: latestCountryYear
        ? String(team.rating[latestCountryYear].country_place)
        : "N/A",
    };
  }

  return {
    ratingPlace: String(team.rating[latestRatedYear].rating_place),
    countryPlace: String(team.rating[latestRatedYear].country_place),
  };
}

async function updateReadme(userData) {
  const template = await fs.readFile("./main.mustache", "utf8");
  const output = Mustache.render(template, userData);
  await fs.writeFile("README.md", output);
}

async function main() {
  if (!process.env.GH_ACCESS_TOKEN) {
    throw new Error("GH_ACCESS_TOKEN is required");
  }

  const { data: user } = await octokit.rest.users.getAuthenticated();
  const repos = await grabDataFromAllRepositories();
  const totalStars = calculateTotalStars(repos);
  const totalCommits = await calculateTotalCommits(repos, user.login);
  const { ratingPlace, countryPlace } = await fetchCTFTIME(CTF_TEAM_ID);

  await updateReadme({
    totalStars,
    totalCommits,
    ratingPlace,
    countryPlace,
    colors: COLORS,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
