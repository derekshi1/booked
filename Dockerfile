FROM node:20-bookworm-slim

# Python for the recommendation scripts spawned by server.js
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

# Put the venv first on PATH so server.js's `python3` resolves to it
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /usr/src/app

# CPU-only torch keeps the image far smaller than the default CUDA build
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
    && pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-MiniLM-L6-v2')"

# Models are baked in above; skip Hugging Face network checks at runtime
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
