# frozen_string_literal: true

require "test_helper"

class LintServerTransportTest < Minitest::Test
  def test_read_line_returns_the_request_line
    client = FakeClient.new("{\"action\":\"lint\"}\n")

    assert_equal("{\"action\":\"lint\"}\n", LintServer::Transport.read_line(client))
  end

  def test_read_line_returns_nil_on_empty_input
    assert_nil(LintServer::Transport.read_line(FakeClient.new("")))
  end

  def test_read_line_truncates_a_line_past_the_byte_limit
    client = FakeClient.new("#{'a' * 20}\n")

    line = LintServer::Transport.read_line(client, limit: 8)

    assert_equal(8, line.bytesize)
    refute(line.end_with?("\n"), "an over-limit line is truncated before its newline")
    assert(LintServer::Transport.line_too_long?(line, limit: 8))
  end

  def test_line_too_long_is_false_for_a_complete_line_within_the_limit
    refute(LintServer::Transport.line_too_long?("{\"action\":\"lint\"}\n", limit: 8))
  end

  def test_write_response_single_encodes_and_closes
    client = FakeClient.new

    LintServer::Transport.write_response(client, { status: "success", result: [1, 2] })

    # The wire must contain a single JSON object, not a JSON-encoded string.
    assert_equal({ "status" => "success", "result" => [1, 2] }, client.response)
    assert(client.closed, "client should be closed after writing")
  end

  def test_write_response_closes_client_even_when_writing_fails
    failing_client = FakeClient.new
    def failing_client.puts(*)
      raise "broken pipe"
    end

    assert_raises(RuntimeError) do
      LintServer::Transport.write_response(failing_client, { status: "success" })
    end
    assert(failing_client.closed, "client must be closed even when writing raises")
  end
end
