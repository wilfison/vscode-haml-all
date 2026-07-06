# frozen_string_literal: true

require "test_helper"

class LintServerControllerTest < Minitest::Test
  include LintServerTestHelpers

  def test_handle_dispatches_and_writes_single_encoded_response
    client = FakeClient.new("#{lint_request.to_json}\n")

    LintServer::Controller.handle(client)

    assert_equal("success", client.response["status"])
    assert_kind_of(Array, client.response["result"])
    assert(client.closed)
  end

  def test_handle_returns_error_for_invalid_json
    client = FakeClient.new("not json\n")

    LintServer::Controller.handle(client)

    assert_equal("error", client.response["status"])
    assert_equal("Invalid JSON", client.response["result"])
  end

  def test_handle_closes_client_on_empty_request
    client = FakeClient.new("")

    LintServer::Controller.handle(client)

    assert(client.closed)
    assert_empty(client.written)
  end
end
