# AI Handoff: Vedant - Experience and Story

You are helping build **A-SYNCH**, a grand-prize-focused Nova 2026 project. Work as a product designer who implements polished interfaces and tells a tight five-minute story.

## Product

A-SYNCH is an availability-aware intelligence layer for teams. It has two equal entry points:

1. **Ask your team** when the user needs an answer but does not know who has it.
2. **Talk to a person's context agent** when the user already knows whose stated perspective or walkthrough they need.

Both create an evidence-backed Situation Brief containing status, decision history, owners, next steps, downstream blockers, sources, and trust state.

## Your centerpiece

Design a **Team Intelligence Mesh**, not another chatbot.

Show five teammate nodes around an active Project Atlas situation. Each person has an avatar, role, available/busy/away state, and expertise chips. When the user asks "Can we ship Atlas today?", the relevant people illuminate and evidence visibly flows into the center before the brief assembles.

This sequence should be beautiful, legible from a projector, and short enough not to slow the demo.

## Demo scenario

- Priya: team lead, unavailable, owns release principles.
- Alex: backend, merged and passing.
- Sam: frontend, rollout control incomplete.
- Jordan: security review still open.
- Maya: three customers waiting for beta access.

The brief should conclude that an internal beta can ship after the frontend rollout control merges, while GA remains blocked by security and SSO requirements.

## Your ownership

- Team Intelligence Mesh
- Ask flow and agent-routing animation
- Situation Brief layout
- Decision tree
- Person and source cards
- Direct conversation with Priya's context agent
- Confirmed / supported / needs-human states
- Motion, responsive presentation view, and visual identity
- Pitch deck and demo choreography

Primary paths: `app/` except server API routes, `components/`, `public/`, `docs/pitch/`.

## Required screens and states

1. Home mesh with "Ask your team anything"
2. Routing state showing selected people and incoming evidence
3. Situation Brief with answer, status, decision tree, next step, sources, and blockers
4. Priya's context-agent conversation, accessible directly from her profile
5. Trust state showing confirmed evidence
6. Human-handoff state when the user requests approval
7. Intentional fallback/offline state

## Three-minute demo choreography

1. Show Priya unavailable and ask, "Can we ship Atlas today?"
2. Animate Alex, Sam, Jordan, and Priya contributing context.
3. Reveal the brief and decision tree.
4. Open Priya's agent directly and ask about a 10% beta rollout.
5. Show her stated beta principle and its source.
6. Ask the agent to approve the launch.
7. Show the human-handoff state and one-click confirmation request.

Use restrained futuristic visuals, strong hierarchy, large type, and a distinctive mesh animation. Avoid a generic gradient-heavy AI dashboard. Build from the fixed `SituationBrief` fixture first so backend work cannot block you.

Pitch the human problem first, the visual mesh second, and the architecture only after the audience understands the magic.

Core close:

> Every company already has the answers. A-SYNCH finds who knows, shows the evidence, and keeps work moving without putting words in anyone's mouth.
