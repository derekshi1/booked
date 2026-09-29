"""Long-running Python worker for server.js (see python-worker.js).

Keeps the book catalog and ML models in memory between requests (models load on
first use), and serves tasks over stdin/stdout, one JSON object per line:
    request:  {"id": 1, "task": "single", "args": {"isbn": "..."}}
    response: {"id": 1, "ok": true, "result": ...}  or  {"id": 1, "ok": false, "error": "..."}
The first line written is {"ready": true}; the catalog then loads in the background.
"""
import json
import sys
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor

# The recommendation scripts print debug output; keep stdout for the protocol only.
protocol_out = sys.stdout
sys.stdout = sys.stderr

import catalog  # noqa: E402  (imported after the redirect so their output goes to stderr)
import recommender  # noqa: E402
import series_recommendations  # noqa: E402

# spaCy pipelines aren't guaranteed thread-safe, so list generation runs one at a time.
lists_lock = threading.Lock()


def run_recommendations(args):
    return recommender.recommend(args['library'], args.get('exclude') or [], username=args.get('username'))


def run_single(args):
    book = recommender.book_for_isbn(args['isbn'])
    if not book:
        raise ValueError('Book not found')
    return recommender.similar(book)


def run_opposite(args):
    return recommender.opposite(args['library'], args.get('exclude') or [])


def run_lists(args):
    # spaCy is slow to import, so load it only when a list is first generated
    import listgeneration
    with lists_lock:
        return listgeneration.generate_recommendations(args['query'])


def run_refresh_catalog(args):
    stats = catalog.refresh(google_budget=int(args.get('googleBudget', 60)),
                            time_budget=args.get('timeBudgetSeconds'),
                            log=lambda m: print(m, file=sys.stderr))
    recommender.get_catalog(force=True)
    return stats


def run_series(args):
    return series_recommendations.get_series_recommendations()


TASKS = {
    'recommendations': run_recommendations,
    'single': run_single,
    'opposite': run_opposite,
    'lists': run_lists,
    'series': run_series,
    'refresh_catalog': run_refresh_catalog,
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


def warm_up():
    # Load the catalog into memory before the first request needs it
    try:
        recommender.get_catalog()
    except Exception:
        traceback.print_exc()


def main():
    threading.Thread(target=warm_up, daemon=True).start()
    send({'ready': True})
    # Tasks are mostly network-bound; model inference is serialized in models.py.
    with ThreadPoolExecutor(max_workers=4) as pool:
        for line in sys.stdin:
            if line.strip():
                pool.submit(handle, json.loads(line))


if __name__ == '__main__':
    main()
