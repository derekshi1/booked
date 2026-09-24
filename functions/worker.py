"""Long-running Python worker for server.js (see python-worker.js).

Loads the ML models once at startup, then serves tasks over stdin/stdout, one
JSON object per line:
    request:  {"id": 1, "task": "single", "args": {"isbn": "..."}}
    response: {"id": 1, "ok": true, "result": ...}  or  {"id": 1, "ok": false, "error": "..."}
The first line written is {"ready": true} once the models are loaded.
"""
import asyncio
import json
import sys
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor

# The recommendation scripts print debug output; keep stdout for the protocol only.
protocol_out = sys.stdout
sys.stdout = sys.stderr

import listgeneration  # noqa: E402  (imports load models, so they come after the redirect)
import oppositerecommendations  # noqa: E402
import recommendations  # noqa: E402
import series_recommendations  # noqa: E402
import singleRecs  # noqa: E402

# spaCy pipelines aren't guaranteed thread-safe, so list generation runs one at a time.
lists_lock = threading.Lock()


def run_recommendations(args):
    try:
        return asyncio.run(recommendations.find_best_matches(args['library']))
    except Exception:
        # Matches the old script's behavior: an empty list, not an error
        traceback.print_exc()
        return []


def run_single(args):
    book_info = asyncio.run(singleRecs.get_book_info(args['isbn']))
    if not book_info:
        raise ValueError('Book not found')
    return asyncio.run(singleRecs.find_best_matches(book_info))


def run_opposite(args):
    return oppositerecommendations.find_opposite_least_similar(args['library'], total_recommendations=15)


def run_lists(args):
    with lists_lock:
        return listgeneration.generate_recommendations(args['query'])


def run_series(args):
    return series_recommendations.get_series_recommendations()


TASKS = {
    'recommendations': run_recommendations,
    'single': run_single,
    'opposite': run_opposite,
    'lists': run_lists,
    'series': run_series,
}

write_lock = threading.Lock()


def send(message):
    line = json.dumps(message)
    with write_lock:
        protocol_out.write(line + '\n')
        protocol_out.flush()


def handle(request):
    try:
        result = TASKS[request['task']](request.get('args') or {})
        send({'id': request['id'], 'ok': True, 'result': result})
    except Exception as e:
        traceback.print_exc()
        send({'id': request['id'], 'ok': False, 'error': str(e)})


def main():
    send({'ready': True})
    # Tasks are mostly network-bound; model inference is serialized in models.py.
    with ThreadPoolExecutor(max_workers=4) as pool:
        for line in sys.stdin:
            if line.strip():
                pool.submit(handle, json.loads(line))


if __name__ == '__main__':
    main()
