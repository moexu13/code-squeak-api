# 5. logging-service

Date: 2025-05-21

## Status

Accepted

## Context

We want to keep error logs when the app is in production. In development so far we've been using pino and logging to console. A more robust and centralized solution would be better for production. Instead of handling error logs manually we'll use a logging service.

## Decision

We're using Sentry for logging. Their free plan has enough features for initial deployment and can be upgraded if we end up needing more than that.

## Consequences

If we ever decide to change providers or handle logging manually it's possible that error handling will need to be extensive refactoring.
