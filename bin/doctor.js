#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENCLAW_DIR = path.join(process.env.HOME, '.openclaw', 'skills');

// ═══════════════════════════════════════════════════════════════════════════
// Colors and utilities (matching skunk.js style)
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function info(msg) { console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`); }

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic Functions
// ═══════════════════════════════════════════════════════════════════════════

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkClawdbot() {
  console.log(`${colors.bright}Checking OpenClaw/Clawdbot...${colors.reset}`);
  
  // Check for clawdbot command
  const hasClawdbot = commandExists('clawdbot');
  if (hasClawdbot) {
    try {
      const output = execSync('clawdbot version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const version = output.trim();
      success(`Clawdbot installed: ${version}`);
      
      // Check if gateway is running
      try {
        const status = execSync('clawdbot gateway status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        if (status.includes('running') || status.includes('active')) {
          success(`Gateway is running`);
        } else {
          warn(`Gateway is not running`);
          console.log(`  ${colors.dim}Start with: clawdbot gateway start${colors.reset}`);
        }
      } catch (e) {
        warn(`Could not check gateway status`);
        console.log(`  ${colors.dim}Try: clawdbot gateway status${colors.reset}`);
      }
    } catch (e) {
      warn(`Clawdbot found but version check failed`);
    }
  } else {
    error(`Clawdbot not found in PATH`);
    console.log(`  ${colors.dim}Install from: https://skunkglobal.com/guides/openclaw-wordpress${colors.reset}`);
  }
  
  console.log('');
}

function checkWordPressTools() {
  console.log(`${colors.bright}Checking WordPress tools...${colors.reset}`);
  
  // Check WP-CLI
  const hasWpCli = commandExists('wp');
  if (hasWpCli) {
    try {
      const output = execSync('wp --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const version = output.trim().replace('WP-CLI ', '');
      success(`WP-CLI installed: ${version}`);
    } catch (e) {
      warn(`WP-CLI found but version check failed`);
    }
  } else {
    warn(`WP-CLI not found`);
    console.log(`  ${colors.dim}Install from: https://wp-cli.org/${colors.reset}`);
  }
  
  // Check WordPress Studio
  const hasStudio = commandExists('studio');
  if (hasStudio) {
    try {
      const output = execSync('studio --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const version = output.trim();
      success(`WordPress Studio installed: ${version}`);
    } catch (e) {
      warn(`WordPress Studio found but version check failed`);
    }
  } else {
    info(`WordPress Studio not found (optional)`);
    console.log(`  ${colors.dim}Install from: https://developer.wordpress.org/studio/${colors.reset}`);
  }
  
  if (!hasWpCli && !hasStudio) {
    error(`No WordPress CLI tools found`);
    console.log(`  ${colors.yellow}At least one is required for plugin installation${colors.reset}`);
  }
  
  console.log('');
}

function checkInstalledSkills() {
  console.log(`${colors.bright}Checking installed skills...${colors.reset}`);
  
  if (!fs.existsSync(OPENCLAW_DIR)) {
    warn(`Skills directory does not exist: ${OPENCLAW_DIR}`);
    console.log(`  ${colors.dim}This will be created when you install your first skill${colors.reset}`);
    console.log('');
    return;
  }
  
  const entries = fs.readdirSync(OPENCLAW_DIR);
  const skills = entries.filter(f => {
    const skillPath = path.join(OPENCLAW_DIR, f);
    return fs.statSync(skillPath).isDirectory();
  });
  
  if (skills.length === 0) {
    warn(`No skills found in ${OPENCLAW_DIR}`);
    console.log(`  ${colors.dim}Install skills with: skunk install skill <name>${colors.reset}`);
  } else {
    success(`Found ${skills.length} skill${skills.length === 1 ? '' : 's'}:`);
    
    for (const skill of skills) {
      const skillDir = path.join(OPENCLAW_DIR, skill);
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const configPath = path.join(skillDir, 'config.json');
      
      let status = [];
      
      // Check SKILL.md
      if (fs.existsSync(skillMdPath)) {
        status.push(`${colors.green}SKILL.md${colors.reset}`);
      } else {
        status.push(`${colors.red}missing SKILL.md${colors.reset}`);
      }
      
      // Check config.json
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          status.push(`${colors.green}config.json${colors.reset}`);
        } catch (e) {
          status.push(`${colors.yellow}invalid config.json${colors.reset}`);
        }
      } else {
        status.push(`${colors.dim}no config.json${colors.reset}`);
      }
      
      console.log(`  ${colors.cyan}●${colors.reset} ${skill} (${status.join(', ')})`);
    }
  }
  
  console.log('');
}

async function checkConnectivity() {
  console.log(`${colors.bright}Checking connectivity...${colors.reset}`);
  
  // Test connection to main API
  try {
    await testUrl('https://skunkglobal.com/api/plugins/versions');
    success(`skunkglobal.com API is reachable`);
  } catch (e) {
    error(`Cannot reach skunkglobal.com API`);
    console.log(`  ${colors.dim}Error: ${e.message}${colors.reset}`);
  }
  
  // Test GitHub skills repository
  try {
    await testUrl('https://api.github.com/repos/skunkceo/openclaw-skills/contents/skills');
    success(`GitHub skills repository is reachable`);
  } catch (e) {
    error(`Cannot reach GitHub skills repository`);
    console.log(`  ${colors.dim}Error: ${e.message}${colors.reset}`);
  }
  
  console.log('');
}

function testUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { 
      headers: { 'User-Agent': 'skunk-cli-doctor' },
      timeout: 10000 
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.resume(); // Consume response to free up memory
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

function provideSuggestions() {
  console.log(`${colors.bright}💡 Recommendations:${colors.reset}\n`);
  
  // Check if user has basic setup
  const hasClawdbot = commandExists('clawdbot');
  const hasWpTools = commandExists('wp') || commandExists('studio');
  const hasSkills = fs.existsSync(OPENCLAW_DIR) && fs.readdirSync(OPENCLAW_DIR).length > 0;
  
  if (!hasClawdbot) {
    console.log(`${colors.cyan}1.${colors.reset} Install OpenClaw/Clawdbot:`);
    console.log(`   ${colors.dim}https://skunkglobal.com/guides/openclaw-wordpress${colors.reset}\n`);
  }
  
  if (!hasWpTools) {
    console.log(`${colors.cyan}${!hasClawdbot ? '2' : '1'}.${colors.reset} Install a WordPress CLI tool:`);
    console.log(`   ${colors.dim}WP-CLI: https://wp-cli.org/${colors.reset}`);
    console.log(`   ${colors.dim}WordPress Studio: https://developer.wordpress.org/studio/${colors.reset}\n`);
  }
  
  if (!hasSkills) {
    const stepNum = (!hasClawdbot ? 2 : 1) + (!hasWpTools ? 1 : 0);
    console.log(`${colors.cyan}${stepNum}.${colors.reset} Install your first skill:`);
    console.log(`   ${colors.dim}skunk available${colors.reset}`);
    console.log(`   ${colors.dim}skunk install skill skunkforms${colors.reset}\n`);
  }
  
  if (hasClawdbot && hasWpTools && hasSkills) {
    console.log(`${colors.green}✓ Your setup looks good!${colors.reset}\n`);
    console.log(`${colors.dim}Next steps:${colors.reset}`);
    console.log(`  • Install WordPress plugins: ${colors.dim}skunk install plugin <name>${colors.reset}`);
    console.log(`  • Check for updates: ${colors.dim}skunk status${colors.reset}`);
    console.log(`  • Get help: ${colors.dim}skunk help${colors.reset}\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Doctor Function
// ═══════════════════════════════════════════════════════════════════════════

async function runDiagnostics() {
  console.log(`${colors.bright}🩺 Skunk CLI Doctor${colors.reset}\n`);
  console.log(`${colors.dim}Checking your setup...${colors.reset}\n`);
  
  try {
    checkClawdbot();
    checkWordPressTools();
    checkInstalledSkills();
    await checkConnectivity();
    provideSuggestions();
  } catch (e) {
    error(`Doctor failed: ${e.message}`);
  }
}

// Run if called directly or when required
if (require.main === module) {
  runDiagnostics();
} else {
  // When required from another file, run immediately  
  runDiagnostics();
}

module.exports = { runDiagnostics };