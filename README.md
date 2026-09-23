# CoreLine Productions

Public hub for CoreLine Productions — bot status, documentation, terms, and privacy policies.

## Live site

- **Hub:** https://coreline-productions.github.io/coreline/
- **Status:** https://coreline-productions.github.io/coreline/status/
- **Terms:** https://coreline-productions.github.io/coreline/terms/

## Bots

| Bot | Docs | Status | Privacy | Invite |
|---|---|---|---|---|
| Tixal | [/docs/tixal/](https://coreline-productions.github.io/coreline/docs/tixal/) | [/bots/tixal/](https://coreline-productions.github.io/coreline/bots/tixal/) | [/privacy/tixal/](https://coreline-productions.github.io/coreline/privacy/tixal/) | Coming soon |
| Setuper | [/docs/setuper/](https://coreline-productions.github.io/coreline/docs/setuper/) | [/bots/setuper/](https://coreline-productions.github.io/coreline/bots/setuper/) | [/privacy/setuper/](https://coreline-productions.github.io/coreline/privacy/setuper/) | Coming soon |

## Structure
.
├── .nojekyll
├── README.md
├── index.html Hub landing page
├── 404.html Not-found page
├── assets/
│ ├── style.css Shared stylesheet
│ └── status.js Status page renderer
├── _data/
│ ├── tixal.json Tixal status payload
│ └── setuper.json Setuper status payload
├── status/
│ └── index.html Global status page
├── bots/
│ ├── tixal/
│ │ └── index.html Tixal bot info page
│ └── setuper/
│ └── index.html Setuper bot info page
├── docs/
│ ├── tixal/
│ │ └── index.html Tixal documentation
│ └── setuper/
│ └── index.html Setuper documentation
├── privacy/
│ ├── index.html Policy directory
│ ├── tixal/
│ │ └── index.html Tixal privacy policy
│ └── setuper/
│ └── index.html Setuper privacy policy
├── terms/
│ └── index.html Terms of Service
└── support/
└── index.html Support server info

## Status data

Each bot writes its own JSON to `_data/<bot>.json` on a schedule via the GitHub Contents API. The site fetches those files client-side and renders the status cards. No backend, no database, no build step.

## Contact

- Email: hadtoberxr@gmail.com
- Support server: https://discord.com/invite/vEcVsGmmBn

---

© CoreLine Productions
