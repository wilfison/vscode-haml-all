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
      return client.close if line.nil? || line.strip.empty?

      response =
        begin
          Dispatcher.dispatch(JSON.parse(line))
        rescue JSON::ParserError
          Dispatcher.error("Invalid JSON")
        end

      Transport.write_response(client, response)
    end
  end
end
