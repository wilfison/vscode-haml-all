# frozen_string_literal: true

module LintServer
  # Orchestrates a single client connection: read, dispatch, respond. Parsing lives
  # in Dispatcher and framing in Transport, both unit-testable without a socket.
  module Controller
    # Set by lib/server.rb under --no-auth, for local runs without a token. The
    # extension always passes a token, so this stays false there.
    class << self
      attr_accessor :allow_unauthenticated
    end
    self.allow_unauthenticated = false

    module_function

    # Accepts one pending connection and handles it. The read timeout is armed on the
    # real socket, so a stalled client cannot block the single-threaded accept loop.
    def call(server)
      handle(Transport.apply_read_timeout(server.accept))
    end

    # Handles an already-accepted client. +client+ only needs to respond to
    # #gets, #puts and #close, which makes this testable with a fake socket.
    def handle(client)
      line = Transport.read_line(client)
      return if line.nil?
      return Transport.write_response(client, Dispatcher.error("Request too large")) if Transport.line_too_long?(line)
      return if line.strip.empty?

      Transport.write_response(client, build_response(line))
    ensure
      # Released on every path (early return, response, unexpected raise), so malformed
      # requests can't leak descriptors. A second close after write_response is a no-op.
      client.close
    end

    # Parses one request line and routes it, returning the response envelope.
    def build_response(line)
      request = JSON.parse(line)
      authorized?(request) ? Dispatcher.dispatch(request) : Dispatcher.error("Unauthorized")
    rescue JSON::ParserError
      Dispatcher.error("Invalid JSON")
    end

    # Requests must echo the per-session HAML_LINT_SERVER_TOKEN, so no other process on
    # 127.0.0.1 can drive the server (a lint config can run arbitrary Ruby). Fails closed.
    def authorized?(request)
      expected = ENV["HAML_LINT_SERVER_TOKEN"].to_s
      return Controller.allow_unauthenticated if expected.empty?
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
