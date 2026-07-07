# frozen_string_literal: true

module LintServer
  # Orchestrates a single client connection: read the request line, dispatch it,
  # and write the response. Kept thin on purpose — parsing/routing lives in
  # Dispatcher and framing lives in Transport, both of which are unit-testable
  # without a real socket.
  module Controller
    module_function

    # Accepts one pending connection from +server+ and handles it.
    def call(server)
      handle(server.accept)
    end

    # Handles an already-accepted client. +client+ only needs to respond to
    # #gets, #puts and #close, which makes this testable with a fake socket.
    def handle(client)
      line = Transport.read_line(client)
      return client.close if line.nil?
      return Transport.write_response(client, Dispatcher.error("Request too large")) if Transport.line_too_long?(line)
      return client.close if line.strip.empty?

      response =
        begin
          request = JSON.parse(line)
          authorized?(request) ? Dispatcher.dispatch(request) : Dispatcher.error("Unauthorized")
        rescue JSON::ParserError
          Dispatcher.error("Invalid JSON")
        end

      Transport.write_response(client, response)
    end

    # The extension launches the server with a per-session token in the
    # HAML_LINT_SERVER_TOKEN env var and echoes it in every request. Requests
    # without a matching token are rejected, so another local process — or
    # another user sharing 127.0.0.1 on a multi-user host — cannot drive the
    # server (it can run arbitrary Ruby via lint/autocorrect configs). When no
    # token is configured (manual runs, tests) auth is skipped.
    def authorized?(request)
      expected = ENV["HAML_LINT_SERVER_TOKEN"].to_s
      return true if expected.empty?
      return false unless request.is_a?(Hash)

      tokens_match?(expected, request["token"].to_s)
    end

    # Length-checked constant-time string comparison, to avoid leaking the token
    # a byte at a time through response timing.
    def tokens_match?(expected, provided)
      return false unless expected.bytesize == provided.bytesize

      diff = 0
      expected.bytes.zip(provided.bytes) { |x, y| diff |= x ^ y }
      diff.zero?
    end
  end
end
