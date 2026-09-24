"""Shared ML models, loaded once per process.

In the long-running worker (worker.py) every script shares one copy of the
sentence-transformer instead of each loading its own.
"""
import threading
from functools import lru_cache

SENTENCE_MODEL_NAME = 'paraphrase-MiniLM-L6-v2'


@lru_cache(maxsize=None)
def get_sentence_model():
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(SENTENCE_MODEL_NAME)
    model.eval()

    # The worker runs tasks on several threads; Hugging Face fast tokenizers are
    # not safe to call concurrently, so serialize encode() (CPU-bound anyway).
    encode_lock = threading.Lock()
    unlocked_encode = model.encode

    def encode(*args, **kwargs):
        with encode_lock:
            return unlocked_encode(*args, **kwargs)

    model.encode = encode
    return model
