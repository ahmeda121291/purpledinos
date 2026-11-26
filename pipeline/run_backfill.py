import time
import requests
import backfill as b

_post = requests.post


def post(*a, **k):
    for i in range(6):
        try:
            return _post(*a, **k)
        except requests.exceptions.RequestException as e:
            b.log("post retry", i + 1, repr(e)[:120])
            time.sleep(5 * (i + 1))
    return _post(*a, **k)


b.requests.post = post
_orig = b.ingest


def ingest(table, rows, batch=400):
    return _orig(table, rows, batch=min(batch, 100))


b.ingest = ingest

if __name__ == "__main__":
    try:
        b.main()
    except Exception as e:  # noqa: BLE001
        b.log("FAILED", repr(e))
