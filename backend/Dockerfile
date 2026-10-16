FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Dependency layer first so code edits don't bust the pip cache.
# (stub app package so hatchling can build; real code is copied over it below)
COPY pyproject.toml ./
# PIP_EXTRAS=. builds a lean image without the heavy ML runtimes (production
# default on small VMs); .[ml] keeps the full local/CI behaviour.
ARG PIP_EXTRAS=.[ml]
RUN mkdir -p app && touch app/__init__.py \
  && pip install --upgrade pip && pip install "${PIP_EXTRAS}"

COPY app ./app

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
