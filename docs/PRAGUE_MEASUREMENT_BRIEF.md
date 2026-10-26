# Prague National Theatre: survey and image request

**Status: request package only.** VenueTwin has not received measured auditorium data, seat photographs, image rights, or owner approval. The current 263-seat Prague viewer is an estimated study and must not be described as an accurate view.

## Exact scope

Historical National Theatre building, stalls rows 1–13. The [official seating-plan page](https://www.narodni-divadlo.cz/en/stages/the-national-theatre/seating-plan) identifies the sale seats. The checked [intake](../venue-data/national-theatre-prague/intake.json) and [263-row survey table](../venue-data/national-theatre-prague/seat-survey.csv) provide stable IDs. The theatre's [stage-technology page](https://www.narodni-divadlo.cz/en/stages/the-national-theatre/stage-technology) offers stage drawings, but these do not establish current auditorium seat-eye coordinates. Do not use the historical 1914 plan, a seating-plan PDF scale, or gallery photos as a current metric seat survey.

## Requested from the theatre or appointed surveyor

1. A current dimensioned auditorium plan plus longitudinal and cross sections, or a point cloud/BIM/CAD model with stated units, coordinate origin, axis directions, survey date, and expected positional error. Include the stage opening and a measured target point, stalls floor and row elevations, shell, aisles, columns, rails, parapets, pit, and other view-blocking features. Mark elements absent in the surveyed scope as absent rather than omitting them silently.
2. For each of the 263 sale-seat IDs in `seat-survey.csv`, enter seat anchor `position_x/y/z_m`, seated-eye `eye_x/y/z_m`, facing `yaw_rad`, `source_id`, `uncertainty_m`, and `review_status=measured`. The seated-eye location should be observed or derived from a documented repeatable seat/occupant-height method; do not copy VenueTwin's 0.9 m illustrative offset. Preserve the supplied seat ID and row membership. If a seat cannot be measured, leave it `unmeasured` and state why.
3. Source files for all recorded measurements, with a stable source ID, capture date, instrument/method, operator, and calibration or control-point notes. Supply the coordinate transform used to register each source to the common frame. VenueTwin stores source hashes so later changes can be detected.
4. Seat-level reference photos from the selection below and any known restricted-view seats. Each needs the exact seat ID, actual lens/field of view (or focal length and sensor/crop), orientation, camera height/eye point, date, unedited original file, and written rights for private model comparison. Separate permission is needed to embed any photographic texture or publish a venue image. A photo without seat and camera metadata is useful for appearance study but cannot calibrate a seat view.
5. A named theatre reviewer who can check the measured geometry and compare rendered images with the source photos. Record corrections, then explicitly approve or reject geometry, seat views, and publication rights. The approval record must refer to the exact final venue/model revision; permission to inspect source material is not permission to publish it.

Suggested initial photo positions are stalls row 1 seat 11; row 4 seats 1, 11, 22; row 7 seats 1, 10, 19; row 10 seats 1, 10, 20; and row 13 seats 1, 8, 15. These 13 IDs cover centre, side, front and rear of the scoped stalls. The reviewer should add every known restricted or atypical view. This is a validation sample, not a substitute for measuring all 263 seats.

## Handoff and acceptance

The surveyor can first return a partial table and the source files for a pilot calibration. The full stalls model remains a study until all 263 seats and the relevant shell and obstructions have measured evidence. Run `PYTHONPATH=services/planner python3 -m venuetwin_planner.intake venue-data/national-theatre-prague` after inserting measurements; it reports exact missing fields. Compile the complete intake with `venuetwin_planner.compile_intake`, build the GLB with Blender, run the Three.js round-trip check, and use `scripts/photo-alignment.mjs` to compare measured 3D landmarks with each calibrated seat photo. A passing numerical check only establishes consistency among supplied data, model and photo landmarks. The reviewer must still inspect geometry, materials, lighting and full views before signing off.

## Unsent request to the theatre

The [official contact page](https://www.narodni-divadlo.cz/cs/kontakty) lists `info@narodni-divadlo.cz`; it is a general contact, not a confirmed surveying or licensing contact. Ask it to route this request to the historical building's technical, archive, photography and rights teams. No message has been sent by VenueTwin.

> Subject: Request for measured auditorium data and a controlled seat-view pilot
>
> Hello National Theatre team,
>
> I represent VenueTwin, a digital venue and seat-view service. I would like to ask whether the theatre would consider a controlled pilot for the historical building's stalls (rows 1–13). We have a transcription of the 263 sale-seat identifiers from your public seating plan, but we will not present estimated positions as accurate.
>
> Could you direct me to the person responsible for current auditorium survey/CAD data and the person who can discuss reference photography, use rights and review? We would need a current measured plan/sections or point cloud, seat and seated-eye positions in one coordinate frame, and a small set of seat-identified camera-calibrated photos. The attached brief specifies the fields and proposes a review process. We would keep provided source files private and would not publish a venue model or photographs without explicit permission and review of the final version.
>
> If this is possible, I would welcome a short discussion about access, scope and any fees before collecting data.
>
> Best regards,
> VenueTwin team
