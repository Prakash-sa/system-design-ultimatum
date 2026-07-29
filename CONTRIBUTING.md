# Contributing

Thanks for helping improve this system design resource. This repository is primarily a collection of Excalidraw diagrams, markdown notes, and a small static-site generator.

## Ground Rules

- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Submit only content you have the right to contribute.
- Do not add copied book pages, paid-course material, private company docs, confidential architecture reviews, or proprietary interview prompts.
- Attribute public sources that shaped a diagram or note.
- Keep contributions focused. Separate unrelated diagrams, notes, and site changes into separate pull requests.

## What To Contribute

Good contributions include:

- New system design diagrams for common interview or real-world architecture topics.
- Corrections to existing diagrams, notes, terminology, or tradeoff explanations.
- Better organization, naming, or navigation for existing topics.
- Small improvements to the static-site build or presentation.
- Source attribution fixes.

Before starting a large reorganization, open an issue first so maintainers can confirm the direction.

## Repository Layout

- Topic folders such as `🧩 1. Foundational(Introductory) Design/` contain `.excalidraw` architecture diagrams.
- `Notes/` contains markdown study notes grouped by topic.
- `Books/` contains book/reference notes and link collections.
- `Libraries/` contains shared Excalidraw libraries.
- `assets/` contains CSS and JavaScript used by the generated site.
- `build-site.js` generates the static site into `docs/`.
- `docs/` is generated output and should not be committed.

## Content Standards

### Diagrams

- Use `.excalidraw` format.
- Put each diagram in the most specific existing topic folder.
- Use a clear title-case filename, for example `Distributed Rate Limiter.excalidraw`.
- Keep diagrams readable at a glance: label major services, data stores, APIs, async paths, queues, caches, and external dependencies.
- Show important tradeoffs directly on the diagram when they materially affect the design.
- If the diagram is adapted from a public source, include the source in the pull request description and add a small attribution note in the diagram when practical.
- Avoid logos and branded assets unless you are confident they are allowed for this use.

### Markdown Notes

- Use a single `#` heading at the top.
- Start with a short summary of the concept or system.
- Prefer structured sections such as requirements, APIs, data model, architecture, scaling, reliability, tradeoffs, and interview talking points.
- Link to related local notes or diagrams when useful.
- Use fenced code blocks for snippets and command examples.
- Keep external links relevant and durable.

### Naming

- Match the style already used in the target folder.
- Prefer descriptive names over abbreviations.
- Do not rename existing files in the same pull request as content edits unless the rename is the main purpose of the change.

## Local Validation

Requires Node.js. There are no package dependencies.

```bash
node build-site.js
```

Then open or serve the generated site:

```bash
open docs/index.html
```

If `open` is unavailable, serve the folder with any static file server.

Do not commit `docs/`; GitHub Actions regenerates it for pull requests and deployments.

## Pull Request Process

1. Fork the repository and create a branch from `main`.
2. Make a focused change.
3. Run `node build-site.js`.
4. Confirm generated pages render correctly for any changed diagrams or notes.
5. Open a pull request using the PR template.
6. Address review comments with follow-up commits.

Maintainers may ask for source clarification, diagram simplification, filename changes, or additional validation before merging.

## Contributor License

By opening a pull request, you agree that your contribution can be distributed under this repository's license terms in [LICENSE.md](LICENSE.md). You also confirm that you have the right to submit the contribution.

