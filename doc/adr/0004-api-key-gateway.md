# 4. API Gateway

Date: 2025-05-20

## Status

Accepted

## Context

All routes except root should be protected from unauthorized access. There are multiple ways to do this but we decided on using an API key. We looked at multiple options:

- Roll our own API key management
- Express Gateway
- Kong
- Tyk
- AWS API Gateway
- Unkey

## Decision

We investigated all of these options before making a decision.

Rolling our own authentication is generally a terrible idea and the consequences of getting it wrong can be severe. It's better to use a service that is being tested and maintained by a dedicated team.

Express Gateway threw a lot of errors and warnings (the latest commit to their GitHub repository was three years ago) and their documentation wasn't helpful.

Kong doesn't have a free tier (although they do offer a 30 day trial). Their bottom tier is $25/month and doesn't offer a lot of features. The next tier up is $200/month and that would be excessive for a project of this scale.

Tyk looks to be aimed at larger companies rather than a single developer and requires contacting their sales team.

AWS API Gateway might be an option in the future since the intention is to host this app on AWS and it would make sense to have everything in the same place.

Unkey has a generous free tier, excellent documentation, and is easy to get started with. They also offer logging and rate limiting.

We decided to use Unkey's API key management. Their service is easy to use and the free tier should be more than enough for this application.

## Consequences

The authorization middleware is written for Unkey and will need to be refactored if we use a different gateway.
