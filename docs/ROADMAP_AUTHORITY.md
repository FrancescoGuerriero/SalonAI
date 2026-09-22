# Roadmap Authority

## Active authority

The active development authority is:

- **AI Intelligent Business Platform — Master Development Roadmap v2.9**
- Repository execution reference: `docs/MASTER_DEVELOPMENT_ROADMAP_v2.9.md`
- Active Stage 1 implementation/acceptance authority: GitHub Issue #253

## Historical roadmaps

`docs/MASTER_DEVELOPMENT_ROADMAP_v2.3.md` is retained unchanged as **historical implementation evidence**. Its internal header reflects its status when it was approved on 21 September 2026; it is no longer the current planning authority after approval of v2.9 on 22 September 2026.

Historical roadmap content, PRs, issues and merged implementation must not be discarded or recreated simply because the planning baseline advanced. v2.9 supersedes planning order and governance where they differ while preserving all compatible completed work.

## Source-of-truth rule

For implementation decisions, resolve authority in this order:

1. current `main` implementation and tested canonical contracts;
2. current open authoritative GitHub issue for the active stage/workstream;
3. `docs/MASTER_DEVELOPMENT_ROADMAP_v2.9.md`;
4. preserved historical roadmap/issues/PRs for design rationale and prior evidence.

If a historical plan conflicts with current tested canonical behavior, do not restore the old implementation automatically. Record the conflict in the active stage issue and reconcile it through a scoped PR.

## Release rule

Roadmap status and source status are not production status. A feature is considered deployed only after the corresponding immutable release, protected deployment and production verification have completed.