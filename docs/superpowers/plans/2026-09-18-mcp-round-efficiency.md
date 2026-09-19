# MCP Round Efficiency Implementation Plan

**Goal:** Remove redundant model turns by making screenshot and resize results
self-describing and allowing one-call discovery group activation.

**Spec:** `docs/superpowers/specs/2026-09-18-mcp-round-efficiency-design.md`

## Tasks

- [x] Add failing MCP tests for screenshot metadata and `enableGroups`.
- [x] Add failing extension tests for actual viewport verification.
- [x] Preserve non-image screenshot metadata in MCP content.
- [x] Measure and report the actual viewport after resize.
- [x] Implement direct discovery-group activation and update tool guidance.
- [x] Run focused tests, package typechecks, full tests, and build.

## Constraints

- Do not duplicate base64 image data in a text content block.
- Do not change capability validation, dangerous accounting, or approval gates.
- Keep old discovery and resize calls backward compatible.
- Do not add dependencies.
- Do not enable behavioral trace collection without a separate privacy design.
