# frozen_string_literal: true

module LintServer
  # Wire protocol between the VS Code extension and this server.
  #
  # Framing: one JSON object per line. Requests are read with #read_line;
  # responses are written *single-encoded* with #write_response. Keep this in
  # sync with the TypeScript client in `src/server/index.ts`, which parses the
  # response exactly once.
  module Transport
    module_function

    # Cap on a single request line. Without it, a client that streams bytes
    # without ever sending a newline makes #gets buffer until the process runs
    # out of memory and dies with a NoMemoryError — which is not a
    # StandardError, so the accept loop's rescue would not catch it. 16 MiB is
    # far above any real lint/autocorrect payload.
    MAX_REQUEST_BYTES = 16 * 1024 * 1024

    # How long a client may take to send its request line. The server is
    # single-threaded and handles one connection at a time, so a slow or
    # half-open connection with no timeout would block #gets — and every request
    # queued behind it — indefinitely (a Slowloris DoS). Ruby 3.2+ IO#timeout
    # makes blocking reads raise IO::TimeoutError past the deadline.
    READ_TIMEOUT_SECONDS = 5

    # Arms +client+'s read timeout so a stalled connection is dropped instead of
    # wedging the accept loop. No-op for objects that don't support IO#timeout=
    # (e.g. the in-memory test double). Returns +client+ for chaining.
    def apply_read_timeout(client, seconds: READ_TIMEOUT_SECONDS)
      client.timeout = seconds if client.respond_to?(:timeout=)
      client
    end

    # Reads a single request line from the client, reading at most +limit+
    # bytes. Returns the raw line (including trailing newline), or nil when the
    # client closed without sending anything or stalled past its read timeout.
    # An over-limit line comes back truncated and without a newline — see
    # #line_too_long?.
    def read_line(client, limit: MAX_REQUEST_BYTES)
      client.gets("\n", limit)
    rescue IO::TimeoutError
      nil
    end

    # True when +line+ hit the byte cap without a terminating newline, i.e. the
    # client sent an oversized or unframed request that #read_line truncated.
    def line_too_long?(line, limit: MAX_REQUEST_BYTES)
      line.bytesize >= limit && !line.end_with?("\n")
    end

    # Serializes +payload+ to a single JSON line, writes it, and closes the
    # connection. The client is always closed, even if writing raises.
    def write_response(client, payload)
      client.puts(JSON.generate(payload))
    ensure
      client.close
    end
  end
end
