<div align="center">

# ProdMind

**30 open-source product-management applications, built one focused project at a time.**

Zero-cost software · Cloudflare-ready · Tested end to end · Apache-2.0

</div>

ProdMind is a divide-and-conquer build of an AI product-management copilot. Each idea lives in its own named project folder, runs independently, and proves its value before it is integrated into the unified platform.

## Projects

| # | Project | Purpose | Status |
|---|---|---|---|
| 01 | [Feedback Collector](feedback_collector/) | Collect, normalize, validate, deduplicate, and classify customer feedback. | Active |
| 02 | [Sentiment Analyzer](sentiment_analyzer/) | Explainable bilingual sentiment with confidence, evidence, and review flags. | Active |
| 03 | [Topic Modeler](topic_modeler/) | Discover themes, hierarchies, and topic drift with online weighted clustering. | Active |
| 04 | [Feature Request Detector](feature_request_detector/) | Detect feature requests, bugs, and overlapping intents with explainable evidence. | Active |
| 05 | Voice-of-Customer Dashboard | Explore customer evidence, trends, and anomalies. | Planned |

Projects 06–30 will be added only after their preceding contracts are validated, avoiding unfinished scaffolds.

## Build principles

- One named folder per product idea
- A runnable application and focused README in every folder
- No paid computation or software dependencies
- Cloudflare Workers-compatible deployments
- Deterministic fallbacks when AI capacity is unavailable
- Tests before integration
- Original implementation and branding

## Run a project

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/feedback_collector
npm install
npm test
npm run dev
```

Each project folder contains its own setup, security, deployment, testing, and architecture documentation.

## License

Licensed under the [Apache License 2.0](LICENSE).
