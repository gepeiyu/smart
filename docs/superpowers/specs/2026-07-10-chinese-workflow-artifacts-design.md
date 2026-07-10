# Chinese Workflow Artifacts

## Goal

Ensure workflow documents use Chinese content when `.smart/config.yaml` sets `smart_language: zh`, while preserving the existing English file names and paths.

## Scope

The language rule applies to implementation plans under `docs/superpowers/plans/`, OpenSpec `tasks.md`, and `verification-report.md`. The build and verify skills in both `assets/skills/` and `assets/skills-zh/` must state this requirement explicitly because either installed skill set may execute against a Chinese-configured project.

## Language Resolution

Before creating or updating an artifact, the workflow reads `.smart/config.yaml` when present. It uses Chinese for `smart_language: zh` and English for `smart_language: en`. If the field is absent, it falls back to the language of the user request that started the workflow. When resuming a change whose existing artifacts have a clear dominant language, the workflow preserves that language unless the user explicitly requests a switch.

Only prose is localized. Existing paths, file names, frontmatter keys, command names, identifiers, and required machine-readable values remain unchanged.

## Implementation

Add an artifact-language section to both variants of `smart-build` and `smart-verify`. Build applies the resolved language to the implementation plan and `tasks.md`; verify applies it to `verification-report.md` and any accepted-deviation updates to `tasks.md`.

No post-generation translation step is introduced. The originating workflow writes each artifact in the resolved language so checkboxes, metadata, and technical identifiers are preserved.

## Verification

Add contract tests that read all four skill files and assert that they:

- reference `.smart/config.yaml` and `smart_language`;
- define the `zh`, `en`, request-language, and existing-artifact behavior;
- name the artifacts owned by their phase;
- preserve existing file names and paths.

Run the focused skill tests, then the complete test suite.
