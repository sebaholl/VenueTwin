import json
import httpx
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI
from venuetwin_planner.app import create_app
from venuetwin_planner.contract import VenueDocument
from venuetwin_planner.planning import OpenAIPlanner, OfflinePlanner, plan


def test_disabled_by_default_even_with_api_key(monkeypatch, draft):
    monkeypatch.delenv('VENUETWIN_PLANNER_ENABLED', raising=False)
    monkeypatch.setenv('OPENAI_API_KEY', 'unused-test-key')
    with TestClient(create_app()) as client:
        assert client.post('/v1/plan', json=draft).status_code == 404
        assert client.get('/health').json()['live_calls'] is False
        assert '/v1/plan' not in client.get('/openapi.json').json()['paths']


@pytest.mark.parametrize('flag', ['true', '0', '', 'yes'])
def test_flag_requires_exact_opt_in(monkeypatch, flag):
    monkeypatch.setenv('VENUETWIN_PLANNER_ENABLED', flag)
    assert TestClient(create_app()).get('/health').json()['enabled'] is False


def test_enabled_http_and_strict_errors(monkeypatch, draft, complete):
    monkeypatch.setenv('VENUETWIN_PLANNER_ENABLED', '1')
    with TestClient(create_app()) as client:
        blocked = client.post('/v1/plan', json=draft)
        assert blocked.status_code == 200
        assert blocked.json()['status'] == 'blocked'
        assert blocked.json()['steps'] == []
        assert client.post('/v1/validate', json=draft).json()['requirements'] == blocked.json()['requirements']
        ready = client.post('/v1/plan', json=complete).json()
        assert ready['status'] == 'ready_for_review'
        assert ready['requires_human_review'] is True
        assert client.post('/v1/plan', json={'unexpected': True}).status_code == 422
        assert client.post('/v1/plan', json=complete, headers={'Origin': 'https://example.org'}).status_code == 403
        assert client.get('/health', headers={'Host': 'example.org'}).status_code == 403


def test_incomplete_inputs_never_invoke_provider(draft):
    class Forbidden:
        def advise(self, venue):
            raise AssertionError('Provider must not run')
    assert plan(VenueDocument.model_validate(draft), Forbidden()).status == 'blocked'


@pytest.mark.parametrize('kind', ['valid', 'refusal', 'incomplete', 'invalid', 'http_error'])
def test_real_sdk_with_mock_transport_only(complete, kind):
    calls = []
    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        assert body['store'] is False
        assert body['max_output_tokens'] == 1200
        assert body['text']['format']['strict'] is True
        assert 'tools' not in body
        assert 'source_ids' not in body['input']
        if kind == 'http_error': return httpx.Response(503, json={'error': {'message': 'mock unavailable'}})
        content = [{'type': 'output_text', 'text': json.dumps({'steps': ['Review measured alignment.']} if kind != 'invalid' else {'execute': 'bad'}), 'annotations': []}]
        if kind == 'refusal': content = [{'type': 'refusal', 'refusal': 'Mock refusal'}]
        return httpx.Response(200, json={
            'id': 'resp_mock', 'object': 'response', 'created_at': 0, 'model': 'offline-model',
            'status': 'incomplete' if kind == 'incomplete' else 'completed',
            'output': [{'id': 'msg_mock', 'type': 'message', 'role': 'assistant', 'status': 'completed', 'content': content}],
        })
    with OpenAI(api_key='offline-test-key', max_retries=0, http_client=httpx.Client(transport=httpx.MockTransport(handler))) as client:
        planner = OpenAIPlanner(client, 'offline-model')
        venue = VenueDocument.model_validate(complete)
        if kind == 'valid':
            result = plan(venue, planner)
            assert result.steps == ['Review measured alignment.']
            assert result.requires_human_review is True
        else:
            with pytest.raises(Exception): plan(venue, planner)
    assert len(calls) == 1


def test_offline_plan_is_deterministic(complete):
    venue = VenueDocument.model_validate(complete)
    assert plan(venue, OfflinePlanner()) == plan(venue, OfflinePlanner())


def test_request_budget_and_nonfinite_errors(draft):
    with TestClient(create_app(enabled=True)) as client:
        assert client.post('/v1/plan', content=b' ' * (2 * 1024 * 1024 + 1)).status_code == 413
        draft['seats'][0]['position_m'][0] = float('nan')
        response = client.post('/v1/plan', content=json.dumps(draft), headers={'Content-Type': 'application/json'})
        assert response.status_code == 422
        assert 'input' not in response.text
