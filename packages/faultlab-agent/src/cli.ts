#!/usr/bin/env node

import readline from 'readline';
import { AgentApiClient, getSystemInfo } from './client';
import { loadConfig, saveConfig, clearConfig, getConfigPath } from './config';
import { AgentPoller } from './poller';
import { AgentStoredConfig } from './types';

function printHelp(): void {
  console.log(`
FaultLab Local Diagnostic Agent CLI

USAGE:
  faultlab-agent <command> [options]

COMMANDS:
  connect       Pair this machine with a FaultLab project and start listening
  start         Start the agent using previously paired credentials
  status        Check current agent pairing and connection status
  disconnect    Disconnect agent and clear locally stored credentials
  help          Show this help message

OPTIONS:
  --code <code>         Single-use pairing code (e.g. FLAB-ABCD-1234)
  --origin <url>        Approved local API origin (e.g. http://localhost:5000)
  --server <url>        FaultLab backend server URL (default: http://localhost:5000)
  --name <name>         Optional custom agent name
  --config <path>       Custom config file path

EXAMPLES:
  faultlab-agent connect --code FLAB-A1B2-C3D4 --origin http://localhost:5000
  faultlab-agent status
  faultlab-agent disconnect
`);
}

function parseArgs(args: string[]): { command: string; flags: Record<string, string> } {
  const command = args[0] || 'help';
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }

  return { command, flags };
}

async function promptQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans: string) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function handleConnect(flags: Record<string, string>): Promise<void> {
  let serverUrl = flags['server'] || process.env.FAULTLAB_SERVER_URL || 'http://localhost:5000';
  let pairingCode = flags['code'];
  const configPath = flags['config'];

  let parsedServer: URL;
  try {
    parsedServer = new URL(serverUrl);
  } catch {
    console.error(`Error: Invalid server URL "${serverUrl}". Must be a valid HTTP or HTTPS URL.`);
    process.exit(1);
    return;
  }

  const isLoopback = parsedServer.hostname === 'localhost' || parsedServer.hostname === '127.0.0.1';
  if (!isLoopback && parsedServer.protocol !== 'https:') {
    console.error(`Error: Remote FaultLab server URL must use HTTPS for secure pairing and execution (received: ${serverUrl}).`);
    process.exit(1);
    return;
  }

  if (!pairingCode) {
    pairingCode = await promptQuestion('Enter pairing code (e.g. FLAB-XXXX-YYYY): ');
  }

  if (!pairingCode) {
    console.error('Error: Pairing code is required.');
    process.exit(1);
  }

  const client = new AgentApiClient(serverUrl);
  console.log(`Connecting to FaultLab server at ${serverUrl}...`);

  try {
    const paired = await client.pair(pairingCode, getSystemInfo());
    console.log(`\n Pairing successful!`);
    console.log(`Agent Name:       ${paired.name}`);
    console.log(`Agent ID:         ${paired.agentId}`);
    console.log(`Approved Origin:  ${paired.approvedOrigin}`);
    console.log(`Project ID:       ${paired.projectId}`);

    const config: AgentStoredConfig = {
      agentId: paired.agentId,
      token: paired.token,
      approvedOrigin: paired.approvedOrigin,
      serverUrl,
      agentName: paired.name,
      projectId: paired.projectId,
      pairedAt: new Date().toISOString(),
    };

    saveConfig(config, configPath);
    console.log(`Credentials securely saved to: ${getConfigPath(configPath)}\n`);

    // Start poller loop
    await runPoller(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Failed to pair agent: ${msg}`);
    process.exit(1);
  }
}

async function handleStart(flags: Record<string, string>): Promise<void> {
  const configPath = flags['config'];
  const config = loadConfig(configPath);
  if (!config) {
    console.error('No paired agent configuration found.');
    console.error('Run: faultlab-agent connect --code <CODE>');
    process.exit(1);
    return;
  }

  await runPoller(config);
}

async function handleStatus(flags: Record<string, string>): Promise<void> {
  const configPath = flags['config'];
  const config = loadConfig(configPath);
  if (!config) {
    console.log('No paired agent found on this machine.');
    console.log('Run `faultlab-agent connect` to pair with a FaultLab project.');
    return;
  }

  console.log('--- FaultLab Local Agent Status ---');
  console.log(`Config file:      ${getConfigPath(configPath)}`);
  console.log(`Agent Name:       ${config.agentName}`);
  console.log(`Agent ID:         ${config.agentId}`);
  console.log(`Project ID:       ${config.projectId}`);
  console.log(`Approved Origin:  ${config.approvedOrigin}`);
  console.log(`Server URL:       ${config.serverUrl}`);
  console.log(`Paired At:        ${config.pairedAt}`);

  // Test live connection
  const client = new AgentApiClient(config.serverUrl, config.token);
  try {
    const hb = await client.heartbeat();
    console.log(`Server Status:    ONLINE (${hb.pendingTasks} pending tasks)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
      console.log('Server Status:    REVOKED (Agent credentials have been revoked by project owner)');
    } else {
      console.log(`Server Status:    OFFLINE / UNREACHABLE (${msg})`);
    }
  }
}

async function handleDisconnect(flags: Record<string, string>): Promise<void> {
  const configPath = flags['config'];
  const config = loadConfig(configPath);
  if (!config) {
    console.log('No paired agent to disconnect.');
    return;
  }

  const client = new AgentApiClient(config.serverUrl, config.token);
  await client.disconnect();
  clearConfig(configPath);
  console.log(`Agent "${config.agentName}" disconnected and local credentials removed.`);
}

async function runPoller(config: AgentStoredConfig): Promise<void> {
  const poller = new AgentPoller(config, {
    onRevoked: () => {
      console.log('Poller terminated due to credential revocation.');
      process.exit(0);
    },
  });

  const cleanup = async () => {
    console.log('\nShutting down agent gracefully...');
    await poller.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await poller.start();
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command.toLowerCase()) {
    case 'connect':
      await handleConnect(flags);
      break;
    case 'start':
    case 'run':
      await handleStart(flags);
      break;
    case 'status':
      await handleStatus(flags);
      break;
    case 'disconnect':
      await handleDisconnect(flags);
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

// Only execute when run directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal agent error:', err);
    process.exit(1);
  });
}
