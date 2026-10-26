# Studio customer demonstration

`/studio` is a read-only product demonstration. It presents the intended evidence → Pilot proposal → owner approval → seat-view workflow and an interactive fictional theatre. Visitors can rotate the model, select three suggested seats or any visible seat, and enter a seated view. It uses no saved project, upload, cloud account, Blender job or AI request. The example geometry is illustrative and is labelled as such in the page.

The existing editing workspace is at `/studio/workspace` in local development. Existing local projects still load there. Production builds omit that route and its editor bundle by default. For a controlled operator build, set `VITE_ENABLE_WORKSPACE=true` when building. This flag and the URL split are **not authentication**. Do not put that operator build on a public host until owner authentication and authorization protect both the page and the underlying Pilot, build, cloud and sharing endpoints.

For a local walkthrough, run `npm run dev`, visit `/studio`, and try the three seat cards. Open `/studio/workspace` directly for the owner tools. The managed customer viewer bundle remains a separate build and does not include either route.
