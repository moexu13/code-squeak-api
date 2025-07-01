<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a name="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/moexu13/code-squeak-api">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Code Squeak API</h3>

  <p align="center">
    An API that conducts an AI review of a pull request. It can also post the review as a comment.
    <br />
    <a href="https://github.com/moexu13/code-squeak-api"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/moexu13/code-squeak-api/blob/main/doc/adr/toc.md">View Demo</a>
    ·
    <a href="https://github.com/moexu13/code-squeak-api/issues">Report Bug</a>
    ·
    <a href="https://github.com/moexu13/code-squeak-api/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

[![Product Name Screen Shot][product-screenshot]](https://example.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Endpoints

### Base URL

- **GET /** - Health check endpoint that returns "Code Squeak API"

### Code Analysis Endpoints (`/api/v1/code-analysis`)

- **POST /** - Create a code analysis from a diff
  - Analyzes code changes using AI models
  - Accepts diff, prompt, model parameters, and metadata
  - Returns analysis results immediately
- **POST /pr** - Analyze a pull request asynchronously
  - Queues a pull request analysis job
  - Requires owner, repo, and pull_number
  - Returns job ID for tracking progress

### GitHub Integration Endpoints (`/api/v1/github`)

- **GET /:owner** - List repositories for a GitHub user/organization
  - Returns paginated list of repositories
  - Supports page and per_page query parameters
- **GET /:owner/:repo** - Get pull requests for a specific repository
  - Returns pull requests for the specified repository
- **POST /:owner/:repo/:pull_number/comments** - Create a comment on a pull request
  - Adds a comment to the specified pull request
  - Requires comment text in request body
- **GET /:owner/:repo/:pull_number/diff** - Get the diff for a pull request
  - Returns the code changes (diff) for the specified pull request
  - Diff is sanitized and truncated if too large (>10KB)

### Authentication & Rate Limiting

- All `/api/v1/*` endpoints require API key authentication
- GitHub endpoints have additional rate limiting applied
- Root endpoint (`/`) is publicly accessible

### Built With

- [![TypeScript][TypeScript.ts]][typescript-url]
- [![Node.js][Node.js]][Node-url]
- [![Redis][Redis]][Redis-url]
- [![Vitest][Vitest]][Vitest-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

1. [Node](Node-url)
2. [Redis](Redis-url)
3. `npm`, `pnpm`. or `yarn`

- npm

  ```sh
  npm install npm@latest -g
  ```

  - pnpm

  ```sh
  npm install pnpm@latest -g
  ```

  - yarn

  ```sh
  npm install yarn -g
  ```

### Installation

1. Get a free API Key at [https://example.com](https://example.com)
2. Clone the repo
   ```sh
   git clone https://github.com/moexu13/code-squeak-api.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Enter your API in `config.js`
   ```js
   const API_KEY = "ENTER YOUR API";
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

Use this space to show useful examples of how a project can be used. Additional screenshots, code examples and demos work well in this space. You may also link to more resources.

_For more examples, please refer to the [Documentation](https://example.com)_

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3
  - [ ] Nested Feature

See the [open issues](https://github.com/moexu13/code-squeak-api/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Melissa Albarella - [@bluesky](https://bsky.app/profile/moexu.bsky.social) - moe@melissa-albarella.dev

Project Link: [https://github.com/moexu13/code-squeak-api](https://github.com/moexu13/code-squeak-api)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

- []()
- []()
- []()

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/moexu13/code-squeak-api.svg?style=for-the-badge
[contributors-url]: https://github.com/moexu13/code-squeak-api/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/moexu13/code-squeak-api.svg?style=for-the-badge
[forks-url]: https://github.com/moexu13/code-squeak-api/network/members
[stars-shield]: https://img.shields.io/github/stars/moexu13/code-squeak-api.svg?style=for-the-badge
[stars-url]: https://github.com/moexu13/code-squeak-api/stargazers
[issues-shield]: https://img.shields.io/github/issues/moexu13/code-squeak-api.svg?style=for-the-badge
[issues-url]: https://github.com/moexu13/code-squeak-api/issues
[license-shield]: https://img.shields.io/github/license/moexu13/code-squeak-api.svg?style=for-the-badge
[license-url]: https://github.com/moexu13/code-squeak-api/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/melissa-albarella/
[product-screenshot]: images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vue.js]: https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Angular-url]: https://angular.io/
[Svelte.dev]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Laravel.com]: https://img.shields.io/badge/Laravel-FF2D20?style=for-the-badge&logo=laravel&logoColor=white
[Laravel-url]: https://laravel.com
[Bootstrap.com]: https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com
[JQuery.com]: https://img.shields.io/badge/jQuery-0769AD?style=for-the-badge&logo=jquery&logoColor=white
[JQuery-url]: https://jquery.com
