# Pilot local v1

Pilot turns reviewed customer materials into an editable layout, then hands it to the existing local Blender builder and customer viewer. This is a consolidated local release candidate, not a hosted autonomous customer service. Its general architecture is approximate; decorative reconstruction still needs further modelling.

## Complete workflow

1. Start with `npm run dev`. Configure `OPENAI_API_KEY` in `.env.local` (never a `VITE_` variable) and the existing Blender path setup. Keep secrets out of Git.
2. In **Project → Materials**, save customer plans/photos, notes and measurements. Include source locations and distinguish measured values from estimates.
3. In **Project → Pilot**, analyse selected files. Review each extracted finding and accept only useful findings. Analysis is a paid request; acceptance is human review, not independent verification.
4. Choose a starting point: **Build from materials**, **Complete the architecture**, **Refine seating**, **Prepare seat categories**, or **Review before delivery**. These editable briefs invoke the same bounded toolset; they do not run hidden jobs.
5. Describe changes and generate a proposal. With automatic correction enabled, there are at most two paid planning requests. Missing data becomes questions; keeping existing values does not establish measurement accuracy.
6. Review actions, sources, estimates, capacity, questions and local geometry warnings. Answer questions and regenerate as needed. Nothing changes before Apply. Applying the plan is one undoable edit; stale venue/reference proposals are rejected.
7. **Apply and build 3D model** moves to Model and invokes the local Blender job. If the build fails or is cancelled, the applied layout remains editable. Retry from Model. Compare representative seat views; automated checks cannot establish visual fidelity.
8. In **Preview & share**, open **Customer preview**. In its **Website setup**, download `venue.json` and the matching `venue.glb` when present. Upload them together to a versioned `/venues/…` folder on the website running VenueTwin. Test the published viewer, touch controls and seat links.
9. In Pilot's **Workflow & saved draft**, download `pilot-handover.json`. It contains the current configuration, general Blender blueprint, conservative checks, last applied proposal and source text. It explicitly marks changed layout/reference context. It does not contain original uploads or the generated GLB, and it never certifies a build or delivery as completed. Review private text before sharing.

## Tools available to the planner

Every action carries a source description and a `provided` or `estimated` basis. The strict shared schema, runtime validator and complete dry run reject unsupported actions before mutation. `allowEstimates=false` rejects any action labelled estimated; source truth still needs human review.

| Area | Actions | Contract |
| --- | --- | --- |
| Room | `set_room`, `remove_room` | Rectangular shell, dimensions, position, rotation, ceiling and flat colours. Existing openings survive edits. |
| Openings | `save_room_opening`, `remove_room_opening` | Empty rectangular wall apertures, bounded to room dimensions; no frames/glazing. |
| Stage / screen | `set_stage`, `set_stage_dimensions` | Width/position/rotation, depth, screen width/height/bottom. Null preserves a field. |
| Seating | `set_seating`, `edit_row` | Layout defaults, explicit row counts, row elevations/offsets/rotation/curve and front railings. Surviving overrides are preserved. |
| Arcs / labels | `set_row_arc`, `set_row_label` | Arc radius/span supplied together; both null remove the arc. Null label restores default numbering. |
| Levels | `save_level`, `assign_rows`, `remove_level` | Add/update balconies, assign row ranges. Removal preserves world row heights. |
| Structures | `save_obstacle`, `remove_obstacle` | Box-shaped columns, walls and railings; upsert by ID. |
| Categories | `save_category`, `remove_category` | Up to eight including Standard; name, colour, optional price. Null price explicitly means unpriced. Removing a category reassigns references to Standard. |
| Assignments | `assign_row_category`, `assign_seat_category` | Row assignment clears its individual seat overrides. Null seat category restores inheritance. |
| Accessibility | `label_accessible_seat` | Metadata on an existing chair only; no wheelchair bay geometry or certification. |
| Currency | `set_currency` | Display currency only; no conversion. |

Action row and seat positions are **1-based array positions**, not necessarily printed ticket numbers. Removal/reset operations require explicit intent in the planning contract and are visible in review. There is no executable code, arbitrary property mutation, shell or URL-fetch tool available to the planner.

Arcs use the same Studio geometry: local X = sin(angle) × radius; local Z = cos(angle) × radius, then row rotation and offsets. They omit default row-depth and sector aisle offsets. Do not treat arc radius as a world-centre coordinate.

## Persistence and handover

The brief, estimation/source/correction settings and last applied proposal are saved per project in this browser's local storage. No API key or original file bytes are stored there. Pending proposals and unfinished question answers are not restored; generate a fresh proposal after refresh. Reopening never starts a paid request. Storage failures appear in the panel. Browser storage is local, not a cross-device backup; export project and handover files for a durable copy.

The handover's evidence match compares the current Pilot snapshot and selected reference context with the last applied proposal. A match does not prove every current field was sourced: preserved template defaults may remain. It is an audit of the last applied operation, not a complete editing history. No-applied-proposal and changed-context cases are explicit.

## Validation and acceptance

Automated tests cover strict API boundaries with mocked responses, estimates, stale proposals, atomic apply and undo, cancellation, room openings, layout checks, metadata and removals, browser-storage restoration, handover freshness, and a supplied-material fixture through planner validation → apply → Blender blueprint → handover. Generic row decks now follow actual row elevations, including when a final seating level is removed.

Run `npm test`, `npm run lint`, and `npm run build`. Mocked responses prove code contracts, not model quality. No live API credits are needed for these tests.

Before calling this production-ready, complete this local acceptance run:

- On your Mac, generate a proposal from real reviewed materials and confirm source fidelity.
- Refresh and confirm the saved brief/settings; generate again and apply, then Undo/Redo.
- Build through the installed Blender executable and inspect the model, including openings and elevated rows.
- Verify handover reports a changed context after editing geometry or accepted references.
- Check first/last/edge/balcony seats in the customer viewer on desktop and a phone.
- Publish matching viewer assets to a versioned folder and test a shared seat link in a separate browser.

## Deliberate limits and next work

- AI and Blender jobs remain localhost-only. Hosted queues, customer authentication for paid work, usage budgets, durable job storage and automatic delivery require a backend deployment.
- Pointer-driven plan calibration/boundary tracing, arbitrary row insertion/deletion, specialised National Theatre numbering and reference-view matching remain manual Studio tasks. Pilot can change total row counts and individual row settings, but cannot safely infer those pointer/identity operations.
- The architectural detail extension adds framed panels, portals, coffers, faceted columns and curved balcony fascias; see [Architectural details](ARCHITECTURAL_DETAILS.md). Polygonal room shells, complex ceiling meshes, door leaves/glass, texture reconstruction and sculptural ornament remain unsupported. The detailed National Theatre study remains a separate specialised workflow.
- Dedicated wheelchair bays and circulation routes are not represented by ordinary chair labels.
- Layout checks are conservative modelling diagnostics, not collision-complete, accessibility, egress, structural or sightline certification.
- No automatic proof that a photo is from an identified seat. Human comparison and better source material remain necessary.
- Original files, local drafts and GLB storage are not automatically synchronised with the cloud project.
- Live model behaviour, Blender execution on the user's Mac, browser appearance and phone controls require the acceptance run above. They are not established by unit tests or a successful production build.

### Starting without a template

In New project, enter a name, choose a venue type and optionally attach a floor plan, then select **Start blank**. The project starts with zero seats and no room, levels or obstacles. Stage and spacing values remain editable editor defaults, not measured facts. Use Pilot to propose seating, or Layout → Add first row. Empty drafts can be saved; customer preview and Blender export require seating.
