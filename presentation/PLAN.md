# KTx-CONNECT demo: build plan

Source: `DEAP/KTx-CONNECT (DEAP) Hackathon Builder Packet.pdf` and `DEAP/DEAP one-pager.pdf`. The one-pager asks for a self-contained prototype with sample data. Judging asks whether the loop is closed, the coordinator's workload drops, the teen's privacy is respected, and the design works for families.

## Must-keep loop (packet pages 3-4)
1. Structured barrier checklist (BAT: 14 yes/no items).
2. Patient and caregiver answer separately. Disagreement is a signal.
3. Every barrier has a named owner, routed by role.
4. One concrete plan per barrier, made with the patient.
5. Owner checks back within 2 weeks: Working / Not working / Adjust.
6. Risk signals (optional for this demo, not in scope today).

## Build scope for today
- **Barrier checklist:** replace the two free-text barriers with the 14 BAT items. Patient and caregiver each get their own yes/no form.
- **Routing:** each barrier routes to a team role from the packet's reference table (transplant coordinator, nephrologist/NP/pharmacist, social worker, psychologist). A fictional named team member is assigned as owner.
- **Privacy:** the teen's answers never appear in the caregiver view. The caregiver's answers never appear in the teen view. Only the coordinator sees both, with disagreements marked.
- **One agreed plan:** one plan tied to one barrier. It has an owner, a chosen action plan from the packet's five options, and a follow-up date within 14 days.
- **Follow-up:** Working / Not working / Adjust, with a new date within 14 days. This already exists and stays.
- **Coordinator worklist:** short, max 5 items. Covers hard barriers to escalate to a human, unowned barriers, follow-ups due or overdue, and missing answers.
- **Responsive and accessible:** keep the current layout, with 44px touch targets and labelled controls.

## Out of scope today
Real data, backend, APIs, accounts, AI-generated advice, the risk-signal screen, the 6-month repeat, pill monitoring, and deployment. The demo site in the packet isn't used.

## Files
- `index.html`: unchanged.
- `styles.css`: small additions for the checklist grid and disagreement marker.
- `app.js`: rewritten around the new data model. Storage key bumps to `ktx-connect-demo-v2`, so older saved demo data is ignored rather than migrated.
- `PLAN.md`: this file.
- Smoke tests stay in `/tmp/qa` and are updated for the new behavior.

## Assumptions
- The fictional teen is 15(MAYA, so both patient and caregiver answer separately (the packet asks for this at age 10 and up).
- BAT item wording follows the packet's short labels, not the official instrument text.
- Action plan options are the five titles from the packet. The demo shows their names only, not clinical instructions.
- Hard barriers (cost, mood, refusal, and similar) escalate to a human. Demo routing is static and fictional.

## Presentation
- Will figure out PowerPoint as we go on and develop...