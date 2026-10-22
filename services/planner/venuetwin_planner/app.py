"""Local, opt-in offline service. No live provider is selectable in Phase 1."""
import os
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from .body_limit import BodyLimit
from .contract import VenueDocument, missing_inputs
from .planning import OfflinePlanner, Plan, plan


def create_app(enabled: bool | None = None) -> FastAPI:
    if enabled is None:
        enabled = os.environ.get('VENUETWIN_PLANNER_ENABLED') == '1'
    app = FastAPI(title='VenueTwin offline production planner', docs_url=None, redoc_url=None)

    app.add_middleware(BodyLimit)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        # Do not echo source text, NaN/Infinity or non-serializable validator context.
        return JSONResponse({'detail': [{'path': list(e['loc']), 'code': e['type']} for e in error.errors()]}, status_code=422)

    @app.get('/health')
    def health():
        return {'enabled': enabled, 'provider': 'offline', 'live_calls': False}

    if enabled:
        @app.post('/v1/validate')
        def validate(venue: VenueDocument):
            return {'version': venue.version, 'requirements': missing_inputs(venue)}

        @app.post('/v1/plan', response_model=Plan)
        def make_plan(venue: VenueDocument):
            return plan(venue, OfflinePlanner())

    # Reject browser cross-origin use. Do not expose this unauthenticated local
    # scaffold through the public Node API until owner auth/quotas are designed.
    @app.middleware('http')
    async def local_request(request, call_next):
        if request.headers.get('origin'):
            return JSONResponse({'detail': 'Browser integration is not enabled.'}, status_code=403)
        if request.headers.get('host', '').split(':')[0] not in ('localhost', '127.0.0.1', 'testserver'):
            return JSONResponse({'detail': 'Local service only.'}, status_code=403)
        return await call_next(request)

    return app


app = create_app()
