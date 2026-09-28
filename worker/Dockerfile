FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml ./
COPY trellis_worker ./trellis_worker
RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10001 worker
USER worker

CMD ["python", "-m", "trellis_worker"]
