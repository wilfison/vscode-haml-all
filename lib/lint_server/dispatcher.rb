# frozen_string_literal: true

module LintServer
  # Routes a parsed request to the handler for its "action" and wraps the
  # outcome in the uniform { status:, result: } envelope the client expects.
  #
  # This module is intentionally free of any socket/IO concerns so it can be
  # unit-tested with plain Hashes.
  module Dispatcher
    module_function

    # action name => callable(request) returning the handler result.
    HANDLERS = {
      "lint" => ->(request) { Report.lint(request) },
      "autocorrect" => ->(request) { Report.autocorrect(request) },
      "list_cops" => ->(_request) { Cops.list_cops }
    }.freeze

    # Runs the handler for +request+ and returns a response Hash. Never raises:
    # any handler error is captured into an "error" response so the accept loop
    # keeps serving.
    def dispatch(request)
      handler = HANDLERS[request["action"]]
      return error("Unknown action: #{request['action'].inspect}") unless handler

      success(handler.call(request))
    rescue StandardError, ScriptError => e
      # ScriptError (e.g. SyntaxError) is not a StandardError; catch it too so a
      # bad request never takes down the connection.
      error("#{e.message}\n#{e.backtrace.join("\n")}")
    end

    def success(result)
      { status: "success", result: result }
    end

    def error(message)
      { status: "error", result: message }
    end
  end
end
