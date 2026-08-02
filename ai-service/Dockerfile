FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# SALONAI_PHASE_7_11_AI_NONROOT_HARDENING=2
RUN mkdir -p /app /tmp && chown -R 10001:10001 /app /tmp
ENV HOME=/tmp
USER 10001:10001
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
