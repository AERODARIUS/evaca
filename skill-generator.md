---
name: skill-generator
description: Discover existing reusable skills from the skills.sh catalog first, then generate new project-scoped skills only when no strong reusable match exists. Anticipate likely project needs from the detected stack, APIs, tools, and workflows, and emit standard SKILL.md files plus a small catalog index.
---

# Skill Generator

## Purpose

Act as a meta-skill that helps an AI agent build and maintain a project skill library.

Its primary responsibility is to:

1. inspect the current project context;
2. infer which technologies, frameworks, APIs, tools, and workflows are likely to be used;
3. search for relevant existing skills in the skills.sh ecosystem;
4. prefer reuse or adaptation of an existing skill when a sufficiently strong match exists;
5. create a new project-scoped skill from scratch only when reuse is weak or unavailable;
6. store generated skills in standard `SKILL.md` format with consistent metadata and structure.

This skill does **not** claim to perform real learning. It standardizes discovery, selection, synthesis, and generation.

---

## When to use

Use this skill when:

- starting a new project and you want a starter skill library;
- onboarding into an unfamiliar codebase;
- adding a new integration, API, framework, or platform;
- noticing repeated workflows that should become reusable skills;
- auditing project skills for gaps, duplicates, or outdated instructions;
- generating project-specific skills for internal conventions or architecture.

Do **not** use this skill when:

- the task is one-off and not worth formalizing;
- the project context is too sparse to infer meaningful needs;
- an existing project skill already solves the problem well enough.

---

## Operating principles

### Principle 1: Reuse before creation

Always attempt to reuse a known public skill before generating one from scratch.

Search priority:

1. existing project-local skills;
2. organization/team skill catalog if available;
3. public skills catalog at `https://skills.sh/`;
4. generate a new skill only if the above fail to provide a strong match.

### Principle 2: Prefer adaptation over duplication

If an existing skill covers at least 70–80% of the intended use case, adapt or wrap it rather than cloning it blindly.

### Principle 3: Anticipate near-future needs

Do not wait only for repeated prompts. Also infer likely needed skills from:

- detected frameworks and libraries;
- package manifests;
- CI/CD files;
- infrastructure files;
- API clients and SDKs;
- environment variable names;
- project docs and ADRs;
- test frameworks;
- directory names and code patterns.

### Principle 4: Generate narrowly scoped skills

A good skill should be specific enough to be reliable and broad enough to be reusable. Avoid giant “do everything” skills.

### Principle 5: Preserve traceability

Every generated skill should record whether it was:

- reused directly;
- adapted from a source skill;
- synthesized from multiple sources;
- created from scratch.

---

## Inputs

Potential inputs may include:

- repository files and folder structure;
- `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`;
- `requirements.txt`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Cargo.toml`, etc.;
- CI files such as GitHub Actions, GitLab CI, Jenkins, CircleCI;
- Dockerfiles, Terraform, Kubernetes manifests;
- README, docs, ADRs, architecture notes;
- code imports and dependency graphs;
- existing local skills;
- a user request such as “create skills for this project” or “add a skill for Stripe webhooks”.

Optional user preferences:

- local-only vs public-sourced reuse;
- minimum similarity threshold;
- preferred tone or structure;
- allowed external catalogs;
- whether generated skills may wrap external skills.

---

## Outputs

Primary outputs:

1. one or more generated or adapted `SKILL.md` files;
2. a `skills-index.json` or `skills-catalog.md` summary;
3. a decision note for each skill candidate containing:
   - detected need;
   - reuse candidates considered;
   - selected action: reuse / adapt / create;
   - confidence score;
   - rationale.

Recommended directory layout:

```text
skills/
  skill-generator/
    SKILL.md
  <skill-name>/
    SKILL.md
  skills-catalog.md
  skills-index.json