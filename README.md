# Ultimate resource for System Design

A curated collection of system-design diagrams in Excalidraw format. These diagrams collect patterns, example architectures, and interview-style whiteboard sketches. Most files in this repo come from public system-design study sources (annotations preserved in file names) and use a shared Excalidraw component set.

## 🌐 Live site

[https://Prakash-sa.github.io/system-design-ultimatum/](https://Prakash-sa.github.io/system-design-ultimatum/)

- Built automatically from `main` by GitHub Actions
- Every markdown + Excalidraw file gets its own HTML page with sidebar navigation
- Diagrams also ship with downloadable SVG previews generated from the Excalidraw source

## What's inside

- Hundreds of system-design diagrams in `.excalidraw` format (grouped by topic folders)
- Study notes in markdown under `Notes/`
- Shared component libraries under `Libraries/`

## Work with the diagrams

- Open `.excalidraw` files directly in VS Code using the Excalidraw extension, or in the web app
- Generated pages include SVG previews and a download link for each diagram
- Filenames keep source annotations to help track origin and topic

## Build locally

```bash
node build-site.js
open docs/index.html   # or serve docs/ with any static server
```

Notes:
- `docs/` is generated and ignored by git; CI produces it on deploy.
- Requires Node.js (no other dependencies).

## Deployment

Push to `main` and GitHub Actions builds + publishes to Pages automatically. Details live in [DEPLOYMENT.md](DEPLOYMENT.md).

## References

- [Jordan Has No Life's YouTube channel](https://www.youtube.com/@jordanhasnolife5163)
- Alex Xu's System Design Interview book
- [System Design Fight Club](https://www.youtube.com/@SDFC)
- [Hello Interview notes](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
- [ByteMonk](https://www.youtube.com/@ByteMonk)

### AI design links

- [Agentic AI patterns (Medium)](https://medium.com/data-science-collective/agentic-ai-single-vs-multi-agent-systems-e5c8b0e3cb28)
- [Agentic AI design patterns (blog)](https://blog.dailydoseofds.com/p/5-agentic-ai-design-patterns)
- [Vectorize series](https://vectorize.io/blog/designing-agentic-ai-systems-part-1-agent-architectures)
- [Analytics Vidhya](https://www.analyticsvidhya.com/blog/2024/10/agentic-design-patterns/)
- [GeeksforGeeks](https://www.geeksforgeeks.org/artificial-intelligence/agentic-ai-architecture/)

## Contribution guidelines

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Submit only content you have the right to contribute and include attribution for public sources.
- Run `node build-site.js` before opening a pull request.
- Changes merged to `main` automatically deploy to the live site.

## License

Source code is licensed under MIT. Original educational content is licensed under CC BY 4.0 unless noted otherwise. See [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md).
