module LintServer
  module Compile
    def self.call(request = {})
      template = request['template']

      eval(Haml::Engine.new({}).call(template))
    end
  end
end
