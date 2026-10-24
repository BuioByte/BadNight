import type { AgentTool, ToolHandler, ToolRegistry } from './agent.types.js';

export function createToolRegistry(): ToolRegistry {
  const registered = new Map<string, { tool: AgentTool; handler: ToolHandler }>();

  return {
    register(tool, handler) {
      if (registered.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered.`);
      registered.set(tool.name, { tool, handler });
    },
    definitions() {
      return [...registered.values()].map(({ tool }) => tool);
    },
    async execute(name, arguments_) {
      const entry = registered.get(name);
      if (!entry) throw new Error(`Tool "${name}" is not registered.`);
      return entry.handler(arguments_);
    },
  };
}
