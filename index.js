require("dotenv").config({ path: __dirname + "/.env" });
const Mustache = require("mustache");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const { Console } = require("console");
const commitCount = require('git-commit-count');
const puppeteer = require('puppeteer')

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

async function scrapeCTFTIME(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const [el] = await page.$x('//*[@id="rating_2022"]/p[1]/b[1]');
  const src = await el.getProperty('textContent');
  const ratingPlace = (await src.jsonValue()).trim();

  const [el2] = await page.$x('//*[@id="rating_2022"]/p[2]/b/a');
  const src2 = await el2.getProperty('textContent');
  const countryPlace = await src2.jsonValue();

  browser.close();
  return [ratingPlace, countryPlace]
}

async function main() {
  const repoData = await grabDataFromAllRepositories();

  const totalStars = calculateTotalStars(repoData);

  const totalCommits = await calculateTotalCommits(
    repoData
  );

  const [ratingPlace, countryPlace] = await scrapeCTFTIME("https://ctftime.org/team/170324");

  // Hex color codes for the color blocks
  const colors = ["200c0e", "513308", "9b7c15", "f9d2ba", "fbf4ec"];
  await updateReadme({ totalStars, totalCommits, ratingPlace, countryPlace, colors });
}

main();
