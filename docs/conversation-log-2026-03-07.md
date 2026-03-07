# Conversation Log — March 7, 2026

Session where the metaphysical UI project discussion evolved into a unified theory of LLM harness design.

---

## Part 1: Metaphysical UI — Design Discussion

### The Concept
Shreyas shared Figma mocks for a personal website with a "metaphysical UI" — a UI that has a sense of physical presence. It reacts to touch (hover), movement (scroll with inertia/springs), and atmosphere (mouse velocity as "wind").

**Figma source:** `figma.com/design/ocBdmzxLqc9qT6PK88ODnJ/Site?node-id=1050-1962`

### Homepage Structure
1. **Hero** — "Shrey is / Designer. Mushroom grower. Cat dad."
2. **Widget strip** — Horizontally scrollable band of interactive cards
3. **Notes** — Blog post list

### Widget Inventory
- **Music widget** — Vinyl record player, interactive (cursor scratches the record)
- **Photo frame** — Photo with white border, sticky note "Me!" attached
- **Snaps** — Polaroid-style instant photos (Fuji X100V, iPhone, Kodak Charmera)
- **GitHub contributions** — 4x8 grid, hover reveals private projects
- **Current location** — Map showing Bangalore, India

### Key Figma Annotations
- "this widget will have the record player as interactive. you can scratch the record with your cursor."
- "this post it note flickers with mouse movement, and also reacts to the horizontal scroll. the entire widget strip is reactive and a living breathing UI."
- "I should be using astro view transitions API for smooth movement across pages. can I add springs to view transition API?"

### Architecture Decisions

**Stack:** Astro + React islands + Tailwind V4 + vanilla JS springs + Cloudflare Pages

**Animation engine:** Vanilla JS springs — NOT Framer Motion.
- Spring physics: `force = -stiffness * displacement - damping * velocity`
- Render via CSS custom properties: `element.style.setProperty('--rx', value)`
- Single `requestAnimationFrame` loop drives all springs
- Bypasses React render cycle entirely

**Why not Framer Motion:**
Claude (the coding agent) self-assessed that it writes more accurate vanilla spring code than Framer Motion code. Reasons:
- FM has a large API surface that changes across versions
- Claude sometimes mixes up v10 vs v11 patterns
- Vanilla springs are 30 lines of first-principles physics — no API to remember
- CSS custom properties already bypass React renders (FM's motion values do the same thing with 40kB overhead)

**Horizontal scroll:** Custom momentum scroll with spring settle (not native overflow-x). Track pointer drag → compute velocity on release → apply momentum with spring deceleration.

**Mouse tracking:** Global velocity tracker, smoothed via low-pass filter, broadcast to all widgets.

**Debug tooling:** Build a tuning overlay with stiffness/damping/mass sliders per widget.

### Post-it Note Design

Discussed three approaches for making the post-it feel like paper:

1. **SVG path manipulation** — Deform bezier control points with spring physics (6-8 points). Lightweight, fully controllable, emergent behavior.
2. **Rive mesh deformation** — Visual editor for deformation, GPU-rendered, state machine driven by JS inputs. Better for crinkle textures.
3. **Hybrid** — SVG shell + Canvas interior for texture warping.

**Decision:** Start with simple CSS transforms (v1). No SVG deformation, no Rive. Just:
- `perspective(600px) + rotateX/rotateY` for 3D tilt
- `transform-origin: top center` (stuck edge)
- `::after` pseudo-element for corner fold
- `box-shadow` that shifts with tilt
- Four spring values: `--lift`, `--rx`, `--ry`, `--fold`
- Upgrade path to Rive later (same input signals, swap rendering target)

### Gesture Handling
Drag, hover, and tap are needed — but as vanilla Pointer Events, not Framer Motion:
- `pointerenter/leave` for hover → set spring target
- `pointerdown/up` for tap → set spring target
- Full drag for mobile: `pointerdown` → track delta → spring to rest on `pointerup`
- Widget strip touch-drag reuses the same velocity/momentum code as custom scroll
- Must set `touch-action: none` on draggable elements

---

## Part 2: The LLM-Native Tooling Tangent

### Origin
The Framer Motion vs vanilla JS discussion triggered a meta-observation: Claude writes better code from first principles than through abstractions. This led to a broader thesis.

### Core Thesis
The harness around foundational models (tools, skills, agentic loops) will make or break how LLMs operate. An LLM is a "seat of intelligence" that should be enabled to think from first principles rather than navigate human abstractions.

### The Abstraction Mismatch
- **Human path:** Learn Framer Motion docs → build mental model → orchestrate → write code
- **LLM path:** Understand spring physics → write 30 lines of vanilla JS → done

Human abstractions reduce human cognitive load. But LLMs don't have cognitive load — they have context window. Abstractions CONSUME context without giving back what they give humans.

### The Derivability Spectrum
Match abstraction level to reasoning capacity:

- **Very high capacity:** Composition, mathematical primitives (springs, state machines, parsers)
- **Medium capacity:** Systems with edge cases (gesture a11y, cross-browser compat)
- **Low capacity:** Empirically-tuned systems (cryptography, database engines, compression)

**Why this spectrum exists:**
- Left side (derivable): Fully determined by specification. Each training example reinforces the same primitives.
- Right side (empirical): Knowledge encoded in years of CVE patches, production tuning, adversarial discoveries. Not derivable from any spec.

**Design principle:** "Encode the empirical, expose the derivable." The inverse of how human-oriented libraries are built.

### Hallucination Connection
Hallucination frequency maps to the derivability spectrum:
- Rarely hallucinate spring physics (fully derivable, deductive)
- Frequently hallucinate API versions, browser compat (empirical — either in training data or not)

Research survey found:
- Long-tail knowledge → hallucination is well-established (OpenAI's Kalai et al.)
- Code API hallucination > algorithmic hallucination is documented (ACM 2024)
- But nobody has unified these under the derivability spectrum framework
- The prescriptive angle ("redesign abstractions to match model reasoning") is entirely novel

### The Training Data Distribution Problem (Shreyas's insight)

The abstraction pyramid:
- Low abstractions (vanilla JS, SQL): dense training data, self-reinforcing, version-stable
- Mid abstractions (React, Express): good data but API-surface-dependent
- High abstractions (latest frameworks): sparse data, contradictory across versions

Human-authored code encodes human cognitive limitations. Training on this teaches models our limitations alongside our knowledge.

**Synthetic data proposal:**
1. Derivation chains (spec → math → algorithm → implementation → framework)
2. Bidirectional translation data (problem → first principles → framework → tradeoffs)
3. "See-through" examples (what frameworks do internally)
4. Failure-mode data (API version errors paired with correct first-principles code)
5. Abstraction cost annotations

---

## Part 3: Context Window Economics

### Context = Working Memory
Context window is zero-sum. Even with large windows, attention degrades over distance.

**Key asymmetry:** Extended thinking tokens are DISCARDED from conversation context. Tool results PERSIST.

This means:
- Reasoning/derivation is FREE for future context (happens in discarded thinking tokens)
- Tool results are EXPENSIVE (persist forever until compaction)
- First-principles derivation is 20x cheaper in context than doc lookup

### "Context Radius of Understanding"
How many tokens does the model need to attend to in order to fully understand this code? A library that minimizes this metric is LLM-native. Even with million-token windows, attention cost matters more than window size.

### Knowledge-Aware Context Management
Per-knowledge-type strategy:
- Derivable → evict, re-derive when needed (free)
- Empirical high-frequency → evict, already in parametric memory
- Empirical low-frequency → MUST carry or retrieve
- Decisions → carry compacted, store full reasoning for retrieval
- Computable → don't store, re-compute via tool call

### Symbolic-Connectionist Routing
When to THINK (free context, good for derivable) vs COMPUTE via tool call (persists in context, good for exact computation). Models tuned for coding are being tuned to switch between these modes.

---

## Part 4: Tool Result Management

### The Problem (Observed in Real Time)
In this conversation, the Figma MCP returned ~5,000 tokens of JSX. Used once, then carried through every subsequent turn. ~37% of active context was stale tool results.

### Tool Result Compaction Strategy
After each tool result is consumed:
1. Was it fully consumed?
2. Is it likely needed again?
3. Is it re-fetchable? (Figma, file reads = cheap re-fetch)
4. Token cost of keeping it?

Decision: KEEP / COMPACT to summary / EVICT with breadcrumb

**"Re-fetchable" = tool-result equivalent of "derivable."** Re-fetch cost is almost always lower than context-carrying cost over 20+ turns.

---

## Part 5: Competitive Landscape Analysis

### Current harnesses surveyed:
- **Claude Code** — Flat accumulation → threshold compaction, subagents for isolation
- **Cursor** — IDE-based indexing, 8 parallel agents
- **Windsurf** — Cascade "Flows" for persistent session context, SWE-grep
- **Pi** — Minimal (4 tools), maximum flexibility, "the harness IS the product"
- **OpenAI Codex** — Progressive disclosure, versioned plans, most architecturally deliberate

### Gap identified:
NONE of these do knowledge-type-aware context curation, derivable vs empirical routing, reasoning token awareness, re-derivation as strategy, or per-tool-result compaction.

### Strategic assessment:
- The insight is real and publishable
- As a product, the edge is a constant factor improvement (not order-of-magnitude)
- Strongest plays: research paper, context management middleware, or tool-result compaction layer
- The middleware approach is harness-agnostic and model-agnostic

---

## Part 6: The Dual-LLM Architecture — Conscious + Subconscious

### The Human Analogy
When you go to work, your subconscious has already curated your context. It compressed yesterday into key takeaways, suppressed irrelevant memories, and surfaced what matters. You arrive with a clean working memory. No coding agent has this — they're "all conscious."

### The Architecture
Two LLMs working together:

**Subconscious (Haiku-class, small, fast):**
- Runs between every turn
- Sees full conversation history + new tool results
- Curates what the conscious sees
- Tools: `memory.compact()`, `memory.evict()`, `memory.retrieve()`, `memory.surface()`, `memory.flag()`
- Never answers user questions or writes code

**Conscious (Opus-class, large, powerful):**
- Sees ONLY what subconscious decided is relevant
- Does all task work: reasoning, coding, decisions
- Never deals with stale context — always a "fresh start" feel

### Economics
- Haiku curation: ~5% cost of Opus call
- Opus reasons over 30K focused tokens instead of 150K stale
- Better output at lower total cost

### Key Principles
- **Never truly delete** — eviction = move to session memory. Wrong decisions recoverable.
- **Separation of concerns** — surgeon doesn't manage inventory during surgery
- **The subconscious is an agent** — with its own tools, reasoning, loop. But in service of context quality.

### Harness-Agnostic Implementation
Discussion ongoing. The subconscious sits at the API boundary between the harness and the model API. Possible approaches:
1. API proxy that intercepts conversation → curates → forwards
2. SDK wrapper around Anthropic/OpenAI client
(To be explored further)

---

## The Unified Theory (Five Pillars)

1. **Derivability spectrum** — what kind of knowledge (derivable vs empirical)
2. **Training data distribution** — how models learn (synthetic data at the right altitude)
3. **Context/attention economics** — working memory management (cheaper to re-derive than store)
4. **Symbolic-connectionist routing** — when to think vs compute
5. **Dual-LLM architecture** — conscious (task) + subconscious (curation)

All five levels are the same insight: **match system design to how the model actually processes information.**

---

## Part 7: Supermemory & GAM Comparison

### Supermemory Architecture
Supermemory is a memory infrastructure product ($3M raised) with a **Memory Router** — an API proxy that intercepts LLM calls, injects relevant memories, and forwards to the provider. Integration is just changing the base URL. It decomposes data into **atomic memories** (single facts, high signal), stores in vector + graph DB, and retrieves semantically. Claims 90% token savings. Three-tier memory (working/short-term/long-term). Tracks fact evolution (mutations, refinements, inferences).

### GAM (General Agentic Memory)
Research paper with dual-agent architecture: **Memorizer** (continuous, creates memos + archives full history) + **Researcher** (on-demand, deep multi-strategy search). JIT memory pipeline — assembles context on demand, not from pre-computed summaries. Coined "context rot" for models losing details in long conversations. Outperforms RAG (>90% on RULER benchmark).

### Key Finding: Complementary, Not Competing
Supermemory/GAM handle **long-term memory** (cross-session persistence, retrieval, knowledge evolution). Our thesis handles **active context sculpting** (per-turn curation of the live messages[] array).

**Critical gap none of them fill:**
- Neither touches the messages array — they only ADD context, never REMOVE stale content
- No knowledge-type classification (derivable/empirical/re-fetchable)
- No reasoning token economics awareness
- No LLM-reasoning-based curation (they use RAG/embedding similarity)

**Ideal architecture uses both:**
```
Supermemory (tier 3: long-term storage)
    ↕
Subconscious LLM (tiers 1-2: active curation)
    ↓ sculpted messages[]
Conscious LLM (task work)
```

### The Testable Claim
Same task, same model. Compare: (a) raw conversation, (b) Supermemory injection only, (c) our subconscious sculpting. Measure output quality, token usage, hallucination rate. The hypothesis: active sculpting > passive injection.

---

## Part 8: Harness-Agnostic Implementation

### How to plug in
Three options discussed:

1. **API Proxy** (strongest, validated by Supermemory's Memory Router in production)
   - Set `ANTHROPIC_BASE_URL=http://localhost:8080`
   - Proxy intercepts messages[] → runs Haiku curation → sculpts context → forwards
   - Works with any harness, zero code changes

2. **SDK Middleware** — wrap Anthropic/OpenAI SDK's `messages.create()`

3. **Claude Code Memory File Watcher** (works TODAY)
   - Background process watches conversation, updates memory/*.md on disk
   - Claude Code loads updated files next turn
   - Write-only subconscious (can add, can't remove)

### Build Sequence
1. Tool-result compactor (one capability, measurable MVP)
2. Knowledge-type classification layer
3. Session memory with retrieval
4. Cross-session memory (Supermemory as possible backend)
5. Full subconscious with curation tool set

---

## Key References Found
- [Why Language Models Hallucinate — OpenAI (Kalai et al.)](https://openai.com/index/why-language-models-hallucinate/)
- [The Law of Knowledge Overshadowing — ACL 2025](https://aclanthology.org/2025.findings-acl.1199.pdf)
- [LLM Hallucinations in Practical Code Generation — ACM](https://dl.acm.org/doi/10.1145/3728894)
- [On Mitigating Code LLM Hallucinations with API Documentation](https://arxiv.org/html/2407.09726v1)
- [Agentic Context Engineering (ACE Paper)](https://arxiv.org/abs/2510.04618)
- [Effective Context Engineering — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)
- [Pi Coding Agent — What I Learned](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- [Detecting Hallucinations Using Semantic Entropy — Nature](https://www.nature.com/articles/s41586-024-07421-0)
- [Supermemory Research](https://supermemory.ai/research)
- [Supermemory — Memory Engine Architecture](https://supermemory.ai/blog/memory-engine/)
- [Supermemory Memory Router](https://supermemory.ai/docs/memory-router/overview)
- [Supermemory — API Interoperability](https://supermemory.ai/blog/we-solved-ai-api-interoperability/)
- [GAM: Dual-Agent Memory — VentureBeat](https://venturebeat.com/ai/gam-takes-aim-at-context-rot-a-dual-agent-memory-architecture-that)
- [GAM — The Decoder](https://the-decoder.com/general-agentic-memory-tackles-context-rot-and-outperforms-rag-in-memory-benchmarks/)
- [GAM GitHub](https://github.com/VectorSpaceLab/general-agentic-memory)
- [Mem0 vs Supermemory — LogRocket](https://blog.logrocket.com/building-ai-apps-mem0-supermemory/)
