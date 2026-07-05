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

    # Reads a single request line from the client. Returns the raw line
    # (including trailing newline) or nil when the client closed without
    # sending anything.
    def read_line(client)
      client.gets
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
