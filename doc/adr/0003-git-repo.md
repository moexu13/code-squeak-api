# 3. git-repo

Date: 2025-05-19

## Status

Accepted

## Context

The project analyzes a pull request and creates a review as a detailed comment on the PR. It will need to use a public git repository's API in order to analyze the PR. There are multiple services that host git repositories, most notably GitHub, GitLab, and Bitbucket.

## Decision

The first iteration will use GitHub as it's the most popular. Further versions could add the ability to analyze pull requests in different git repositories.

## Consequences

The GitHub implementation should be carefully designed so it doesn't make adding new providers excessively difficult.
