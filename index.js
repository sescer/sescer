require("dotenv").config({ path: __dirname + "/.env" });
const Mustache = require("mustache");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const { Console } = require("console");
const commitCount = require('git-commit-count');

const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN,
  userAgent: "readme v1.0.0",
  baseUrl: process.env.GH_BASE_URL,
  log: {
    warn: console.warn,
    error: console.error,
  },
});

async function grabDataFromAllRepositories() {
  // Options under "List repositories for the authenticated user"
  // https://octokit.github.io/rest.js/v18#authentication
  const options = {
    per_page: 100,
  };

  // https://docs.github.com/en/rest/reference/repos#list-repositories-for-the-authenticated-user
  const request = await octokit.rest.repos.listForAuthenticatedUser(options);
  return request.data;
}

function calculateTotalStars(data) {
  const stars = data.map((repo) => repo.stargazers_count);
  const totalStars = stars.reduce((sum, curr) => sum + curr, 0);
  return totalStars;
}

async function calculateTotalCommits(data) {
  let totalCommits = 0;
  data.forEach((repo) => { 
    totalCommits += commitCount(repo.name)
  });

  return totalCommits;
}

async function updateReadme(userData) {
  const TEMPLATE_PATH = "./main.mustache";
  await fs.readFile(TEMPLATE_PATH, (err, data) => {
    if (err) {
      throw err;
    }

    const output = Mustache.render(data.toString(), userData);
    fs.writeFileSync("README.md", output);
  });
}

async function main() {
  const repoData = await grabDataFromAllRepositories();

  const totalStars = calculateTotalStars(repoData);

  const totalCommits = await calculateTotalCommits(
    repoData
  );

  // Hex color codes for the color blocks
  const colors = ["1c4e65", "5c949c", "e2dedd", "dfa4a3", "7c5c60"];
  await updateReadme({ totalStars, totalCommits, colors });
}

main();
