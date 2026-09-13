# frozen_string_literal: true

module LintServer
  # Wire protocol: one JSON object per line, responses written *single-encoded*.
  # Keep in sync with `src/server/index.ts`, which parses the response exactly once.
  module Transport
    module_function

    # Without a cap, a client that never sends a newline buffers until NoMemoryError,
    # which the accept loop's rescue does not catch. 16 MiB is far above any payload.
    MAX_REQUEST_BYTES = 16 * 1024 * 1024

    # The server handles one connection at a time, so a half-open connection with no
    # timeout would block #gets and everything queued behind it (a Slowloris DoS).
    READ_TIMEOUT_SECONDS = 5

    # Arms +client+'s read timeout and returns it for chaining. No-op for objects
    # without IO#timeout= (the in-memory test double).
    def apply_read_timeout(client, seconds: READ_TIMEOUT_SECONDS)
      client.timeout = seconds if client.respond_to?(:timeout=)
      client
    end

    # Reads at most +limit+ bytes. Returns the raw line, or nil when the client closed
    # or stalled. An over-limit line comes back truncated (see #line_too_long?).
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
