FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o pratibimba .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
RUN adduser -D appuser
WORKDIR /app
COPY --from=builder /app/pratibimba .
COPY --from=builder /app/assets ./assets
RUN mkdir -p /app/generated_pdfs && chown -R appuser:appuser /app
ENV FONT_DIR=/app/assets/fonts
ENV GENERATED_PDF_DIR=/app/generated_pdfs
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["./pratibimba"]