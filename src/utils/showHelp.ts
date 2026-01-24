import { colors } from "../constant/colors";

// --- Commands ---
export function showHelp(): void {
  console.log(colors.bold('\n📦 ExpressX CLI\n'));
  console.log('Usage: expressx <command> [options]\n');
  console.log(colors.bold('Commands:\n'));
  console.log('  start, dev               Start development server with watch mode');
  console.log('  new <name>               Create a new ExpressX project');
  console.log('  generate <type> <name>   Generate code (alias: g)');
  console.log('    Types: controller, service, middleware, interceptor, application');
  console.log('  help                     Show this help message\n');
  console.log(colors.bold('Examples:\n'));
  console.log(colors.gray('  expressx start'));
  console.log(colors.gray('  expressx new my-app'));
  console.log(colors.gray('  expressx generate controller User'));
  console.log(colors.gray('  expressx g service Auth'));
  console.log(colors.gray('  expressx g middleware Logger\n'));
}